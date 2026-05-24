# Render Deployment

## Render commands

Build Command:

```bash
npm install && npx prisma generate --schema prisma/schema.prisma && npm run build
```

Pre-Deploy Command:

```bash
npx prisma migrate deploy --schema prisma/schema.prisma
```

Start Command:

```bash
npm run start:prod
```

If your Render plan or UI does not expose `Pre-Deploy Command`, use this only as a fallback:

```bash
npm install && npx prisma generate --schema prisma/schema.prisma && npx prisma migrate deploy --schema prisma/schema.prisma && npm run build
```

Do not use `prisma migrate dev` or `prisma migrate reset` in production.

If a migration fails because a table such as `DomainEventOutbox` already exists, inspect the target database and migration history first. You may need `prisma migrate resolve`, but do not run it blindly.

## Environment variables

Set these in Render Dashboard:

```env
NODE_ENV=production
DATABASE_URL=<Supabase Transaction Pooler URL>
DIRECT_URL=<Supabase Direct URL>
AI_SERVICE_URL=<Hugging Face Space URL>
AI_SERVICE_TIMEOUT_MS=30000
JWT_ACCESS_SECRET=<secret>
JWT_REFRESH_SECRET=<secret>
CORS_ORIGIN=*
SWAGGER_ENABLED=false
SWAGGER_PATH=docs
UPLOAD_STORAGE_PROVIDER=<local-or-cloudinary>
UPLOAD_LOCAL_DIR=uploads
UPLOAD_PUBLIC_BASE_URL=<public-backend-url>/uploads
UPLOAD_MAX_IMAGE_SIZE_BYTES=5242880
UPLOAD_MAX_VIDEO_SIZE_BYTES=104857600
UPLOAD_PENDING_TTL_HOURS=24
CLOUDINARY_CLOUD_NAME=<optional>
CLOUDINARY_API_KEY=<optional>
CLOUDINARY_API_SECRET=<optional>
CLOUDINARY_UPLOAD_FOLDER=threads-like
FIREBASE_PROJECT_ID=<optional>
FIREBASE_CLIENT_EMAIL=<optional>
FIREBASE_PRIVATE_KEY=<optional>
FIREBASE_SERVICE_ACCOUNT_JSON=<optional>
CHAT_ENABLE_LEGACY_CONVERSATION_ROOM=true
INTERNAL_OPS_TOKEN=<optional>
```

## Render dashboard steps

1. Render -> New -> Web Service
2. Connect the GitHub repository
3. Choose the target branch
4. If backend is in a subdirectory, set `Root Directory` to that folder. If backend is the repo root, leave it empty.
5. Runtime: `Node`
6. Build Command: `npm install && npx prisma generate --schema prisma/schema.prisma && npm run build`
7. Pre-Deploy Command: `npx prisma migrate deploy --schema prisma/schema.prisma`
8. Start Command: `npm run start:prod`
9. Add the environment variables listed above

## Local validation

```bash
npm install
npx prisma generate --schema prisma/schema.prisma
npm run build
npm run start:prod
```

Optional migration checks:

```bash
npx prisma migrate status --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
```

## Post-deploy checks

- `GET https://your-backend.onrender.com/health`
- `GET https://your-backend.onrender.com/posts/feed?limit=10`
- Socket.IO chat namespace `/`
- Socket.IO realtime namespace `/realtime`
