import csv
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, PlainTextResponse

from ..core.config import ASTRONAUT, BASELINE, REPEAT_COUNT
from ..data.telemetry_csv import SAMPLE, encode_csv, parse_csv

from ..services.local_models import predict_csv_models

router = APIRouter(prefix="/api")
MAX_UPLOAD_BYTES = 1_000_000


def check_astronaut(astronaut_id: str) -> None:
    if astronaut_id != ASTRONAUT["id"]:
        raise HTTPException(404, "Astronaut not found.")


@router.get("/health")
def health():
    return {"status": "ok", "analysis_provider": "rules", "inference": "local"}


@router.get("/astronauts")
def astronauts():
    return [ASTRONAUT]


@router.get("/astronauts/{astronaut_id}/baseline")
def baseline(astronaut_id: str):
    check_astronaut(astronaut_id)
    return BASELINE


@router.get("/astronauts/{astronaut_id}/readings")
def readings(astronaut_id: str, request: Request):
    check_astronaut(astronaut_id)
    return request.app.state.store.snapshot()


def latest_from(rows: list[dict], request: Request):
    reading = {key: value for key, value in rows[-1].items() if key != "model_inputs"}
    return {"reading": reading, "analysis": asdict(request.app.state.analysis.analyze(rows))}


def alerts_from(rows: list[dict], request: Request):
    results = []
    for index, row in enumerate(rows):
        result = request.app.state.analysis.analyze(rows[max(0, index + 1 - REPEAT_COUNT):index + 1])
        if result.status != "Normal":
            results.append({"timestamp": row["timestamp"], **asdict(result)})
    return results[::-1]


@router.get("/astronauts/{astronaut_id}/latest")
def latest(astronaut_id: str, request: Request):
    return latest_from(readings(astronaut_id, request), request)


@router.get("/astronauts/{astronaut_id}/alerts")
def alerts(astronaut_id: str, request: Request):
    return alerts_from(readings(astronaut_id, request), request)


@router.get("/astronauts/{astronaut_id}/telemetry")
def telemetry(astronaut_id: str, request: Request):
    rows = readings(astronaut_id, request)
    model_inputs = rows[-1].get("model_inputs")
    model_results = (predict_csv_models(model_inputs)
                     if model_inputs and rows[-1]["device_status"] == "connected" else [])
    return {
        "model_results": model_results,
        "readings": [{key: value for key, value in row.items() if key != "model_inputs"} for row in rows],
        "latest": latest_from(rows, request),
        "alerts": alerts_from(rows, request),
        "feed_complete": request.app.state.feed.complete,
    }


@router.post("/astronauts/{astronaut_id}/explain")
def explain(astronaut_id: str, request: Request):
    return request.app.state.analysis.explain(readings(astronaut_id, request))


@router.post("/readings/upload")
def upload(file: UploadFile, request: Request):
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "CSV must be 1 MB or smaller.")
    try:
        batch = parse_csv(content)
    except (ValueError, csv.Error) as error:
        raise HTTPException(422, str(error)) from error
    total = request.app.state.store.upsert(batch)
    return {"rows_processed": len(batch), "total_readings": total}


@router.post("/readings/replay")
async def replay(request: Request):
    await request.app.state.feed.restart()
    return {"status": "restarted"}


@router.get("/readings/sample")
def sample():
    return FileResponse(SAMPLE, media_type="text/csv", filename=SAMPLE.name)


@router.get("/astronauts/{astronaut_id}/export")
def export(astronaut_id: str, request: Request):
    return PlainTextResponse(encode_csv(readings(astronaut_id, request)), media_type="text/csv", headers={
        "Content-Disposition": 'attachment; filename="astra-readings.csv"'
    })
