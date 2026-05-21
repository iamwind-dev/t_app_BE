from pydantic import BaseModel, ConfigDict, Field


class ModerateRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    text: str = Field(..., min_length=1, max_length=5000)


class ModerationLayerResponse(BaseModel):
    layer: str
    task: str
    model: str
    input_text: str
    pred_id: int
    label: str
    confidence: float
    probabilities: dict[str, float]
    is_warning: bool


class ModerateResponse(BaseModel):
    text: str
    final_label: str
    final_confidence: float
    is_warning: bool
    action: str
    layers: list[ModerationLayerResponse]
    model: str


class HealthResponse(BaseModel):
    status: str
    device: str


class RootResponse(BaseModel):
    service: str
    status: str
    device: str
    layer_1_model: str
    layer_2_model: str
