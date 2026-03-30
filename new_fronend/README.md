# Analytics Dashboard

An AI-powered analytics dashboard built with React, Vite, and Tailwind CSS.

## Tech Stack

- **React 18** with TypeScript
- **Vite** — fast build tool with HMR
- **Tailwind CSS** + **shadcn/ui** — component library
- **Recharts** — data visualisations
- **Zustand** — global state management
- **React Query** — server state / data fetching
- **React Router v6** — client-side routing
- **Keycloak** — authentication & session management

## Getting Started

### Development

```bash
cd new_fronend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

Built output is in `dist/`.

### Environment Variables

Create a `.env` file (see `.env.example` in the repo root):

```
VITE_WMS_API_BASE_URL=http://localhost:8000
```

## Backend

The Django backend lives in the `backend/` directory. Start it with:

```bash
cd backend
python manage.py runserver
```

Or run the full stack with Docker Compose:

```bash
docker compose up -d
```
