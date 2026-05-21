from __future__ import annotations

import os
from dataclasses import dataclass

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

DEFAULT_MAX_LENGTH = 256
DEFAULT_VIHSD_MODEL_ID = "iamwindd/vihsd-visobert"
DEFAULT_VIRCD_MODEL_ID = "iamwindd/vircd-phobert"


@dataclass(frozen=True)
class ClassifierDefinition:
    model_id: str
    labels: dict[int, str]
    warning_labels: set[str]
    prefer_fast_tokenizer: bool


VIHSD_DEFINITION = ClassifierDefinition(
    model_id=os.getenv("HF_VIHSD_MODEL_ID", DEFAULT_VIHSD_MODEL_ID),
    labels={
        0: "clean",
        1: "offensive",
        2: "hate",
    },
    warning_labels={"offensive", "hate"},
    prefer_fast_tokenizer=True,
)

VIRCD_DEFINITION = ClassifierDefinition(
    model_id=os.getenv("HF_VIRCD_MODEL_ID", DEFAULT_VIRCD_MODEL_ID),
    labels={
        0: "other",
        1: "discrimination",
        2: "supportive",
    },
    warning_labels={"discrimination"},
    prefer_fast_tokenizer=False,
)


def _normalize_label(raw_label: str | int | None, labels: dict[int, str], pred_id: int) -> str:
    if raw_label is None:
        return labels[pred_id]

    label_text = str(raw_label).strip()
    if label_text == "LABEL_0":
        return labels[0]
    if label_text == "LABEL_1":
        return labels[1]
    if label_text == "LABEL_2":
        return labels[2]

    normalized = label_text.lower()
    return normalized if normalized in labels.values() else labels[pred_id]


def _get_max_length() -> int:
    raw_value = os.getenv("MAX_LENGTH", str(DEFAULT_MAX_LENGTH))
    try:
        value = int(raw_value)
    except ValueError as error:
        raise RuntimeError("MAX_LENGTH must be an integer.") from error

    if value < 32 or value > 1024:
        raise RuntimeError("MAX_LENGTH must be between 32 and 1024.")

    return value


@dataclass(frozen=True)
class LoadedClassifier:
    definition: ClassifierDefinition
    max_length: int
    device: torch.device
    tokenizer: AutoTokenizer
    model: AutoModelForSequenceClassification

    @property
    def model_id(self) -> str:
        return self.definition.model_id

    def predict(self, text: str) -> dict[str, object]:
        encoded = self.tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        encoded = {key: value.to(self.device) for key, value in encoded.items()}

        with torch.no_grad():
            outputs = self.model(**encoded)
            logits = outputs.logits
            probabilities_tensor = torch.softmax(logits, dim=-1)[0].detach().cpu()

        pred_id = int(torch.argmax(probabilities_tensor).item())
        id2label = getattr(self.model.config, "id2label", {}) or {}
        label = _normalize_label(
            id2label.get(pred_id) or id2label.get(str(pred_id)),
            self.definition.labels,
            pred_id,
        )

        probabilities = {
            self.definition.labels[index]: float(probabilities_tensor[index])
            for index in range(len(probabilities_tensor))
        }

        return {
            "pred_id": pred_id,
            "label": label,
            "confidence": float(probabilities_tensor[pred_id]),
            "probabilities": probabilities,
            "is_warning": label in self.definition.warning_labels,
        }


@dataclass(frozen=True)
class LoadedModels:
    device: torch.device
    max_length: int
    vihsd: LoadedClassifier
    vircd: LoadedClassifier


def _load_tokenizer(model_id: str, prefer_fast_tokenizer: bool):
    tokenizer_error: Exception | None = None

    for use_fast in (prefer_fast_tokenizer, not prefer_fast_tokenizer):
        try:
            return AutoTokenizer.from_pretrained(model_id, use_fast=use_fast)
        except Exception as error:
            tokenizer_error = error

    raise RuntimeError(f"Could not load tokenizer for {model_id}: {tokenizer_error}")


def _load_classifier(
    definition: ClassifierDefinition,
    max_length: int,
    device: torch.device,
) -> LoadedClassifier:
    tokenizer = _load_tokenizer(definition.model_id, definition.prefer_fast_tokenizer)
    model = AutoModelForSequenceClassification.from_pretrained(definition.model_id)
    model.to(device)
    model.eval()

    return LoadedClassifier(
        definition=definition,
        max_length=max_length,
        device=device,
        tokenizer=tokenizer,
        model=model,
    )


def load_models() -> LoadedModels:
    max_length = _get_max_length()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    vihsd = _load_classifier(VIHSD_DEFINITION, max_length, device)
    vircd = _load_classifier(VIRCD_DEFINITION, max_length, device)

    return LoadedModels(
        device=device,
        max_length=max_length,
        vihsd=vihsd,
        vircd=vircd,
    )
