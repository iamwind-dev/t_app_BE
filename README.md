# Threads-like Backend

NestJS backend cho ung dung social networking theo huong Threads-like.

## Tech Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- JWT auth
- Socket.IO

## Yeu cau moi truong

- Node.js 20+
- npm 10+
- PostgreSQL 15+ hoac 1 database Postgres remote

## 1. Cai dependencies

```bash
npm install
```

## 2. Tao file env

Tao file `.env` tu `.env.example`:

```bash
cp .env.example .env
```

Neu dung PowerShell:

```powershell
Copy-Item .env.example .env
```

Cap nhat cac bien quan trong trong `.env`:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/threads_like?schema=public
JWT_ACCESS_SECRET=replace-with-a-strong-secret
JWT_ACCESS_EXPIRES_IN=1h
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
SWAGGER_ENABLED=true
SWAGGER_PATH=docs
UPLOAD_STORAGE_PROVIDER=local
UPLOAD_LOCAL_DIR=uploads
UPLOAD_PUBLIC_BASE_URL=http://localhost:3000/uploads
UPLOAD_MAX_IMAGE_SIZE_BYTES=5242880
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Luu y:

- `DATABASE_URL` phai tro dung toi PostgreSQL.
- `JWT_ACCESS_SECRET` can doi sang secret rieng, khong dung gia tri mau.
- Neu dang chay local upload, nen dung `UPLOAD_PUBLIC_BASE_URL=http://localhost:3000/uploads`.
- `.env` da nam trong `.gitignore`, khong commit file nay.

## 3. Chuan bi database

Validate schema Prisma:

```bash
npm run prisma:validate
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Chay migration cho moi truong local:

```bash
npm run prisma:migrate:dev
```

Neu database da co schema san roi, van nen chay `prisma:generate` truoc khi start app.

## 4. Chay backend

Development:

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start:prod
```

Mac dinh server chay tai:

```text
http://localhost:3000
```

## 5. Kiem tra nhanh sau khi start

- Health check: `GET http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/docs`

Neu `SWAGGER_ENABLED=false` thi route docs se khong duoc mo.

## 6. Upload anh local

Khi:

- `UPLOAD_STORAGE_PROVIDER=local`
- `UPLOAD_LOCAL_DIR=uploads`

thi file upload se duoc luu trong thu muc `uploads/` cua project va expose qua:

```text
http://localhost:3000/uploads
```

Backend hien tai chap nhan cac dinh dang:

- `image/jpeg`
- `image/png`
- `image/webp`

Gioi han mac dinh:

- 5 MB moi file

## 7. Test va lint

Lint:

```bash
npm run lint
```

Unit test:

```bash
npm test
```

E2E test:

```bash
npm run test:e2e
```

## 8. Cau truc chinh

```text
src/
  auth/
  users/
  posts/
  replies/
  reactions/
  chat/
  notifications/
  uploads/
  prisma/
prisma/
  schema.prisma
  migrations/
test/
```

## 9. Troubleshooting

### Loi ket noi database

Kiem tra:

- `DATABASE_URL` dung format Postgres
- database dang mo va cho phep ket noi
- migration da duoc chay

### Loi JWT

Kiem tra:

- `JWT_ACCESS_SECRET` khong rong
- client gui Bearer token dung format

### Loi upload anh

Kiem tra:

- `UPLOAD_PUBLIC_BASE_URL` dung host/port hien tai
- thu muc `uploads/` co quyen ghi
- file khong vuot qua `UPLOAD_MAX_IMAGE_SIZE_BYTES`

## 10. Lenh hay dung

```bash
npm install
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:dev
npm run start:dev
npm run lint
npm test
npm run test:e2e
```
