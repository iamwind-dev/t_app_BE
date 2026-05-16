from __future__ import annotations

from typing import Any

from app.models.model_loader import (
    LoadedModel,
    compare_model_predictions,
    get_model_bundle,
)
from app.schemas.moderation_schema import ModerateResponse


def _map_prediction_to_moderation(prediction: dict[str, Any]) -> ModerateResponse:
    moderation_status = str(prediction.get("moderation_status", "safe"))
    p_offensive = float(prediction.get("p_offensive", 0.0))
    p_hate = float(prediction.get("p_hate", 0.0))
    toxicity_score = float(prediction.get("toxic_severity_score", 0.0))

    categories: list[str] = []
    if p_offensive >= 0.5:
        categories.append("offensive")
    if p_hate >= 0.5:
        categories.append("hate")

    if moderation_status == "high_risk_hate":
        label = "RESTRICTED"
        message = "Noi dung co nguy co cao ve hate speech."
        suggestion = "Hay viet lai theo huong ton trong va khong ky thi."
        if "hate" not in categories:
            categories.append("hate")
    elif moderation_status == "toxic_offensive":
        label = "WARNING"
        message = "Noi dung co dau hieu cong kich/xuc pham."
        suggestion = "Hay dieu chinh cau tu nhe nhang hon truoc khi dang."
        if "offensive" not in categories:
            categories.append("offensive")
    else:
        label = "SAFE"
        message = "Noi dung an toan."
        suggestion = "Ban co the dang bai."

    return ModerateResponse(
        label=label,
        toxicityScore=round(toxicity_score, 4),
        categories=categories,
        message=message,
        highlights=[],
        suggestion=suggestion,
        model=str(prediction.get("model_name", "unknown")),
    )


class ModerationService:
    def __init__(self, model: LoadedModel) -> None:
        self._model = model

    def moderate(self, text: str, model_name: str | None = None) -> ModerateResponse:
        prediction = get_model_bundle(model_name).predict(text.strip())
        return _map_prediction_to_moderation(prediction)

    def predict_raw(self, text: str, model_name: str | None = None) -> dict[str, Any]:
        return get_model_bundle(model_name).predict(text.strip())

    def compare_raw(self, text: str, model_names: list[str] | None = None) -> dict[str, Any]:
        return compare_model_predictions(text.strip(), model_names)
