from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.local_models import MODEL_IDS, predict

router = APIRouter(prefix="/api/models", tags=["Local models"])


class ModelInput(BaseModel):
    values: list | dict


@router.post("/{model_id}/predict")
def predict_local(model_id: str, payload: ModelInput):
    if model_id not in MODEL_IDS:
        raise HTTPException(404, "Local model unavailable.")
    try:
        outputs = predict(model_id, payload.values)
    except (ImportError, FileNotFoundError) as error:
        raise HTTPException(503, "Local model files or runtime dependencies are unavailable.") from error
    except (ValueError, OverflowError) as error:
        raise HTTPException(422, str(error)) from error
    return {"model": model_id, "outputs": outputs, "source": "local_model"}
