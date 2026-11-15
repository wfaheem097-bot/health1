import asyncio
from contextlib import suppress

from .storage import ReadingStore
from .telemetry_csv import SAMPLE, parse_csv

READING_INTERVAL_SECONDS = 10


class DatasetFeed:
    def __init__(self, store: ReadingStore):
        self.store = store
        self.task = None
        self._restart_lock = asyncio.Lock()

    async def restart(self):
        dataset = sorted(parse_csv(SAMPLE.read_bytes()), key=lambda row: row["timestamp"])
        async with self._restart_lock:
            await self.stop()
            self.store.replace_dataset(dataset[0])
            self.task = asyncio.create_task(self.ingest(dataset[1:]))

    async def stop(self):
        if self.task is not None:
            self.task.cancel()
            with suppress(asyncio.CancelledError):
                await self.task

    async def ingest(self, rows):
        for row in rows:
            await asyncio.sleep(READING_INTERVAL_SECONDS)
            self.store.append_if_new(row)

    @property
    def complete(self):
        return self.task is not None and self.task.done()
