# Project Specification

## 1. Project Overview

This project is the backend service for a mobile-first social networking
application inspired by Threads. The system allows users to create profiles,
publish short-form posts, reply to conversations, react to content, follow other
users, exchange private messages, receive notifications, and upload media.

The backend is designed for a Flutter client and exposes HTTP APIs for standard
application workflows, with Socket.IO support for real-time messaging and
notification events.

The first development phase focuses on core social network functionality. Real
AI moderation is intentionally deferred, while moderation-related fields are
reserved for future integration.

## 2. Problem Statement

Users need a lightweight social platform where they can publish short updates,
interact with other users, follow accounts of interest, and communicate in real
time. The backend must provide a reliable foundation for these workflows while
remaining simple enough to build, test, and evolve incrementally.

The system must support a mobile client, consistent authentication, structured
data persistence, real-time communication, and future moderation expansion
without prematurely introducing external AI services.

## 3. Product Goals

- Provide secure account registration, login, and authenticated API access.
- Support public user profiles and follow relationships.
- Allow users to create posts and replies in a Threads-like interaction model.
- Support reactions on social content.
- Enable private conversations and real-time messages.
- Deliver notifications for important social and messaging events.
- Support media upload metadata and ownership rules.
- Keep the backend modular, testable, and ready for incremental feature growth.
- Reserve moderation fields for future AI moderation without integrating AI in
  the MVP.

## 4. MVP Scope

The MVP includes the core backend capabilities required for a functional
Threads-style social app:

- JWT-based authentication.
- User profile management.
- Creating, listing, updating, and soft deleting posts.
- Creating, listing, updating, and soft deleting replies.
- Reacting to posts and replies.
- Following and unfollowing users.
- Listing followers and following accounts.
- Basic feed and profile content APIs.
- Private conversations and messages.
- Socket.IO events for real-time messaging.
- Notification records and unread status.
- Upload metadata for user avatars, post media, and message media.
- Moderation placeholder fields on user-generated content.

## 5. Out of Scope

The following items are not part of the initial MVP:

- Real AI moderation or calls to AI providers.
- Recommendation algorithms.
- Full-text search.
- Advanced ranking or personalized feed scoring.
- Payment, subscription, or monetization features.
- Admin dashboards.
- Analytics pipelines.
- Background job infrastructure.
- Multi-tenant organization support.
- Third-party social login unless explicitly approved later.
- End-to-end encryption for messages.
- Web frontend implementation.

## 6. User Roles

### Guest

An unauthenticated visitor. Guests may access only public or explicitly open
endpoints, such as registration, login, and public profile/content reads if the
product allows them.

### Authenticated User

A registered user with a valid JWT. Authenticated users can manage their own
profile, create content, interact with content, follow users, send messages,
receive notifications, and manage their own resources.

### Future Moderator or Admin

Administrative or moderation roles are not part of the MVP. The system should
avoid hard-coding assumptions that would prevent adding these roles later.

## 7. Core Modules

- Auth: registration, login, JWT issuance, authenticated user context.
- Users: profiles, public user data, private account data, profile updates.
- Posts: top-level social posts and feed-facing content.
- Replies: threaded or conversational responses to posts.
- Reactions: user reactions on posts and replies.
- Follows: user-to-user follow relationships.
- Conversations: private conversation containers and participants.
- Messages: persisted messages and real-time message delivery.
- Notifications: user-facing notification records and unread state.
- Uploads: upload metadata, ownership, and media usage.
- Moderation Placeholder: reserved moderation fields and status handling.

## 8. High-Level Architecture

The backend uses a modular NestJS architecture. Each major product capability is
implemented as a dedicated module with its own controller, service, DTOs, and
domain-specific logic.

HTTP APIs handle standard request-response workflows such as authentication,
profile management, content creation, follows, reactions, conversations, and
notifications. Socket.IO handles real-time events, especially message delivery
and notification updates.

PostgreSQL is the primary database. Prisma is used as the database access layer
and schema management tool. JWT is used for authentication, and protected
operations must resolve the authenticated user from the token rather than
trusting user identifiers from client payloads.

The architecture should keep business rules inside services, controllers thin,
and database access consistent through Prisma. Modules should remain loosely
coupled so features can be developed and tested incrementally.

## 9. Main Entities

- User: account identity, authentication-related data, and profile information.
- Post: top-level user-generated content.
- Reply: response content attached to a post or supported parent content.
- Reaction: user reaction to a post or reply.
- Follow: relationship between follower and followed users.
- Conversation: private messaging context.
- ConversationParticipant: membership record for a conversation.
- Message: message content sent inside a conversation.
- Notification: event record shown to a recipient user.
- Upload: metadata for uploaded media and ownership.

User-generated content that may later be moderated should reserve:

- moderationStatus
- moderationScore
- moderationReason

Entities that require soft deletion should include a deletion marker such as
deletedAt, while preserving relationships needed for feeds, conversations,
notifications, and future audits.

## 10. Main API Groups

- Auth APIs: register, login, refresh or validate session if specified later,
  and get current authenticated user.
- User APIs: get profile, update own profile, list user content, and view public
  user information.
- Post APIs: create post, list feed posts, get post detail, update own post,
  and soft delete own post.
- Reply APIs: create reply, list replies, update own reply, and soft delete own
  reply.
- Reaction APIs: react to content, update reaction, remove reaction, and expose
  reaction counts.
- Follow APIs: follow user, unfollow user, list followers, list following, and
  expose follow counts.
- Conversation APIs: create or access conversations, list conversations, and
  manage participant-scoped reads.
- Message APIs: send message, list message history, and emit real-time message
  events.
- Notification APIs: list notifications, get unread count, mark as read, and
  mark all as read.
- Upload APIs: create upload metadata, validate ownership, and associate media
  with allowed targets.

## 11. Non-Functional Requirements

- Security: all protected operations must require valid JWT authentication.
- Authorization: users may only mutate resources they own or are allowed to
  access.
- Validation: all request bodies, params, and query strings must be validated.
- Consistency: API responses and error responses should follow stable patterns.
- Pagination: list endpoints must use pagination; feed, messages, and
  notifications should be designed for cursor-based pagination.
- Reliability: multi-write operations that must stay consistent should use
  database transactions.
- Data integrity: database relations, unique constraints, and indexes should
  support expected access patterns.
- Soft delete: user-generated content should be soft deleted when historical
  relationships must be preserved.
- Real-time behavior: Socket.IO events should be emitted only after successful
  persistence.
- Maintainability: modules should be cohesive, loosely coupled, and easy to
  test independently.
- Mobile compatibility: APIs should be stable, predictable, and efficient for a
  Flutter client.

## 12. Future AI Moderation Integration

AI moderation is planned for a later phase and must not be implemented in the
MVP. The initial system should only prepare for future moderation by reserving
moderation fields on relevant user-generated content.

Future integration may include:

- Automated moderation analysis after content creation.
- Moderation status transitions based on AI results.
- Human review workflows for flagged content.
- Admin or moderator tools.
- Audit history for moderation decisions.
- Provider-specific AI service integration.

The MVP must avoid coupling core content creation to any AI provider. Content
workflows should remain functional with simple placeholder moderation statuses
such as pending, approved, rejected, or flagged.
