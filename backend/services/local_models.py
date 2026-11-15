from functools import lru_cache
import json
import os
from pathlib import Path
from threading import Lock

ROOT = Path(__file__).resolve().parents[1] / "model_artifacts"
BP_COLUMNS = ("Minutes", "CO", "TPR", "SV", "Position", "Test_Phase")
WAVEFORMS = {
    "mitbih_ecg": ("ecg/mitbih_ecg_finetuned", 256, "classes"),
    "ptbxl_ecg": ("ecg/ptbxl_ecg_pretrained", None, "classes"),
    "bidmc_ppg": ("ppg/bidmc_ppg_vitals", None, "targets"),
    "ptt_ppg": ("ppg/ptt_ppg_vitals_finetuned", None, "targets"),
}
MODEL_IDS = (*WAVEFORMS, "blood_pressure", "ppg_anomaly")
LOAD_LOCK = Lock()


@lru_cache(maxsize=None)
def load_joblib(name):
    import joblib

    return joblib.load(ROOT / name)


@lru_cache(maxsize=None)
def load_keras(name):
    os.environ.setdefault("KERAS_BACKEND", "jax")
    import keras

    return keras.saving.load_model(ROOT / (name + ".keras"), compile=False, safe_mode=True)


def predict(model_id, values):
    import numpy as np

    if model_id == "blood_pressure":
        import pandas as pd

        if not isinstance(values, dict) or set(values) != set(BP_COLUMNS):
            raise ValueError("Supply all six tilt-test fields exactly as listed.")
        for key in BP_COLUMNS[:4]:
            if type(values[key]) not in (int, float) or not np.isfinite(values[key]):
                raise ValueError(f"{key} must be numeric and finite.")
        for key in BP_COLUMNS[4:]:
            if not isinstance(values[key], str) or not values[key].strip():
                raise ValueError(f"{key} must be a nonempty training category.")
        if values["Position"] not in {"Supine", "Tilt"} or values["Test_Phase"] not in {"PRE_TEST", "POST_TEST"}:
            raise ValueError("Position must be Supine or Tilt; Test_Phase must be PRE_TEST or POST_TEST.")
        frame = pd.DataFrame([values], columns=BP_COLUMNS)
        with LOAD_LOCK:
            models = [load_joblib(f"blood_pressure/{name}_bp_extra_trees.joblib")
                      for name in ("systolic", "diastolic")]
        return {key: float(model.predict(frame)[0])
                for key, model in zip(("SBP_mmHg", "DBP_mmHg"), models)}

    if (not isinstance(values, list) or not values or len(values) > 20000
            or any(type(value) not in (int, float) for value in values)):
        raise ValueError("Supply a flat array of up to 20,000 numeric values.")
    array = np.asarray(values, dtype=np.float32)
    if not np.isfinite(array).all():
        raise ValueError("Inputs must be finite.")
    if model_id == "ppg_anomaly":
        if len(array) != 10:
            raise ValueError("Supply the original ten engineered features in training order.")
        with LOAD_LOCK:
            model = load_joblib("ppg/bidmc_ppg_anomaly_isolation_forest.joblib")
        features = array[None, :]
        return {"score": float(model.decision_function(features)[0]),
                "flag": int(model.predict(features)[0])}

    name, samples, output_key = WAVEFORMS[model_id]
    if (samples and len(array) != samples) or len(array) < 4:
        raise ValueError(f"Expected {samples or 'at least four'} model-ready samples.")
    metadata = json.loads((ROOT / (name + ".metrics.json")).read_text())
    with LOAD_LOCK:
        model = load_keras(name)
        scaler = load_joblib(name + ".scaler.joblib") if output_key == "targets" else None
    output = np.asarray(model(array[None, :, None], training=False))
    if scaler is not None:
        output = scaler.inverse_transform(output)
    labels = metadata[output_key]
    if output.shape != (1, len(labels)) or not np.isfinite(output).all():
        raise ValueError("Model did not return finite values for all outputs.")
    return {label: float(value) for label, value in zip(labels, output[0])}



@lru_cache(maxsize=64)
def predict_csv_models(payload: str) -> list[dict]:
    results = []
    for model_id, values in json.loads(payload).items():
        try:
            results.append({"model": model_id, "outputs": predict(model_id, values)})
        except (ImportError, FileNotFoundError):
            results.append({"model": model_id, "error": "Local model runtime or artifact unavailable."})
        except (ValueError, TypeError, OverflowError, RuntimeError, OSError):
            results.append({"model": model_id, "error": "Inference failed for the supplied inputs."})
    return results
