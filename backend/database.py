import os
import uuid
from contextlib import contextmanager
from datetime import date, datetime
from typing import Optional, Tuple
from dotenv import load_dotenv
from fastapi import HTTPException, status
import psycopg2
from psycopg2.pool import ThreadedConnectionPool

load_dotenv()
if not os.getenv("DB_PASSWORD"):
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "foodie_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=20,
    host=DB_HOST,
    port=DB_PORT,
    dbname=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

@contextmanager
def get_db_cursor(commit=False):
    """Context manager for acquiring a database connection and cursor from the pool."""
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            yield cur
            if commit:
                conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)

def run_schema_migrations(cur, *, apply_destructive_cleanup: bool = False):
    """Execute explicit schema migrations; destructive cleanup requires opt-in."""
    # 1. Machine Models Table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS machine_models (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            model_code VARCHAR(50) UNIQUE NOT NULL,
            display_name VARCHAR(100) NOT NULL,
            capacity VARCHAR(50) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)

    models = [
        ('F25', 'Foodie F25', '25 kg/day'),
        ('F100', 'Foodie F100', '100 kg/day'),
        ('F500', 'Foodie F500', '500 kg/day'),
        ('F1000', 'Foodie F1000', '1000 kg/day'),
    ]
    for code, name, cap in models:
        cur.execute("""
            INSERT INTO machine_models (model_code, display_name, capacity)
            VALUES (%s, %s, %s)
            ON CONFLICT (model_code) DO NOTHING;
        """, (code, name, cap))

    # 2. Organizations & Users base tables + additive migrations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_code VARCHAR(50) NOT NULL,
            company_name VARCHAR(255) NOT NULL,
            tax_id VARCHAR(100),
            contact_poc VARCHAR(255),
            email VARCHAR(255),
            phone_number VARCHAR(50),
            website VARCHAR(255),
            billing_address TEXT,
            shipping_address TEXT,
            payment_terms VARCHAR(50) DEFAULT '30 days',
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'Corporate';
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_date DATE DEFAULT CURRENT_DATE;
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS comms_preference VARCHAR(50) DEFAULT 'Email';
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            role VARCHAR(50) NOT NULL,
            phone_number VARCHAR(50),
            is_active BOOLEAN DEFAULT TRUE,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 1;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS users_active_email_idx
        ON users (LOWER(email))
        WHERE (is_deleted IS NOT TRUE);
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

        ALTER TABLE organizations ALTER COLUMN contact_poc DROP NOT NULL;
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS organizations_client_code_active_unique ON organizations (UPPER(client_code)) WHERE (is_deleted IS NOT TRUE);
        ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_client_code_key;
        CREATE UNIQUE INDEX IF NOT EXISTS organizations_tax_id_active_unique ON organizations (REGEXP_REPLACE(tax_id, '[^0-9]', '', 'g')) WHERE (is_deleted IS NOT TRUE AND tax_id IS NOT NULL AND tax_id != '');
    """)

    # 3. Machines schema migrations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS machines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            machine_code VARCHAR(50) UNIQUE NOT NULL,
            serial_number VARCHAR(100) NOT NULL,
            model_id UUID REFERENCES machine_models(id) ON DELETE SET NULL,
            model VARCHAR(50) NOT NULL,
            capacity VARCHAR(50),
            hardware_version VARCHAR(20),
            organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
            location_label VARCHAR(100),
            location_description TEXT,
            plc_software_version VARCHAR(100),
            energy_meter_model VARCHAR(100),
            deodor_model VARCHAR(100),
            extractor_model VARCHAR(100),
            has_stairs BOOLEAN DEFAULT FALSE,
            notes TEXT,
            connectivity_status VARCHAR(50) DEFAULT 'Offline',
            operational_status VARCHAR(50) DEFAULT 'Idle',
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
            deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE machines ALTER COLUMN capacity DROP NOT NULL;
        ALTER TABLE machines ALTER COLUMN operational_status SET DEFAULT 'Idle';
        ALTER TABLE machines ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE machines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE machines ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE machines ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE machines ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    """)

    # 4. Machine Leases schema migrations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS machine_leases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            lease_reference VARCHAR(100) UNIQUE,
            machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
            organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
            location_label VARCHAR(100),
            lease_start_date DATE NOT NULL,
            lease_end_date DATE NOT NULL,
            lease_status VARCHAR(50) DEFAULT 'Active',
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            terminated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            terminated_by UUID REFERENCES users(id) ON DELETE SET NULL,
            termination_remark TEXT DEFAULT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS terminated_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE machine_leases ADD COLUMN IF NOT EXISTS termination_remark TEXT DEFAULT NULL;
    """)

    # 5. Operator Machine Assignments schema migrations
    cur.execute("""
        CREATE TABLE IF NOT EXISTS machine_assign_to_operators (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
            operator_id UUID REFERENCES users(id) ON DELETE CASCADE,
            machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            location VARCHAR(100),
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
            assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
            revoked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'Active',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_active_operator_machine ON machine_assign_to_operators (operator_id, machine_id) WHERE status = 'Active';
        CREATE INDEX IF NOT EXISTS idx_mato_org ON machine_assign_to_operators (organization_id);
        CREATE INDEX IF NOT EXISTS idx_mato_operator ON machine_assign_to_operators (operator_id);
        CREATE INDEX IF NOT EXISTS idx_mato_machine ON machine_assign_to_operators (machine_id);
        ALTER TABLE machine_assign_to_operators ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
    """)

    if apply_destructive_cleanup:
        cur.execute("""
            ALTER TABLE users DROP COLUMN IF EXISTS assigned_site_id;
            ALTER TABLE organizations DROP COLUMN IF EXISTS preferred_currency;
            ALTER TABLE machines ALTER COLUMN hardware_version DROP DEFAULT;
            ALTER TABLE machines DROP COLUMN IF EXISTS plc_ip;
            ALTER TABLE machines DROP COLUMN IF EXISTS site_id;
            ALTER TABLE machine_leases DROP COLUMN IF EXISTS site_id;
            ALTER TABLE machine_assign_to_operators DROP CONSTRAINT IF EXISTS unique_operator_active_machine;
            DROP INDEX IF EXISTS idx_unique_active_machine_assignment;
        """)


_REQUIRED_TABLES = (
    "organizations",
    "users",
    "machine_models",
    "machines",
    "machine_leases",
    "machine_assign_to_operators",
)

_REQUIRED_COLUMNS = (
    ("users", "token_version"),
    ("users", "reset_token"),
    ("users", "reset_token_expires_at"),
    ("users", "is_deleted"),
    ("users", "deleted_at"),
    ("users", "created_by"),
    ("users", "updated_by"),
    ("users", "deleted_by"),
    ("organizations", "business_type"),
    ("organizations", "status"),
    ("organizations", "onboarding_date"),
    ("organizations", "comms_preference"),
    ("organizations", "is_deleted"),
    ("organizations", "deleted_at"),
    ("organizations", "created_by"),
    ("organizations", "updated_by"),
    ("organizations", "deleted_by"),
    ("machines", "is_deleted"),
    ("machines", "deleted_at"),
    ("machines", "created_by"),
    ("machines", "updated_by"),
    ("machines", "deleted_by"),
    ("machine_leases", "lease_status"),
    ("machine_leases", "created_by"),
    ("machine_leases", "assigned_by"),
    ("machine_leases", "assigned_at"),
    ("machine_leases", "updated_by"),
    ("machine_leases", "updated_at"),
    ("machine_leases", "terminated_at"),
    ("machine_leases", "terminated_by"),
    ("machine_leases", "termination_remark"),
    ("machine_assign_to_operators", "status"),
    ("machine_assign_to_operators", "created_by"),
)


def verify_schema_compatibility(cur) -> None:
    """Verify PostgreSQL connectivity and required schema objects without mutating schema."""
    cur.execute("SELECT 1;")
    for table_name in _REQUIRED_TABLES:
        cur.execute("SELECT to_regclass(%s);", (f"public.{table_name}",))
        if cur.fetchone()[0] is None:
            raise RuntimeError(
                f"Required database table '{table_name}' does not exist. Run: python -m backend.migrate"
            )
    for table_name, col_name in _REQUIRED_COLUMNS:
        cur.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s AND column_name = %s;
            """,
            (table_name, col_name),
        )
        if cur.fetchone() is None:
            raise RuntimeError(
                f"Required column '{table_name}.{col_name}' is missing. Run: python -m backend.migrate"
            )


def init_db():
    """Verify database connection and schema compatibility on startup without running DDL or demo seeding."""
    with get_db_cursor(commit=False) as cur:
        verify_schema_compatibility(cur)

    print("Database connection and schema compatibility verified.")


# --------------------------------------------------------------------------
# Shared UUID Validation, Lease Date Math & Operator Machine Sync Helpers
# --------------------------------------------------------------------------
def parse_uuid_or_400(value: Optional[str], field_name: str = "ID") -> Optional[str]:
    """Validate an optional UUID string and return its canonical lowercase form."""
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    try:
        return str(uuid.UUID(cleaned))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name} format. Expected a valid UUID.",
        ) from exc


def require_uuid_or_400(value: str, field_name: str = "ID") -> str:
    """Validate a required UUID path/body parameter or raise HTTP 400."""
    parsed = parse_uuid_or_400(value, field_name=field_name)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} is required and must be a valid UUID.",
        )
    return parsed


def calculate_one_year_end_date(start_dt: date) -> date:
    """Calculate 1-year lease end date with leap-year handling (Feb 29 -> Feb 28)."""
    try:
        return start_dt.replace(year=start_dt.year + 1)
    except ValueError:
        return date(start_dt.year + 1, 2, 28)


def parse_iso_date_or_400(value: Optional[str], field_name: str = "Date") -> Optional[date]:
    """Parse an optional YYYY-MM-DD date string or raise HTTP 400 on malformed values."""
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned:
        return None
    try:
        return datetime.strptime(cleaned, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be a valid YYYY-MM-DD date.",
        ) from exc


def resolve_lease_dates(
    lease_start_date: Optional[str],
    lease_end_date: Optional[str],
    *,
    default_start_today: bool = True,
    default_end_one_year: bool = True,
) -> Tuple[Optional[str], Optional[str]]:
    """Validate optional lease dates and compute defaults cleanly without ignoring invalid dates."""
    start_dt = parse_iso_date_or_400(lease_start_date, "Lease start date")
    end_dt = parse_iso_date_or_400(lease_end_date, "Lease end date")

    if start_dt is None and default_start_today:
        start_dt = date.today()

    if end_dt is None and start_dt is not None and default_end_one_year:
        end_dt = calculate_one_year_end_date(start_dt)

    if start_dt is not None and end_dt is not None and end_dt < start_dt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lease end date ({end_dt.isoformat()}) cannot be earlier than lease start date ({start_dt.isoformat()}).",
        )

    return (
        start_dt.strftime("%Y-%m-%d") if start_dt else None,
        end_dt.strftime("%Y-%m-%d") if end_dt else None,
    )


_UPSERT_OPERATOR_ASSIGNMENT_SQL = """
    INSERT INTO machine_assign_to_operators (
        organization_id, operator_id, machine_id,
        start_date, end_date, location, created_by, assigned_by, status
    ) VALUES (
        %s, %s, %s,
        %s::DATE, %s::DATE, %s, %s, %s, 'Active'
    )
    ON CONFLICT (operator_id, machine_id) WHERE status = 'Active' DO UPDATE
    SET status = 'Active',
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        location = CASE WHEN %s IS TRUE THEN EXCLUDED.location ELSE COALESCE(EXCLUDED.location, machine_assign_to_operators.location) END,
        revoked_at = NULL,
        revoked_by = NULL,
        updated_by = EXCLUDED.assigned_by,
        updated_at = CURRENT_TIMESTAMP
"""


def upsert_operator_machine_assignment(
    cur,
    *,
    organization_id: str,
    operator_id: str,
    machine_id: str,
    start_date,
    end_date,
    location: Optional[str],
    actor_user_id: Optional[str],
    force_location_update: bool = False,
    returning_details: bool = False,
):
    """Create or reactivate an active operator-to-machine assignment row."""
    sql = _UPSERT_OPERATOR_ASSIGNMENT_SQL
    if returning_details:
        sql += (
            " RETURNING id, organization_id, operator_id, machine_id,"
            " TO_CHAR(start_date, 'YYYY-MM-DD'), TO_CHAR(end_date, 'YYYY-MM-DD'),"
            " location, created_by, assigned_by, assigned_at, updated_by,"
            " updated_at, revoked_by, revoked_at, status, created_at"
        )
    sql += ";"
    cur.execute(
        sql,
        (
            organization_id,
            operator_id,
            machine_id,
            start_date,
            end_date,
            location,
            actor_user_id,
            actor_user_id,
            force_location_update,
        ),
    )
    return cur.fetchone() if returning_details else None


def sync_active_operators_for_machine(
    cur,
    *,
    organization_id: str,
    machine_id: str,
    start_date: str,
    end_date: str,
    location: Optional[str],
    actor_user_id: Optional[str],
    force_location_update: bool = False,
) -> None:
    """Assign an active leased machine to all active operators in that organization."""
    cur.execute(
        """
        SELECT id FROM users
        WHERE organization_id = %s
          AND role = 'OPERATOR'
          AND is_active = TRUE
          AND (is_deleted IS NOT TRUE);
        """,
        (organization_id,),
    )
    for (op_id,) in cur.fetchall():
        upsert_operator_machine_assignment(
            cur,
            organization_id=organization_id,
            operator_id=op_id,
            machine_id=machine_id,
            start_date=start_date,
            end_date=end_date,
            location=location,
            actor_user_id=actor_user_id,
            force_location_update=force_location_update,
        )


def sync_active_machines_for_operator(
    cur,
    *,
    organization_id: str,
    operator_id: str,
    actor_user_id: Optional[str],
) -> None:
    """Assign all active leased organization machines to a newly created/activated operator."""
    cur.execute(
        """
        SELECT m.id, ml.location_label, ml.lease_start_date, ml.lease_end_date
        FROM machines m
        JOIN machine_leases ml ON m.id = ml.machine_id AND ml.lease_status = 'Active'
        WHERE m.organization_id = %s
          AND (m.is_deleted IS NOT TRUE);
        """,
        (organization_id,),
    )
    for mach_id, loc, s_dt, e_dt in cur.fetchall():
        upsert_operator_machine_assignment(
            cur,
            organization_id=organization_id,
            operator_id=operator_id,
            machine_id=mach_id,
            start_date=s_dt,
            end_date=e_dt,
            location=loc,
            actor_user_id=actor_user_id,
        )
