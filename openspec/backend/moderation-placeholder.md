# Moderation Placeholder OpenSpec

## 1. Goal

The Moderation Placeholder module prepares the initial structure for moderation
in the Threads-like system without integrating real AI moderation yet.

Main goals:

- Provide a mock API so the Flutter client and backend can test moderation flows with a stable shape.
- Keep moderation fields already present on Post and Reply:
  - `moderationStatus`
  - `moderationScore`
  - `moderationReason`
- Do not call external AI services, third-party moderation providers, queues, workers, or asynchronous pipelines in the current phase.
- Do not change or block the current post/reply creation flow.
- Create a clear extension point for connecting to a FastAPI AI service later.

## 2. Current Scope

The current scope is only an internal placeholder in the NestJS backend.

Included:

- Create moderation module/controller/service if an API is implemented.
- Expose temporary API `POST /moderation/check`.
- Validate request body with a `text` field that is a non-empty string after trimming.
- Return a mock result with a stable shape for the client.
- Optionally support local keywords for demo purposes, but the default must be SAFE.
- Keep moderation fields on Post and Reply as metadata, not as content-creation blockers.

Not included:

- No real AI integration.
- No FastAPI service call in this phase.
- No queues, workers, cron jobs, or background processors.
- No automatic rejection, hiding, or deletion of posts/replies based on moderation.
- No change to the current create post/reply API contract.
- No need to store moderation check history in the database unless a separate requirement exists.

## 3. Future Integration

Later, this module will be the integration point for a FastAPI AI moderation
service.

Future integration direction:

- NestJS backend calls the FastAPI AI service with input text and optional metadata.
- FastAPI service returns moderation result with status, score, and reason.
- Backend maps AI result to:
  - `moderationStatus`
  - `moderationScore`
  - `moderationReason`
- The module can be extended to check posts, replies, messages, or uploaded media if product specs require it.
- It can move from synchronous checks to async workflow if moderation becomes heavy or needs manual review.

Future integration constraints:

- Must have timeout and error handling when calling the FastAPI service.
- Moderation service errors must not break the core flow unless a future spec explicitly requires fail-closed behavior.
- Do not expose prompts, model metadata, raw internal scores, or sensitive information in public responses.
- Any change that affects post/reply creation must have a separate spec and clear tests.

## 4. Mock API

### POST /moderation/check

Temporarily checks moderation for a text string.

- Access: private if the backend already has a JWT guard for internal/user APIs; if used for local demo it may be public by implementation decision, but it must not be used as a security boundary for business logic.
- Success status: `200 OK`.

#### Request Body

```json
{
  "text": "string"
}
```

#### Request Fields

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `text` | string | yes | Trim, non-empty, length limit through DTO to avoid oversized payloads |

#### Response 200

Default mock response:

```json
{
  "success": true,
  "data": {
    "status": "SAFE",
    "score": 0.99,
    "reason": null
  }
}
```

If local demo keywords are enabled, the service may return a different mock
result:

```json
{
  "success": true,
  "data": {
    "status": "FLAGGED",
    "score": 0.72,
    "reason": "Matched local demo keyword"
  }
}
```

#### Response Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | string | Mock moderation result. Current phase prioritizes `SAFE`; local keyword demo may return `FLAGGED` |
| `score` | number | Mock confidence score from 0 to 1 |
| `reason` | string/null | Mock reason when not SAFE, or null when SAFE |

## 5. Business Rules

- Current moderation check defaults to always returning `SAFE`.
- If demo behavior is needed, local keywords may return `FLAGGED`, but this logic is only for demo and is not AI moderation.
- `POST /moderation/check` must not overwrite `moderationStatus`, `moderationScore`, or `moderationReason` on Post/Reply when the request is only an independent text check.
- Current post/reply creation flow must not be blocked by the moderation placeholder.
- Post/reply creation still persists according to existing logic, with moderation fields keeping the current defaults from the Post/Reply modules.
- Do not hard delete, soft delete, hide, or reject content based on mock results.
- DTO must validate `text` to prevent empty strings and oversized payloads.
- Service must be easy to replace with a FastAPI client later without changing the controller contract.
- Error responses must follow the backend shared shape and must not expose internal information.

## 6. Test Cases

### API Validation

- `POST /moderation/check` with valid `text` returns `200 OK`.
- Missing `text` returns validation error.
- `text` that is empty or whitespace-only returns validation error.
- Non-string `text` returns validation error.
- `text` exceeding the DTO limit returns validation error.

### Mock Result

- Normal valid text returns:
  - `status: "SAFE"`
  - `score` as a number from 0 to 1
  - `reason: null`
- If local demo keywords are implemented, matching text returns a demo status such as `FLAGGED` and includes `reason`.
- If local demo keywords are not implemented, all valid text still returns `SAFE`.

### Isolation From Post/Reply Flow

- Creating a new post does not have to call `POST /moderation/check`.
- Creating a new reply does not have to call `POST /moderation/check`.
- Result from `POST /moderation/check` does not automatically update any Post/Reply.
- Mock `FLAGGED` status, if present, does not reject, hide, or delete posts/replies.

### Future Compatibility

- Controller response shape does not depend on a specific mock implementation.
- Service can be replaced with FastAPI integration while keeping the response contract: `status`, `score`, `reason`.
- Internal moderation service errors are mapped to standard error responses and do not leak stack traces or internal metadata.
