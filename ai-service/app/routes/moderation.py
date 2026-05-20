from fastapi import APIRouter, Depends, HTTPException

from app.models.model_loader import get_available_models
from app.schemas.moderation_schema import (
    CompareRequest,
    ModerateRequest,
    ModerateResponse,
    PredictRequest,
)
from app.services.moderation_service import ModerationService

router = APIRouter(prefix="", tags=["moderation"])


def get_moderation_service() -> ModerationService:
    from app.main import moderation_service

    return moderation_service


@router.post("/moderate", response_model=ModerateResponse)
def moderate_text(
    payload: ModerateRequest,
    service: ModerationService = Depends(get_moderation_service),
) -> ModerateResponse:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Vui long nhap binh luan")
    return service.moderate(text, payload.model_name)


@router.post("/predict")
def predict_text(
    payload: PredictRequest,
    service: ModerationService = Depends(get_moderation_service),
) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Vui long nhap binh luan")

    try:
        return service.predict_raw(text, payload.model_name)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {error}") from error


@router.post("/compare")
def compare_text(
    payload: CompareRequest,
    service: ModerationService = Depends(get_moderation_service),
) -> dict:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Vui long nhap binh luan")

    return service.compare_raw(text, payload.model_names)


@router.get("/models")
def list_models() -> dict:
    return {"models": get_available_models()}
