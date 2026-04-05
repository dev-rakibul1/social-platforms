# Social Platforms (Next.js App Router)

Next.js App Router frontend using the provided Bootstrap HTML template (design preserved).

## What I Built

This frontend turns the static template into a working social app UI with:

- login and registration
- protected feed
- profile page
- public user profile page
- create, edit, and delete post flows
- comments, replies, and likes
- image upload support through the backend API

The app talks to the backend through Next.js Route Handlers in `src/app/api/*`, which lets the browser call same-origin endpoints while the Next server forwards requests to the API.

## Decisions Made

- Preserved the supplied template structure to match the original design rather than rebuilding the UI from scratch.
- Used route handlers as a proxy layer so backend URLs and token-aware requests stay on the server side.
- Used an `httpOnly` auth cookie for protected flows.
- Kept `BACKEND_API_URL` as the only frontend environment variable to simplify Vercel deployment.

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

- `BACKEND_API_URL=https://testapi.bpsnx.com/api/v1/`

# social-platforms
