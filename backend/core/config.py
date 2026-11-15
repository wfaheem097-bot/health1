"""Personal baseline and editable thresholds for simulated telemetry."""

ASTRONAUT = {"id": "A-001", "name": "Maya Khan", "mission_day": 18}
BASELINE = {
    "heart_rate_bpm": 68,
    "systolic_mmhg": 118,
    "diastolic_mmhg": 76,
    "spo2_percent": 98,
    "temperature_c": 36.7,
    "sleep_hours": 7.5,
}

# Deviation magnitudes from baseline: (watch, attention).
# Oxygen and sleep flag decreases only. Other metrics flag either direction.
THRESHOLDS = {
    "heart_rate_bpm": (12, 25),
    "systolic_mmhg": (12, 25),
    "diastolic_mmhg": (8, 16),
    "spo2_percent": (2, 4),
    "temperature_c": (0.5, 1.2),
    "sleep_hours": (1.5, 3),
}
LOW_ONLY = {"spo2_percent", "sleep_hours"}
REPEAT_COUNT = 3
TREND_WATCH_FRACTION = 0.75
