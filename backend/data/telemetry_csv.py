import csv
from datetime import datetime
import io
import json
import math
from pathlib import Path

from ..core.config import ASTRONAUT, BASELINE
from ..services.local_models import MODEL_IDS

SAMPLE = Path(__file__).resolve().parents[2] / "astronaut_readings.csv"
METRICS = (*BASELINE, "activity_minutes")
COLUMNS = ("timestamp", "astronaut_id", *METRICS, "device_status")


def parse_csv(content: bytes) -> list[dict]:
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig"), newline=""), strict=True)
    extended = (*COLUMNS, "model_inputs")
    if reader.fieldnames not in (list(COLUMNS), list(extended)):
        raise ValueError("Use the standard CSV header, optionally followed by model_inputs.")
    readings = []
    for row in reader:
        try:
            if None in row or None in row.values():
                raise ValueError("Row length must match the CSV header")
            timestamp = datetime.strptime(row["timestamp"], "%Y-%m-%dT%H:%M:%S")
            if timestamp.isoformat() != row["timestamp"]:
                raise ValueError("Expected timestamp in YYYY-MM-DDTHH:MM:SS format")
            if row["astronaut_id"] != ASTRONAUT["id"]:
                raise ValueError("Only astronaut A-001 is supported")
            if row["device_status"] not in {"connected", "disconnected"}:
                raise ValueError("Device status must be connected or disconnected")
            for key in METRICS:
                value = row[key].strip()
                row[key] = None if value.lower() in {"", "null"} else float(value)
                if row[key] is not None and not math.isfinite(row[key]):
                    raise ValueError(f"{key} must be finite")
            model_inputs = row.pop("model_inputs", "").strip()
            if model_inputs:
                payload = json.loads(model_inputs)
                if not isinstance(payload, dict) or set(payload) - set(MODEL_IDS):
                    raise ValueError("model_inputs must be an object keyed by supported model IDs")
                # Store immutable JSON so snapshots cannot mutate uploaded inputs.
                row["model_inputs"] = json.dumps(payload, allow_nan=False, sort_keys=True)
            readings.append(row)
        except ValueError as error:
            raise ValueError(f"CSV line {reader.line_num}: {error}.") from error
    if not readings:
        raise ValueError("CSV must contain at least one reading.")
    return readings


def encode_csv(readings: list[dict]) -> str:
    output = io.StringIO()
    columns = (*COLUMNS, "model_inputs") if any(row.get("model_inputs") for row in readings) else COLUMNS
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(readings)
    return output.getvalue()
