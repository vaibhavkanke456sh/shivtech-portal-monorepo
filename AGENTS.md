# Repository Guidelines

## Project Structure & Module Organization
This is a monorepo containing a full-stack web application for managing digital services.
- **`.\frontend`**: React application built with **Vite**, **TypeScript**, and **Tailwind CSS**.
- **`.\backend`**: Node.js **Express** server using **MongoDB/Mongoose** for data storage.
- **`.\shared`**: Directory intended for code shared between frontend and backend.
- **`.\src-backup-old`**: Legacy codebase kept for reference during migration.

The project follows a monorepo migration plan where frontend is deployed on **Vercel** and backend on **Render**.

## Build, Test, and Development Commands

### Root Commands
- **Install all dependencies**: `npm run install:all`
- **Frontend development**: `npm run dev` or `npm run dev:frontend`
- **Backend development**: `npm run dev:backend` (uses nodemon)
- **Production build (Frontend)**: `npm run build`
- **Production start (Backend)**: `npm start`
- **Linting**: `npm run lint`

### Backend Specifics
- **Seed database**: `npm run seed` (seeds initial users and roles)
- **Environment**: Requires `.\backend\.env` (see `.\backend\env.example`)

### Frontend Specifics
- **Environment**: Requires `.\frontend\.env` (see `.\frontend\.env.example`)

## Coding Style & Naming Conventions
- **Linter**: **ESLint** is configured for both root and frontend, enforcing React and TypeScript recommended rules.
- **TypeScript**: Strictly used in the frontend (`.\tsconfig.json`).
- **Formatting**: Mimic existing patterns; maintain consistent indentation (2 spaces) as seen in configuration files.

## Testing Guidelines
There is currently no formal testing framework implemented. The backend `npm test` script is a placeholder.

## Commit & Pull Request Guidelines
Commit messages should be concise and descriptive. Based on history, common patterns include:
- `fix: <description>` for bug fixes.
- `feat: <description>` for new features.
- Direct descriptions like `bug fixed <location>` or `now <feature> works fine` are also common.
- Avoid generic "Describe your changes" messages.
