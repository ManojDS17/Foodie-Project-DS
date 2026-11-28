# PowerTech Energy — Foodie FastAPI Backend

REST API backend for the Foodie Composter platform, built with FastAPI and PostgreSQL.

## Requirements & Environment

Install dependencies inside `.venv`:

```powershell
pip install -r backend\requirements.txt
```

Create `backend/.env` from `backend/.env.example` (never commit `.env` to git):

- **Database:** `DB_HOST`, `DB_PORT`, `DB_NAME` (default `foodie_db`), `DB_USER` (`postgres`), `DB_PASSWORD`
- **Security:** `JWT_SECRET` (required, >= 32 bytes; no insecure fallback is allowed)
- **Environment Mode:** Set `ENVIRONMENT=development` locally to expose `/docs`, `/redoc`, and dev tunnel origin matching. Whenever `ENVIRONMENT` is unset or set to `production` (or `DB_NAME` is `foodie_prod` / `prod` / `production`), Swagger docs and dev regex origins are disabled automatically.
- **CORS:** `ALLOWED_ORIGINS` (comma-separated explicit frontend origins; allowed methods are restricted to `GET, POST, PUT, DELETE, OPTIONS` and allowed headers to `Content-Type, Authorization, Accept, X-Requested-With`).
- **SMTP (optional locally):** Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, and `FRONTEND_URL`. When SMTP credentials are omitted locally, outbound emails log a simulation notice instead of connecting to Brevo.

## Running Locally

From the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
```

Or launch `backend\run_fastapi.bat`.

- Base URL: `http://localhost:5000`
- Interactive Swagger UI (only when `ENVIRONMENT=development`): `http://localhost:5000/docs`

## Database Architecture

- Uses a PostgreSQL `ThreadedConnectionPool` (`minconn=1`, `maxconn=20`) configured in `backend/database.py` (tested on PostgreSQL 18.7).
- Schema changes are applied explicitly via `python -m backend.migrate` (with optional `--apply-cleanup` for controlled legacy drops); application startup (`init_db()`) checks connectivity and required schema objects read-only without running DDL or seeding demo accounts.
- Sequential client codes (`CL-0001+`) and machine codes (`C001+`) use PostgreSQL transaction-scoped advisory locks (`pg_advisory_xact_lock`) during creation to avoid race collisions without requiring extra database sequence objects.

## Live API Endpoints

- **Auth (`/api/auth`):** `POST /login`, `GET /me`, `POST /logout`, `POST /forgot-password`, `POST /verify-reset-token`, `POST /reset-password`
- **Users (`/api/users`):** `GET /`, `GET /{user_id}`, `POST /`, `PUT /{user_id}`, `DELETE /{user_id}`, `POST /{user_id}/resend-invite`, `POST /{user_id}/reset-password`
- **Organizations (`/api/organizations`):** `GET /next-code`, `GET /`, `GET /{org_id}`, `POST /`, `PUT /{org_id}`, `DELETE /{org_id}`, `POST /bulk-delete`
- **Machines (`/api/machines`):** `GET /next-code`, `GET /models`, `GET /`, `GET /{machine_id}`, `POST /`, `PUT /{machine_id}`, `DELETE /{machine_id}`, `POST /{machine_id}/unassign`, `GET /operator-assignments`, `POST /operator-assignments`, `POST /operator-assignments/{assignment_id}/revoke`
- **Machine Models Alias:** `GET /api/machine-models`
- **Dashboard & Search:** `GET /api/dashboard/stats`, `GET /api/search?q=...`
- **Health:** `GET /`

Note: Authentication uses `HttpOnly` cookie `foodie_access_token` (`Path=/api`, `SameSite=Lax`), with fallback support for `Authorization: Bearer <token>`.
