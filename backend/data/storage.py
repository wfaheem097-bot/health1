from threading import Lock


class ReadingStore:
    """In-memory store keyed by timestamp for the single-astronaut MVP."""

    def __init__(self, readings: list[dict]):
        self._lock = Lock()
        self._uploaded = set()
        self._readings = {row["timestamp"]: row.copy() for row in readings}

    def snapshot(self) -> list[dict]:
        with self._lock:
            return [self._readings[key].copy() for key in sorted(self._readings)]

    def upsert(self, readings: list[dict]) -> int:
        with self._lock:
            self._readings.update((row["timestamp"], row.copy()) for row in readings)
            self._uploaded.update(row["timestamp"] for row in readings)
            return len(self._readings)

    def append_if_new(self, reading: dict) -> None:
        with self._lock:
            self._readings.setdefault(reading["timestamp"], reading.copy())

    def replace_dataset(self, first: dict) -> None:
        with self._lock:
            self._readings = {first["timestamp"]: first.copy(), **{
                key: self._readings[key] for key in self._uploaded
            }}
