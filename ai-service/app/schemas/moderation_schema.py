from pydantic import BaseModel, ConfigDict, Field


class ModerateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    text: str = Field(..., min_length=1, max_length=5000)
    model_name: str | None = None


class PredictRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    text: str = Field(..., min_length=1, max_length=5000)
    model_name: str | None = None


class CompareRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    text: str = Field(..., min_length=1, max_length=5000)
    model_names: list[str] | None = None


class Highlight(BaseModel):
    text: str
    type: str
    start: int
    end: int


class ModerateResponse(BaseModel):
    label: str
    toxicityScore: float
    categories: list[str]
    message: str
    highlights: list[Highlight]
    suggestion: str
    model: str


class PredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    input_text: str
    model_name: str
    model_dir: str
    model_source: str
    predicted_label_id: int
    predicted_label_name: str
    p_clean: float
    p_offensive: float
    p_hate: float
    toxic_prob: float
    toxic_severity_score: float
    moderation_status: str
