from fastapi import APIRouter, Depends, HTTPException

from app.schemas.moderation_schema import ModerateRequest, ModerateResponse
from app.services.moderation_service import ModerationService

router = APIRouter(tags=["moderation"])


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
        raise HTTPException(status_code=400, detail="Text must not be empty.")

    try:
        return service.moderate(text)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Moderation prediction failed: {error}",
        ) from error
