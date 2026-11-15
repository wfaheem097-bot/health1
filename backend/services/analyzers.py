from dataclasses import dataclass

from ..core.config import LOW_ONLY, REPEAT_COUNT, THRESHOLDS, TREND_WATCH_FRACTION

LABELS = {
    "heart_rate_bpm": "heart rate",
    "systolic_mmhg": "systolic blood pressure",
    "diastolic_mmhg": "diastolic blood pressure",
    "spo2_percent": "oxygen saturation",
    "temperature_c": "temperature",
    "sleep_hours": "sleep duration",
}


@dataclass(frozen=True)
class Analysis:
    status: str
    risk_score: int | None
    reason: str
    affected_metrics: list[str]
    recommended_action: str
    analysis_source: str = "rules"


class RuleBasedAnalyzer:
    def analyze(self, readings: list[dict], baseline: dict) -> Analysis:
        latest = readings[-1]
        missing = [key for key in baseline if latest[key] is None]
        if latest["device_status"] == "disconnected":
            return Analysis("Insufficient Data", None, "The wearable is disconnected.",
                            missing, "Reconnect the wearable and sync a complete reading.")
        if missing:
            names = ", ".join(LABELS[key] for key in missing)
            return Analysis("Insufficient Data", None, f"The latest reading is missing {names}.",
                            missing, "Check the wearable and sync a complete reading.")

        window = readings[-REPEAT_COUNT:]
        watch, attention, details = [], [], []
        for key, (watch_at, attention_at) in THRESHOLDS.items():
            current = latest[key] - baseline[key]
            direction = -1 if current < 0 else 1
            if direction == 1 and key in LOW_ONLY:
                continue
            deviation = round(abs(current), 6)
            recent = [
                round((row[key] - baseline[key]) * direction, 6)
                for row in window
                if row["device_status"] == "connected" and row[key] is not None
            ]
            full_window = len(recent) == REPEAT_COUNT
            repeated = full_window and all(value >= watch_at for value in recent)
            worsening = (full_window and all(0 <= a < b for a, b in zip(recent, recent[1:]))
                         and deviation >= watch_at * TREND_WATCH_FRACTION)
            description = f"{LABELS[key]} {latest[key]:g} vs baseline {baseline[key]:g}"
            if deviation >= attention_at or repeated:
                attention.append(key)
                context = f"{REPEAT_COUNT} consecutive deviations" if repeated else "large deviation"
                details.append(f"{description} ({context})")
            elif deviation >= watch_at or worsening:
                watch.append(key)
                details.append(f"{description} ({'moving away from baseline' if worsening else 'deviation'})")

        if attention:
            return Analysis("Attention", 80, "; ".join(details) + ".", attention + watch,
                            "Verify the simulated readings and flag the trend for mission control review.")
        if watch:
            return Analysis("Watch", 40, "; ".join(details) + ".", watch,
                            "Review the trend and compare the next simulated reading with the baseline.")
        return Analysis("Normal", 0, "The latest values are close to the personal baseline.",
                        [], "Continue routine simulated monitoring.")
