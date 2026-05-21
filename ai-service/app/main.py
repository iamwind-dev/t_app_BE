from fastapi import FastAPI

from app.models.model_loader import load_models
from app.routes.moderation import router as moderation_router
from app.schemas.moderation_schema import HealthResponse, RootResponse
from app.services.moderation_service import ModerationService

loaded_models = load_models()
moderation_service = ModerationService(models=loaded_models)

app = FastAPI(title="Vietnamese AI Moderation Service", version="1.0.0")


@app.get("/", response_model=RootResponse)
def root() -> RootResponse:
    return RootResponse(
        service="Vietnamese AI Moderation Service",
        status="running",
        device=moderation_service.device,
        layer_1_model=moderation_service.layer_1_model_id,
        layer_2_model=moderation_service.layer_2_model_id,
    )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        device=moderation_service.device,
    )


app.include_router(moderation_router)
