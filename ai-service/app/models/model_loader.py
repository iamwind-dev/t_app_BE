from __future__ import annotations

import gc
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import torch
import transformers.utils.import_utils as transformers_import_utils
from transformers import AutoModelForSequenceClassification, AutoTokenizer, XLMRobertaConfig

# Avoid broken local torchvision installs affecting NLP-only Transformers imports.
transformers_import_utils._torchvision_available = False

DEFAULT_MODEL_ROOT = Path("./model/model")
ALT_MODEL_ROOTS = [Path("./model"), Path("../model")]
PREFERRED_MODEL_NAMES = [
    "mask_full_token",
    "mask_category_token",
    "base_original",
    "mask_partial_char",
    "mask_mixed_original_full",
]
PUBLIC_MODELS = [
    {
        "name": "nd-khoa/vihsd-uit-visobert-v2",
        "path": "nd-khoa/vihsd-uit-visobert-v2",
        "source": "hf",
    },
]
MODEL_DIR_ENV = os.getenv("MODEL_DIR")
MODEL_NAME_ENV = os.getenv("MODEL_NAME")
TOXIC_THRESHOLD = 0.5
HATE_THRESHOLD = 0.5
MAX_LENGTH = 128

LABEL_NAMES = {
    0: "clean",
    1: "offensive",
    2: "hate",
}


@dataclass(frozen=True)
class ModelRef:
    name: str
    load_path: Path | str
    source: str


def _candidate_roots() -> list[Path]:
    roots: list[Path] = []
    if MODEL_DIR_ENV:
        model_dir = Path(MODEL_DIR_ENV).expanduser()
        roots.append(model_dir.parent if model_dir.name else model_dir)

    roots.extend([DEFAULT_MODEL_ROOT, *ALT_MODEL_ROOTS])

    unique_roots: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        normalized = str(root.resolve()) if root.exists() else str(root)
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_roots.append(root)
    return unique_roots


def has_hf_model_files(model_dir: Path) -> bool:
    """Return True when a directory looks like a saved HuggingFace model."""
    if not model_dir.exists() or not model_dir.is_dir():
        return False
    has_weight = any(
        (model_dir / name).exists()
        for name in ["model.safetensors", "pytorch_model.bin", "tf_model.h5"]
    )
    has_tokenizer = any(
        (model_dir / name).exists()
        for name in ["tokenizer.json", "sentencepiece.bpe.model", "tokenizer_config.json"]
    )
    return has_weight and has_tokenizer


def _local_model_candidates(model_name: str) -> list[Path]:
    safe_name = Path(model_name).name
    if safe_name != model_name:
        raise RuntimeError(f"Invalid model_name: {model_name}")

    return [root / safe_name for root in _candidate_roots()]


def discover_available_models() -> list[dict[str, str]]:
    """List local model directories plus configured public HuggingFace models."""
    models: list[dict[str, str]] = []
    known: set[str] = set()

    for root in _candidate_roots():
        if not root.exists():
            continue

        ordered_names = [*PREFERRED_MODEL_NAMES]
        ordered_names.extend(
            sorted(
                path.name
                for path in root.iterdir()
                if path.is_dir() and path.name not in ordered_names
            )
        )

        for model_name in ordered_names:
            model_dir = root / model_name
            if not has_hf_model_files(model_dir):
                continue

            model_key = f"local:{model_name}"
            if model_key in known:
                continue

            known.add(model_key)
            models.append(
                {
                    "name": model_name,
                    "path": str(model_dir.resolve()),
                    "source": "local",
                }
            )

    for public_model in PUBLIC_MODELS:
        models.append(public_model)

    return models


def _resolve_local_default_model() -> ModelRef | None:
    for root in _candidate_roots():
        if not root.exists():
            continue

        for model_name in PREFERRED_MODEL_NAMES:
            candidate = root / model_name
            if has_hf_model_files(candidate):
                return ModelRef(name=model_name, load_path=candidate, source="local")

        for candidate in root.iterdir():
            if candidate.is_dir() and has_hf_model_files(candidate):
                return ModelRef(name=candidate.name, load_path=candidate, source="local")

    return None


def resolve_model_ref(model_name: str | None = None) -> ModelRef:
    """Resolve a selected, env, or default model to a loadable model reference."""
    if model_name:
        for public_model in PUBLIC_MODELS:
            if model_name == public_model["name"]:
                return ModelRef(
                    name=public_model["name"],
                    load_path=public_model["path"],
                    source=public_model["source"],
                )

        for candidate in _local_model_candidates(model_name):
            if has_hf_model_files(candidate):
                return ModelRef(name=model_name, load_path=candidate, source="local")

        raise RuntimeError(f"Selected model is not available or invalid: {model_name}")

    if MODEL_DIR_ENV:
        model_dir = Path(MODEL_DIR_ENV).expanduser()
        if has_hf_model_files(model_dir):
            return ModelRef(name=model_dir.name, load_path=model_dir, source="local")

    if MODEL_NAME_ENV:
        return resolve_model_ref(MODEL_NAME_ENV)

    local_default = _resolve_local_default_model()
    if local_default is not None:
        return local_default

    preferred_paths = "\n".join(
        f"- {root / name}" for root in _candidate_roots() for name in PREFERRED_MODEL_NAMES
    )
    raise RuntimeError(
        "No valid HuggingFace model directory found. Set MODEL_DIR, or put config.json "
        "and model.safetensors/pytorch_model.bin in one of:\n"
        f"{preferred_paths}"
    )


def model_load_path_text(load_path: Path | str) -> str:
    if isinstance(load_path, Path):
        return str(load_path.resolve())
    return load_path


class ModelBundle:
    """Loaded tokenizer/model bundle kept in memory for all requests."""

    def __init__(self, model_ref: ModelRef):
        self.model_ref = model_ref
        self.model_dir = model_ref.load_path
        self.model_name = model_ref.name
        self.source = model_ref.source
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = self._load_tokenizer(model_ref)
        self.model = self._load_model(model_ref, self.tokenizer)
        self.model.to(self.device)
        self.model.eval()

    @staticmethod
    def _validate_model_dir(model_dir: Path) -> None:
        if not model_dir.exists():
            raise RuntimeError(f"Model directory not found: {model_dir.resolve()}")
        has_weight = any(
            (model_dir / name).exists()
            for name in ["model.safetensors", "pytorch_model.bin", "tf_model.h5"]
        )
        if not has_weight:
            raise RuntimeError(
                f"Missing model weights in {model_dir.resolve()}. "
                "Expected model.safetensors or pytorch_model.bin."
            )
        has_tokenizer = any(
            (model_dir / name).exists()
            for name in ["tokenizer.json", "sentencepiece.bpe.model", "tokenizer_config.json"]
        )
        if not has_tokenizer:
            raise RuntimeError(
                f"Missing tokenizer files in {model_dir.resolve()}. "
                "Expected tokenizer.json, sentencepiece.bpe.model, or tokenizer_config.json."
            )

    @classmethod
    def _load_tokenizer(cls, model_ref: ModelRef):
        if isinstance(model_ref.load_path, Path):
            cls._validate_model_dir(model_ref.load_path)
        try:
            return AutoTokenizer.from_pretrained(model_ref.load_path, use_fast=True)
        except Exception as fast_error:
            try:
                return AutoTokenizer.from_pretrained(model_ref.load_path, use_fast=False)
            except Exception as slow_error:
                raise RuntimeError(
                    "Could not load tokenizer from "
                    f"{model_load_path_text(model_ref.load_path)}. Fast tokenizer error: {fast_error}. "
                    f"Slow tokenizer error: {slow_error}"
                ) from slow_error

    @staticmethod
    def _fallback_visobert_config(tokenizer) -> XLMRobertaConfig:
        """Build a local VisoBERT-compatible config when config.json is missing."""
        return XLMRobertaConfig(
            vocab_size=len(tokenizer),
            hidden_size=768,
            num_hidden_layers=12,
            num_attention_heads=12,
            intermediate_size=3072,
            hidden_act="gelu",
            hidden_dropout_prob=0.1,
            attention_probs_dropout_prob=0.1,
            max_position_embeddings=514,
            type_vocab_size=2,
            initializer_range=0.02,
            layer_norm_eps=1e-5,
            pad_token_id=1,
            bos_token_id=0,
            eos_token_id=2,
            num_labels=3,
            id2label={0: "clean", 1: "offensive", 2: "hate"},
            label2id={"clean": 0, "offensive": 1, "hate": 2},
        )

    @classmethod
    def _load_model(cls, model_ref: ModelRef, tokenizer):
        if isinstance(model_ref.load_path, Path):
            cls._validate_model_dir(model_ref.load_path)
        try:
            if not isinstance(model_ref.load_path, Path) or (model_ref.load_path / "config.json").exists():
                return AutoModelForSequenceClassification.from_pretrained(model_ref.load_path)
            config = cls._fallback_visobert_config(tokenizer)
            return AutoModelForSequenceClassification.from_pretrained(model_ref.load_path, config=config)
        except Exception as error:
            raise RuntimeError(
                f"Could not load model from {model_load_path_text(model_ref.load_path)}: {error}"
            ) from error

    def predict(self, text: str) -> dict[str, Any]:
        inputs = self.tokenizer(
            text,
            truncation=True,
            padding="max_length",
            max_length=MAX_LENGTH,
            return_tensors="pt",
        )
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            logits = self.model(**inputs).logits
            probs = torch.softmax(logits, dim=-1)[0].detach().cpu()

        p_clean = float(probs[0])
        p_offensive = float(probs[1])
        p_hate = float(probs[2])
        predicted_label_id = int(torch.argmax(probs).item())
        toxic_prob = p_offensive + p_hate
        toxic_severity_score = 0.5 * p_offensive + p_hate

        if toxic_prob < TOXIC_THRESHOLD:
            moderation_status = "safe"
        elif p_hate >= HATE_THRESHOLD:
            moderation_status = "high_risk_hate"
        else:
            moderation_status = "toxic_offensive"

        return {
            "input_text": text,
            "model_name": self.model_name,
            "model_dir": model_load_path_text(self.model_dir),
            "model_source": self.source,
            "predicted_label_id": predicted_label_id,
            "predicted_label_name": LABEL_NAMES.get(predicted_label_id, "unknown"),
            "p_clean": p_clean,
            "p_offensive": p_offensive,
            "p_hate": p_hate,
            "toxic_prob": toxic_prob,
            "toxic_severity_score": toxic_severity_score,
            "moderation_status": moderation_status,
        }


@dataclass(frozen=True)
class LoadedModel:
    name: str
    source: str


_model_lock = threading.Lock()

try:
    AVAILABLE_MODELS = discover_available_models()
    RESOLVED_MODEL_REF = resolve_model_ref()
    _active_model_bundle: ModelBundle | None = ModelBundle(RESOLVED_MODEL_REF)
    STARTUP_ERROR: str | None = None
except Exception as error:
    AVAILABLE_MODELS = discover_available_models()
    RESOLVED_MODEL_REF = None
    _active_model_bundle = None
    STARTUP_ERROR = str(error)


def load_model() -> LoadedModel:
    if _active_model_bundle is not None:
        return LoadedModel(name=_active_model_bundle.model_name, source=_active_model_bundle.source)

    fallback_name = RESOLVED_MODEL_REF.name if RESOLVED_MODEL_REF is not None else "unavailable"
    return LoadedModel(name=fallback_name, source="error")


def get_startup_error() -> str | None:
    return STARTUP_ERROR


def get_available_models() -> list[dict[str, str]]:
    return AVAILABLE_MODELS


def get_model_bundle(model_name: str | None = None) -> ModelBundle:
    """Return the active model bundle, loading a selected model on demand."""
    global _active_model_bundle, STARTUP_ERROR

    requested_ref = resolve_model_ref(model_name)
    with _model_lock:
        if _active_model_bundle is not None and _active_model_bundle.model_ref == requested_ref:
            return _active_model_bundle

        new_bundle = ModelBundle(requested_ref)
        old_bundle = _active_model_bundle
        _active_model_bundle = new_bundle
        STARTUP_ERROR = None

        del old_bundle
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        return _active_model_bundle


def available_model_names() -> list[str]:
    return [model["name"] for model in AVAILABLE_MODELS]


def compare_model_predictions(text: str, model_names: list[str] | None = None) -> dict[str, Any]:
    selected_model_names = model_names or available_model_names()
    results = []

    for model_name in selected_model_names:
        try:
            prediction = get_model_bundle(model_name).predict(text)
            results.append({"status": "ok", **prediction})
        except Exception as error:
            results.append(
                {
                    "status": "error",
                    "model_name": model_name,
                    "error": str(error),
                }
            )

    return {
        "input_text": text,
        "results": results,
    }
