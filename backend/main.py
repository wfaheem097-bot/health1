from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api.routes import router
from .api.models import router as models_router
from .data.storage import ReadingStore
from .data.feed import DatasetFeed
from .services.analysis import AnalysisService


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.analysis = AnalysisService()
    app.state.store = ReadingStore([])
    app.state.feed = DatasetFeed(app.state.store)
    await app.state.feed.restart()
    try:
        yield
    finally:
        await app.state.feed.stop()


app = FastAPI(title="ASTRAHEALTH AI", lifespan=lifespan)
app.include_router(router)
app.include_router(models_router)
