# ASTRAHEALTH AI

ASTRAHEALTH AI is a single-astronaut telemetry prototype. All readings, alerts and mission details are simulated. This prototype is not a medical device and must never be used for clinical or mission decisions.

The React console uses the Orbital Clinical Operations design tokens. Overview and Health Trends use FastAPI telemetry for Maya Khan (A-001), mission day 18. Daily Check-in saves drafts to local browser storage.

## Run locally

Install Python 3.10+ and Node.js 20+. From the project root, start the backend in one PowerShell terminal.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Start the frontend from the same directory in a second terminal.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open [ASTRA on localhost](http://127.0.0.1:5173). Vite proxies API calls to port 8000. Run `npm.cmd run build` to build all three pages and `npm.cmd run preview` to preview the build with FastAPI still running. API documentation is available at [localhost:8000/docs](http://127.0.0.1:8000/docs).

## Demonstrate the sample

FastAPI starts with the first row of `astronaut_readings.csv` and ingests one additional row every 10 seconds in timestamp order. The frontend checks for updates every 2 seconds. Original timestamps stay intact. Ingestion stops after the final row. When ingestion finishes, select **Replay dataset** in Overview or Health Trends to start the sequence again. CSV uploads stay in memory during replay. A newer uploaded reading can still be the latest reading. No wearable hardware is required. Open **View alert history** to see Watch as readings drift from baseline, Attention after three consecutive elevated heart-rate readings, and Insufficient Data for both a disconnected wearable and a connected row with missing SpO2. The heart-rate chart draws a dashed baseline and leaves a gap for unavailable readings.

Use **Upload CSV** to add readings. Keep the standard header order. Model-enabled files can append `model_inputs`. To demonstrate a change to the current status, use a timestamp later than the latest stored reading. Identical timestamps replace earlier records for A-001. The most recent timestamp determines the current status. **Export CSV** saves the combined readings, and **Download sample CSV** saves the original sample. Restart FastAPI to restore the sample. Uploads are held in memory and should be used with a single backend process.

## CSV columns

| Column | Meaning |
| --- | --- |
| timestamp | Simulated observation time in UTC, formatted as `2026-11-14T08:00:00` |
| astronaut_id | `A-001` |
| heart_rate_bpm | Heart rate in beats per minute |
| systolic_mmhg | Systolic blood pressure in mmHg |
| diastolic_mmhg | Diastolic blood pressure in mmHg |
| spo2_percent | Oxygen saturation percentage points |
| temperature_c | Temperature in degrees Celsius |
| sleep_hours | Sleep duration in hours |
| activity_minutes | Physical activity in minutes |
| device_status | `connected` or `disconnected` |

Use plain numeric fields without units. Empty or `null` numeric fields indicate missing data. The dashboard displays the last connected timestamp as the last sync.

## Personal baseline and status

The baseline is 68 bpm, 118/76 mmHg, 98% SpO2, 36.7 C, and 7.5 hours of sleep. Activity is displayed as context. Edit the baseline, deviation limits, repeat count and trend fraction in `backend/core/config.py`. These values are demonstration settings.

| Status | Rule |
| --- | --- |
| Normal | Available metrics are close to the baseline, with no qualifying worsening trend. |
| Watch | A metric crosses its watch limit, or three consecutive values move away from baseline and reach 75% of that limit. |
| Attention | A metric crosses its attention limit or exceeds its watch limit in the same direction for three consecutive readings. |
| Insufficient Data | The wearable is disconnected or a baseline metric is missing in the latest row. |

The risk score is a demonstration ordinal (0, 40, 80, or null for insufficient data). Each analysis returns `status`, `risk_score`, `reason`, `affected_metrics`, `recommended_action`, and `analysis_source`.

## Backend layout

| File | Responsibility |
| --- | --- |
| `backend/main.py` | FastAPI setup and startup |
| `backend/api/routes.py` | HTTP endpoints and upload responses |
| `backend/core/config.py` | Astronaut profile, personal baseline and thresholds |
| `backend/data/telemetry_csv.py` | CSV parsing, validation and export |
| `backend/data/storage.py` | In-memory reading storage |
| `backend/services/analysis.py` | Telemetry assessment coordination |
| `backend/services/analyzers.py` | Rule-based telemetry assessment |

## Local research models

Install the local runtimes in the same Python environment as FastAPI, then restart the backend.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-models.txt
```

No API key is needed. Open **Local Model Inference** on Overview or call `POST /api/models/{model_id}/predict` with a JSON body containing `values`.

| Model ID | Input |
| --- | --- |
| mitbih_ecg | 256 preprocessed ECG samples |
| ptbxl_ecg | Preprocessed single-channel ECG window |
| bidmc_ppg | Preprocessed 10-second PPG window |
| ptt_ppg | Preprocessed PPG window |
| ppg_anomaly | Ten original engineered features in training order |
| blood_pressure | Object with Minutes, CO, TPR, SV, Position, and Test_Phase |

Use **Load smoke-test input** to check that a model runs. These inputs are synthetic and do not validate prediction accuracy. For the blood pressure fields, supported positions are `Supine` and `Tilt`, and phases are `PRE_TEST` and `POST_TEST`.

The archives do not define the complete waveform preprocessing or anomaly feature order. The app accepts model-ready arrays and applies the supplied PPG output scalers. Use only trusted model artifacts since joblib deserialization can execute code. The glucose archive has no trained model.

The original CSV format remains supported. To run models automatically, append an optional `model_inputs` column containing a quoted JSON object keyed by model ID. Each value uses the same input shape as the manual prediction endpoint. Leave the cell empty if no model inputs are available. Upload `astronaut_model_input_example.csv` for a synthetic blood-pressure inference example. The latest connected row supplies both the dashboard vitals and the inputs for **Latest CSV model results**. Model results do not overwrite recorded vitals. This example uses synthetic tilt-test features to verify execution only. The overall status and Explain Alert continue to use deterministic rules. Model outputs are research outputs and have not been verified against a training reference input/output pair.

## API endpoints

In these paths, `{id}` is `A-001`.

| Method and path | Response |
| --- | --- |
| GET /api/health | Backend status and inference mode |
| GET /api/astronauts | Astronaut identity and mission day |
| GET /api/astronauts/{id}/baseline | Personal baseline metrics |
| GET /api/astronauts/{id}/readings | Historical readings in timestamp order |
| GET /api/astronauts/{id}/telemetry | Latest analysis, readings and alerts from one snapshot |
| GET /api/astronauts/{id}/latest | Latest reading and current analysis |
| GET /api/astronauts/{id}/alerts | Historical alerts, newest first |
| POST /api/astronauts/{id}/explain | Current rule-based alert explanation |
| POST /api/readings/upload | Multipart upload with a `file` field, up to 1 MB |
| POST /api/readings/replay | Restart the sample feed, preserving uploaded readings |
| GET /api/readings/sample | Download the original sample |
| GET /api/astronauts/{id}/export | Download the stored readings |
