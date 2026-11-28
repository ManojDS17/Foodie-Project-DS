# Foodie Composter — Operations & Fleet Management Platform

Full-stack web application for **PowerTech Energy** to manage commercial Foodie Composter units, client leases, site administrators, and facility operators.

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, `lucide-react`
- **Backend:** FastAPI (Python), Uvicorn, Pydantic v2, PyJWT, bcrypt
- **Database:** PostgreSQL (verified on PostgreSQL 18.7) via `psycopg2-binary`

## Project Structure

- `src/` — React + TypeScript frontend (`pages/`, `components/`, `services/api.ts`, `context/AuthContext.tsx`, `hooks/`)
- `backend/` — FastAPI REST API (`main.py`, `auth.py`, `database.py`, `schemas.py`, `email_service.py`, `routers/`)

## Prerequisites

- **Node.js** (v20+ recommended; verified on v24.21.0)
- **Python** (3.11+; verified on 3.14.10)
- **PostgreSQL** (`foodie_db` database running on `localhost:5432`)

## Quick Start (Local Development)

### 1. Backend Setup

1. Create and activate a Python virtual environment at the repository root (`.venv`):
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   ```
2. Copy `backend\.env.example` to `backend\.env` and configure:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `JWT_SECRET` (cryptographically random secret, at least 32 bytes — startup refuses empty or weak secrets)
   - `ENVIRONMENT=development` (enables `/docs`, `/redoc`, and local CORS tunnel regexes; defaults safely to strict production mode when omitted)
   - Optional SMTP relay variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `FRONTEND_URL`)
3. Initialize / migrate the database schema explicitly (startup performs read-only schema compatibility checks only, and no demo users or passwords are auto-seeded):
   ```powershell
   .\.venv\Scripts\python.exe -m backend.migrate
   ```
   *(If upgrading an older development schema that still holds deprecated columns/constraints, review backups first and pass `--apply-cleanup`.)*
4. Provision an initial `OEM_MANAGER` account in PostgreSQL before signing in for the first time (no default credentials ship with the application).
5. Start FastAPI (`http://localhost:5000`, or run `backend\run_fastapi.bat`):
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
   ```

### 2. Frontend Setup

1. Install npm dependencies:
   ```powershell
   npm install
   ```
2. Start the Vite development server (`http://localhost:5173`, proxying `/api` requests to `http://127.0.0.1:5000`):
   ```powershell
   npm run dev
   ```

## Authentication, Database & Telemetry Scope

- Session tokens are issued as `HttpOnly`, `SameSite=Lax` cookies scoped to `/api` (plus optional `Authorization: Bearer <token>` support for API clients).
- Password resets store SHA-256 token digests in the database and never send plaintext passwords by email.
- Three role tiers are enforced across the UI and API: `OEM_MANAGER`, `SITE_ADMIN`, and `OPERATOR`.
- **Deferred Hardware Telemetry:** Live PLC/Modbus telemetry ingestion is not yet integrated. When telemetry tables or machine sensor feeds are absent, the API returns `null` / `telemetry_connected: false` and the UI displays `Not connected` / `—` rather than calculated or mock sensor values. Real database `0` readings are kept distinct when telemetry data exists.

## Available Scripts & Checks

- `npm run dev` — Start Vite dev server
- `npm run build` — Type-check (`tsc -b`) and build production bundle into `dist/`
- `npm run lint` — Run linter checks across `src/`
- `npx oxlint src` — Run `oxlint` static analysis
- `.\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v` — Run backend API, security, migration, and telemetry tests
