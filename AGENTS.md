# AGENTS.md

## Project Overview

This backend powers a social networking application inspired by Threads.
It provides APIs and real-time capabilities for authentication, user profiles,
posts, replies, reactions, follows, conversations, messages, notifications,
uploads, and moderation placeholders.

The mobile client is built with Flutter. The backend must expose stable,
mobile-friendly APIs and avoid assumptions tied to a web-only client.

AI moderation will be integrated later. The first phase must only reserve
moderation-related fields and interfaces.

## Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Socket.IO
- JWT authentication
- Flutter client

Do not introduce additional backend technologies, frameworks, queues, ORMs,
databases, authentication providers, or moderation services unless explicitly
approved.

## Architecture

Use a module-based NestJS architecture.

Each domain should be implemented as a dedicated module with clear boundaries:

- `*.module.ts` wires dependencies.
- `*.controller.ts` exposes HTTP endpoints.
- `*.service.ts` contains business logic.
- DTOs define request validation and response shapes.
- Guards, interceptors, pipes, and decorators should be reusable where possible.
- Prisma access should be centralized through the existing Prisma service.

Keep modules cohesive. Do not place unrelated business logic in shared modules.
Shared utilities should stay small and generic.

## Code Rules

- Use TypeScript strict, explicit, readable code.
- Prefer dependency injection over manual instantiation.
- Keep controllers thin; put business logic in services.
- Use DTOs for request payloads and query parameters.
- Avoid leaking Prisma models directly when a stable API response shape is needed.
- Keep naming consistent with NestJS and Prisma conventions.
- Do not implement multiple large modules in one step.
- Write or update tests for meaningful business behavior.
- Avoid unrelated refactors while working on a specific module.

## Prisma and Database Rules

- PostgreSQL is the source of truth.
- Use Prisma schema models for database structure.
- Prefer explicit relations and indexes for query-heavy fields.
- Use UUIDs or the project-approved ID strategy consistently.
- Add `createdAt` and `updatedAt` to persistent business entities.
- Use nullable fields intentionally; do not make fields optional without a reason.
- Use transactions for multi-write operations that must succeed or fail together.
- Avoid raw SQL unless Prisma cannot express the required operation clearly.
- Migrations must be reviewed before applying to shared environments.
- Do not delete production data physically when soft delete is required.

## Authentication and Authorization Rules

- Use JWT authentication.
- Protected endpoints must use authentication guards.
- Authorization must be enforced in services or guards before data mutation.
- Users may only modify resources they own unless a role-based rule explicitly allows otherwise.
- Never trust user IDs from request bodies when the authenticated user is available from the token.
- Do not expose password hashes, refresh tokens, internal auth metadata, or sensitive security fields.
- Token payloads should stay minimal and stable.

## API Response Rules

- Responses must be consistent across modules.
- Use clear success and error shapes.
- Return stable IDs, timestamps, and public user-facing fields.
- Use pagination for list endpoints.
- Prefer cursor pagination for feeds, timelines, messages, and notifications.
- Do not expose internal database implementation details.
- Error messages should be useful but must not leak sensitive information.

## Validation Rules

- Validate all request bodies, params, and query strings through DTOs.
- Use `class-validator` and `class-transformer` patterns where applicable.
- Reject invalid enum values, malformed IDs, invalid pagination limits, and empty required content.
- Normalize inputs where appropriate, such as trimming text fields.
- Enforce server-side validation even if the Flutter client also validates input.

## Soft Delete Rules

- Use soft delete for user-generated content where historical integrity matters.
- Soft-deleted records should include a deletion marker such as `deletedAt`.
- Default read queries must exclude soft-deleted records unless explicitly required.
- Preserve relationships needed for feeds, replies, messages, notifications, audits, and moderation.
- Do not physically delete posts, replies, messages, or users unless the feature explicitly requires hard deletion.

## AI Moderation Rule

Do not integrate AI moderation in the initial phase.

Only reserve moderation fields where needed:

- `moderationStatus`
- `moderationScore`
- `moderationReason`

Moderation status should support a placeholder workflow such as pending,
approved, rejected, or flagged. Do not call external AI services, create AI
pipelines, or block core product development on moderation automation yet.

## Module Rules

### Auth

- Handle registration, login, token issuance, and authenticated user lookup.
- Hash passwords securely using the project-approved approach.
- Never return password hashes or sensitive token metadata.
- Keep JWT payloads small.
- Use guards for protected routes.

### Users

- Manage public profiles and authenticated user profile updates.
- Keep public profile responses separate from private account data.
- Support lookup by ID and username when required.
- Enforce ownership for profile updates.
- Respect soft delete and account status rules.

### Posts

- Represent top-level user posts.
- Support creating, reading, listing, updating, and soft deleting posts.
- Enforce author ownership for updates and deletes.
- Include moderation placeholder fields.
- Design list APIs for feed-style pagination.

### Replies

- Represent replies to posts or other supported parent content.
- Enforce valid parent relationships.
- Support create, read, list, update, and soft delete.
- Enforce author ownership for updates and deletes.
- Include moderation placeholder fields.

### Reactions

- Represent user reactions to posts or replies.
- Prevent duplicate active reactions for the same user and target.
- Support adding, changing, and removing reactions.
- Keep reaction counts consistent with target content.
- Use transactions when count updates and reaction writes must stay consistent.

### Follows

- Represent user-to-user follow relationships.
- Prevent users from following themselves.
- Prevent duplicate active follow relationships.
- Support follow, unfollow, follower list, following list, and counts.
- Use indexes for follower and following lookups.

### Conversations

- Represent private conversation containers.
- Support direct and future group conversation structures only if required by spec.
- Enforce participant authorization for all conversation access.
- Keep conversation list APIs optimized for mobile inbox views.
- Store enough metadata for last message previews when required.

### Messages

- Represent messages inside conversations.
- Enforce sender membership in the conversation.
- Support real-time delivery through Socket.IO after persistence succeeds.
- Include read/delivery state only when specified.
- Include moderation placeholder fields if messages are subject to moderation.
- Use pagination for message history.

### Notifications

- Represent system notifications for social actions and messaging events.
- Support list, unread count, mark as read, and mark all as read.
- Notifications must belong to a recipient user.
- Avoid generating duplicate notifications for the same event.
- Use cursor pagination for notification lists.

### Uploads

- Handle upload metadata and file ownership rules.
- Validate file type, size, and target usage according to spec.
- Do not expose internal storage paths directly.
- Associate uploaded media with users and content only after validation.
- Keep storage implementation replaceable unless a specific storage provider is approved.

### Moderation Placeholder

- Provide only schema fields, enums, DTO fields, and simple status handling needed by current modules.
- Do not implement AI moderation calls.
- Do not introduce moderation queues, workers, third-party APIs, or model providers.
- Keep moderation logic simple and ready for future integration.
