# Social Platforms (Next.js App Router)

Next.js App Router frontend using the provided Bootstrap HTML template (design preserved).

## Requirements

- Node.js `>= 20.9.0`

## Setup

1. Copy env:
   - `cp .env.example .env.local`
2. Start:
   - `npm run dev`

App runs at `http://localhost:3000`.

## Pages

- `/login`
- `/register`
- `/feed` (protected via `src/proxy.ts`)

## Backend

The Next app proxies the Express API via Route Handlers:

- `src/app/api/auth/*`
- `src/app/api/posts/*`
- `src/app/api/comments/*`

Configure the backend URL in `.env.local`:

- `BACKEND_API_URL=http://localhost:5000/api/v1`
- `NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:5000` (for rendering uploaded image URLs)

# social-platforms
