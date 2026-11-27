# Foodie Composter Operations API — FastAPI (Python 3.11)

Production-grade REST API backend built with **FastAPI**, **Pydantic v2**, and **PostgreSQL (`foodie_db`)**.

---

## 1. Quick Start

### Option A: 1-Click Startup (Windows)
Double-click:
```
backend\run_fastapi.bat
```

### Option B: Command Line
```powershell
# From the project root:
py -3.11 -m uvicorn backend.main:app --host 0.0.0.0 --port 5000 --reload
```

- **API Base URL**: `http://localhost:5000`
- **Interactive Swagger Documentation**: `http://localhost:5000/docs`
- **Alternative ReDoc Documentation**: `http://localhost:5000/redoc`

---

## 2. Default Seeded Credentials (Local Non-Production Only)

When running locally (`ENVIRONMENT != production` and `DB_NAME != foodie_prod`), `init_db()` seeds sample dev users (`oem@gmail.com`, `siteadmin@gmail.com`, `operator@gmail.com`) via `seed_demo_data()` in `backend/database.py`. Update or remove seeded accounts before exposing any shared environment.

---

## 3. Environment & Database Connection (`database.py`, `auth.py`)
Copy `backend/.env.example` to `backend/.env` and configure all secrets locally (never commit `.env` or real passwords):
- **Database Engine**: PostgreSQL
- **Database Name**: `DB_NAME` (default `foodie_db`)
- **Host / Port**: `DB_HOST` (`localhost`) / `DB_PORT` (`5432`)
- **User / Password**: Configured via `DB_USER` and `DB_PASSWORD` in `backend/.env`
- **JWT Secret**: Required `JWT_SECRET` (>= 32 random bytes, e.g. `python -c "import secrets; print(secrets.token_urlsafe(48))"`)
- **Connection Pool**: `psycopg2.pool.SimpleConnectionPool`

---

## 4. API Endpoints

### Authentication (`routers/auth.py`)
- `POST /api/auth/login` — Authenticates user via bcrypt, returns 24h JWT token and user profile.
- `GET /api/auth/me` — Returns current logged-in user details verified from JWT header (`Authorization: Bearer <token>`).

### Sites & Facilities (`routers/sites.py`)
- `GET /api/sites` — Returns all registered installation facilities.
- `POST /api/sites` — Registers a new site (validates unique site code per organization, GPS coordinates, required address).
- `PUT /api/sites/{site_id}` — Updates facility name, physical address, GPS coordinates, timezone, or active status.
- `DELETE /api/sites/{site_id}` — Deletes site facility.

### Users & Access Control (`routers/users.py`)
- `GET /api/users` — Returns authorized accounts.
- `POST /api/users` — Creates user account (enforces unique email, bcrypt password hash, role scope).
- `PUT /api/users/{user_id}` — Updates name, phone, role, assigned site, active status.
- `DELETE /api/users/{user_id}` — Deactivates or removes user account.

### Organizations (`routers/organizations.py`)
- `GET /api/organizations` — Returns client organization details (`Green Valley Foods Pty Ltd`, `CL-0042`).

### Global Search (`routers/search.py`)
- `GET /api/search?q={query}` — Searches PostgreSQL `sites`, `users`, and live composter machines simultaneously.
