from fastapi import FastAPI

from app.models.model_loader import (
    get_available_models,
    get_model_bundle,
    get_startup_error,
    load_model,
)
from app.routes.moderation import router as moderation_router
from app.services.moderation_service import ModerationService

app = FastAPI(title="Threads AI Moderation Service", version="0.1.0")

loaded_model = load_model()
moderation_service = ModerationService(model=loaded_model)


@app.get("/health")
def health() -> dict:
    startup_error = get_startup_error()
    if startup_error:
        return {"status": "error", "detail": startup_error, "available_models": get_available_models()}

    active_bundle = get_model_bundle()
    return {
        "status": "ok",
        "model_name": active_bundle.model_name,
        "model_dir": str(active_bundle.model_dir),
        "model_source": active_bundle.source,
        "device": str(active_bundle.device),
        "available_models": get_available_models(),
    }


app.include_router(moderation_router)
