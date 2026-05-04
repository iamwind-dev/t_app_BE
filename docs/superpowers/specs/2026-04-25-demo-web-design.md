# Demo Web Design

## Goal

Add a browser demo page inside the existing NestJS backend so the current API
surface can be exercised without a separate frontend project. The page is for
local development and manual QA, not production UI.

## Scope

The demo covers only features already implemented by the backend:

- Health check
- Authentication: register, login, current user
- Users: lookup by ID, lookup by username, update current profile, list posts
- Posts: create, feed, detail, update, soft delete
- Reactions: like and unlike posts or replies when IDs are available
- Uploads: local image upload
- Notifications: list, mark one read, mark all read
- Chat: direct conversation, list conversations, message history, Socket.IO
  join/send/typing/mark-seen events

The demo will not create placeholder UIs for modules without implemented API
routes.

## Architecture

Use static files served by the existing NestJS application:

- Add a small demo controller that serves `public/demo/index.html` at `/demo`.
- Serve static demo assets under `/demo-assets`.
- Keep the frontend dependency-free: plain HTML, CSS, and browser JavaScript.
- Use the Socket.IO browser client from the installed `socket.io` package if it
  can be served locally from `node_modules`; otherwise, show a clear realtime
  warning while keeping HTTP chat actions usable.

This avoids adding frontend frameworks, build tooling, databases, queues, or new
backend technologies.

## UI

The first screen is a compact operations-style dashboard. A sidebar lists these
sections:

- Health
- Auth
- Users
- Posts
- Reactions
- Uploads
- Notifications
- Chat

Each section contains forms for the relevant endpoint group and a response area
showing request method, path, status code, and formatted JSON.

The app stores the active JWT access token in `localStorage`. Requests add
`Authorization: Bearer <token>` automatically when a token is present.

## Data Flow

All HTTP requests use same-origin relative URLs, so local development works at
`http://localhost:3000/demo` with no extra CORS setup.

The demo keeps a small client-side state object for:

- active token
- active user
- last created or selected post ID
- last uploaded image URL
- active conversation ID
- Socket.IO connection status

Forms allow manual override of IDs so the user can test arbitrary records.

## Error Handling

Every request renders its HTTP status and response body. Network failures render
the thrown browser error. Protected endpoints show a token reminder when no
token is stored.

Socket.IO failures render connection and event errors in the Chat section.

## Testing

Verification will include:

- `npm run build`
- `npx prisma migrate status --schema prisma/schema.prisma`
- starting the backend
- `GET /demo` returns `200`
- `GET /demo-assets/app.js` returns `200`
- `GET /health` returns `200`

Manual smoke testing should register or login a user, call `/auth/me`, create a
post, fetch the feed, and open the Chat panel.
