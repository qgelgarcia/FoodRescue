# FoodRescue Monorepo

A campus food rescue platform connecting surplus food donors with students and community claimants.

## Project Structure

```text
FoodRescue/
├── apps/
│   ├── frontend/        # Ionic + React client application (Vite)
│   └── backend/         # Node.js + Express TypeScript REST API with Supabase
├── packages/
│   └── shared/          # Shared TypeScript models, enums, interfaces, and API types
├── supabase/            # Supabase configuration and migrations
│   └── migrations/      # SQL migration scripts
├── docs/                # Architecture, database schema, phases, and specs documentation
├── package.json         # Monorepo root workspaces configuration
└── .gitignore
```

## Available Scripts

From the repository root:

- `npm run dev` — Concurrently starts both backend and frontend development servers.
- `npm run dev:frontend` — Starts the frontend dev server at `http://127.0.0.1:5173`.
- `npm run dev:backend` — Starts the Express backend API in watch mode with `tsx`.
- `npm run build` — Builds the shared package, backend, and frontend.
- `npm run build:frontend` — Builds the frontend for production.
- `npm run build:backend` — Compiles the backend TypeScript into `dist/`.
- `npm run build:shared` — Compiles the shared TypeScript types.
- `npm run start:backend` — Runs the compiled backend server.
