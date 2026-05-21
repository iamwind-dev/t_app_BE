from __future__ import annotations

import re

from app.models.model_loader import LoadedClassifier, LoadedModels
from app.schemas.moderation_schema import ModerateResponse, ModerationLayerResponse

ACTION_ALLOW = "ALLOW"
ACTION_WARN = "WARN_USER"
ACTION_BLOCK = "BLOCK_OR_REVIEW"

MULTI_WHITESPACE_PATTERN = re.compile(r"\s+")


class ModerationService:
    def __init__(self, models: LoadedModels) -> None:
        self._models = models

    @property
    def device(self) -> str:
        return str(self._models.device)

    @property
    def layer_1_model_id(self) -> str:
        return self._models.vihsd.model_id

    @property
    def layer_2_model_id(self) -> str:
        return self._models.vircd.model_id

    def moderate(self, text: str) -> ModerateResponse:
        normalized_text = self.normalize_text(text)
        if not normalized_text:
            raise ValueError("Text must not be empty.")

        layer_1 = self._predict_layer(
            classifier=self._models.vihsd,
            layer_name="layer_1_vihsd_visobert",
            task_name="hate_speech_detection",
            input_text=normalized_text,
        )
        layer_2 = self._predict_layer(
            classifier=self._models.vircd,
            layer_name="layer_2_vircd_phobert",
            task_name="regional_discrimination_detection",
            input_text=normalized_text,
        )

        final_label, final_confidence, action, is_warning = self._merge_layers(layer_1, layer_2)

        return ModerateResponse(
            text=normalized_text,
            final_label=final_label,
            final_confidence=final_confidence,
            is_warning=is_warning,
            action=action,
            layers=[layer_1, layer_2],
            model=f"{self.layer_1_model_id},{self.layer_2_model_id}",
        )

    def normalize_text(self, text: str) -> str:
        return MULTI_WHITESPACE_PATTERN.sub(" ", text.strip())

    def _predict_layer(
        self,
        classifier: LoadedClassifier,
        layer_name: str,
        task_name: str,
        input_text: str,
    ) -> ModerationLayerResponse:
        prediction = classifier.predict(input_text)
        return ModerationLayerResponse(
            layer=layer_name,
            task=task_name,
            model=classifier.model_id,
            input_text=input_text,
            pred_id=int(prediction["pred_id"]),
            label=str(prediction["label"]),
            confidence=float(prediction["confidence"]),
            probabilities={
                key: float(value)
                for key, value in dict(prediction["probabilities"]).items()
            },
            is_warning=bool(prediction["is_warning"]),
        )

    def _merge_layers(
        self,
        vihsd_layer: ModerationLayerResponse,
        vircd_layer: ModerationLayerResponse,
    ) -> tuple[str, float, str, bool]:
        if vihsd_layer.label == "hate":
            return "hate", vihsd_layer.confidence, ACTION_BLOCK, True

        if vircd_layer.label == "discrimination":
            return "discrimination", vircd_layer.confidence, ACTION_BLOCK, True

        if vihsd_layer.label == "offensive":
            return "offensive", vihsd_layer.confidence, ACTION_WARN, True

        if vihsd_layer.label == "clean" and vircd_layer.label == "supportive":
            return "supportive", vircd_layer.confidence, ACTION_ALLOW, False

        if vihsd_layer.label == "clean" and vircd_layer.label == "other":
            return "clean", vihsd_layer.confidence, ACTION_ALLOW, False

        if vircd_layer.label == "supportive":
            return "supportive", vircd_layer.confidence, ACTION_ALLOW, False

        if vircd_layer.label == "other":
            return "other", vircd_layer.confidence, ACTION_ALLOW, False

        return "clean", vihsd_layer.confidence, ACTION_ALLOW, False
