import secrets
import unittest
from contextlib import contextmanager
from datetime import date, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from psycopg2.pool import ThreadedConnectionPool

import backend.database as db
from backend.auth import create_access_token, get_password_hash, hash_reset_token
from backend.main import app


class HandoverP0P1Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.suffix = secrets.token_hex(4)
        cls.client = TestClient(app)
        cls.pwd = "StrongPass#12345!"
        cls.pwd_hash = get_password_hash(cls.pwd)

        cls.oem_email = f"ho_oem_{cls.suffix}@example.com"
        cls.sa1_email = f"ho_sa1_{cls.suffix}@example.com"
        cls.sa2_email = f"ho_sa2_{cls.suffix}@example.com"
        cls.op1_email = f"ho_op1_{cls.suffix}@example.com"

        cls.oem_id = None
        cls.org1_id = None
        cls.org2_id = None
        cls.sa1_id = None
        cls.sa2_id = None
        cls.op1_id = None
        cls.mach1_id = None
        cls.mach2_id = None

        with db.get_db_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
                VALUES (%s, %s, 'HO', 'OEM', 'OEM_MANAGER', TRUE)
                RETURNING id;
                """,
                (cls.oem_email, cls.pwd_hash),
            )
            cls.oem_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO organizations (client_code, company_name, contact_poc, email, billing_address, is_active, status)
                VALUES (%s, %s, 'SA One', %s, '10 Test Rd', TRUE, 'Active')
                RETURNING id;
                """,
                (f"CL-H1-{cls.suffix[:4].upper()}", f"Handover Org1 {cls.suffix}", cls.sa1_email),
            )
            cls.org1_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO organizations (client_code, company_name, contact_poc, email, billing_address, is_active, status)
                VALUES (%s, %s, 'SA Two', %s, '20 Test Rd', TRUE, 'Active')
                RETURNING id;
                """,
                (f"CL-H2-{cls.suffix[:4].upper()}", f"Handover Org2 {cls.suffix}", cls.sa2_email),
            )
            cls.org2_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
                VALUES (%s, %s, %s, 'SA', 'One', 'SITE_ADMIN', TRUE)
                RETURNING id;
                """,
                (cls.org1_id, cls.sa1_email, cls.pwd_hash),
            )
            cls.sa1_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
                VALUES (%s, %s, %s, 'SA', 'Two', 'SITE_ADMIN', TRUE)
                RETURNING id;
                """,
                (cls.org2_id, cls.sa2_email, cls.pwd_hash),
            )
            cls.sa2_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, is_active)
                VALUES (%s, %s, %s, 'Op', 'One', 'OPERATOR', TRUE)
                RETURNING id;
                """,
                (cls.org1_id, cls.op1_email, cls.pwd_hash),
            )
            cls.op1_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO machines (machine_code, serial_number, model, location_label, is_active)
                VALUES (%s, %s, 'Foodie F100', 'Bay A', TRUE)
                RETURNING id;
                """,
                (f"H1{cls.suffix[:4].upper()}", f"SNH1{cls.suffix[:4].upper()}"),
            )
            cls.mach1_id = str(cur.fetchone()[0])

            cur.execute(
                """
                INSERT INTO machines (machine_code, serial_number, model, organization_id, location_label, is_active)
                VALUES (%s, %s, 'Foodie F25', %s, 'Bay B', TRUE)
                RETURNING id;
                """,
                (f"H2{cls.suffix[:4].upper()}", f"SNH2{cls.suffix[:4].upper()}", cls.org2_id),
            )
            cls.mach2_id = str(cur.fetchone()[0])

    @classmethod
    def tearDownClass(cls):
        with db.get_db_cursor(commit=True) as cur:
            mach_ids = [m for m in (cls.mach1_id, cls.mach2_id) if m]
            if mach_ids:
                cur.execute("DELETE FROM machine_assign_to_operators WHERE machine_id = ANY(%s::uuid[]);", (mach_ids,))
                cur.execute("DELETE FROM machine_leases WHERE machine_id = ANY(%s::uuid[]);", (mach_ids,))
                cur.execute("DELETE FROM machines WHERE id = ANY(%s::uuid[]);", (mach_ids,))
            org_ids = [o for o in (cls.org1_id, cls.org2_id) if o]
            if org_ids:
                cur.execute("DELETE FROM users WHERE organization_id = ANY(%s::uuid[]);", (org_ids,))
                cur.execute("DELETE FROM organizations WHERE id = ANY(%s::uuid[]);", (org_ids,))
            if cls.oem_id:
                cur.execute("DELETE FROM users WHERE id = %s;", (cls.oem_id,))

    def setUp(self):
        self.client.cookies.clear()

    def tearDown(self):
        self.client.cookies.clear()

    def _auth_headers(self, user_id: str, email: str, role: str, org_id: str | None) -> dict[str, str]:
        token = create_access_token(
            {
                "id": user_id,
                "email": email,
                "role": role,
                "first_name": "Test",
                "last_name": "User",
                "organization_id": org_id,
                "token_version": 1,
            }
        )
        return {"Authorization": f"Bearer {token}"}

    def test_f004_no_demo_seed_present(self):
        self.assertIsInstance(db.pool, ThreadedConnectionPool)
        self.assertFalse(hasattr(db, "seed_demo_data"))

    def test_f005_startup_checks_compatibility_without_migrations(self):
        self.assertIn(("users", "reset_token"), db._REQUIRED_COLUMNS)
        self.assertIn(("users", "reset_token_expires_at"), db._REQUIRED_COLUMNS)

        with patch("backend.database.run_schema_migrations") as mock_mig:
            db.init_db()
            mock_mig.assert_not_called()

        class MissingTableCursor:
            def execute(self, *_args, **_kwargs):
                return None

            def fetchone(self):
                return [None]

        with self.assertRaises(RuntimeError):
            db.verify_schema_compatibility(MissingTableCursor())

        class MissingResetColumnCursor:
            def __init__(self):
                self._missing = False

            def execute(self, _sql, params=None):
                self._missing = bool(params and params == ("users", "reset_token_expires_at"))

            def fetchone(self):
                return None if self._missing else [1]

        with self.assertRaisesRegex(RuntimeError, r"users\.reset_token_expires_at"):
            db.verify_schema_compatibility(MissingResetColumnCursor())

    def test_f001_dashboard_returns_unavailable_when_telemetry_absent(self):
        headers = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)
        res = self.client.get("/api/dashboard/stats", headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        with db.get_db_cursor() as cur:
            cur.execute("SELECT to_regclass('public.machine_telemetry_daily');")
            has_table = cur.fetchone()[0] is not None
            has_rows = False
            if has_table:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM machine_telemetry_daily t
                        JOIN machines m ON t.machine_id = m.id
                        WHERE m.is_deleted IS NOT TRUE
                    );
                    """
                )
                has_rows = bool(cur.fetchone()[0])

        if not has_rows:
            self.assertFalse(data["telemetry_connected"])
            self.assertIsNone(data["energy_consumed_today_kwh"])
            self.assertIsNone(data["waste_intake_today_kg"])
            self.assertIsNone(data["compost_produced_today_kg"])
            self.assertEqual(data["energy_history_14d"], [])
        else:
            self.assertTrue(data["telemetry_connected"])

    def test_f001_telemetry_empty_table_and_real_zero_readings(self):
        headers = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)

        class FakeTelemetryCursor:
            def __init__(self, *, has_rows: bool):
                self.has_rows = has_rows
                self._next_one = None
                self._next_all = []

            def execute(self, sql, _params=None):
                normalized = " ".join(sql.split())
                if "SELECT to_regclass('public.machine_telemetry_daily')" in normalized:
                    self._next_one = ["public.machine_telemetry_daily"]
                elif "SELECT to_regclass('public.alerts')" in normalized:
                    self._next_one = [None]
                elif "SELECT EXISTS (" in normalized and "machine_telemetry_daily" in normalized:
                    self._next_one = [self.has_rows]
                elif "SUM(t.energy_kwh), SUM(t.waste_intake_kg), SUM(t.compost_produced_kg)" in normalized:
                    self._next_one = (None, None, None)
                elif "FROM machine_telemetry_daily t" in normalized and "GROUP BY t.date" in normalized:
                    self._next_all = [("2026-11-28", "28 Nov", "28 Nov 2026", 0.0)] if self.has_rows else []
                elif "SELECT COUNT(*)" in normalized:
                    self._next_one = [0]
                else:
                    self._next_all = []

            def fetchone(self):
                return self._next_one

            def fetchall(self):
                return self._next_all

        @contextmanager
        def make_cursor(has_rows: bool):
            yield FakeTelemetryCursor(has_rows=has_rows)

        with patch("backend.routers.dashboard.get_db_cursor", side_effect=lambda *a, **kw: make_cursor(False)):
            res_empty = self.client.get("/api/dashboard/stats", headers=headers)
            self.assertEqual(res_empty.status_code, 200)
            empty_data = res_empty.json()
            self.assertFalse(empty_data["telemetry_connected"])
            self.assertIsNone(empty_data["energy_consumed_today_kwh"])
            self.assertEqual(empty_data["energy_history_14d"], [])

        with patch("backend.routers.dashboard.get_db_cursor", side_effect=lambda *a, **kw: make_cursor(True)):
            res_zero = self.client.get("/api/dashboard/stats", headers=headers)
            self.assertEqual(res_zero.status_code, 200)
            zero_data = res_zero.json()
            self.assertTrue(zero_data["telemetry_connected"])
            self.assertIsNone(zero_data["energy_consumed_today_kwh"])
            self.assertEqual(len(zero_data["energy_history_14d"]), 1)
            self.assertEqual(zero_data["energy_history_14d"][0]["kwh"], 0.0)

    def test_soft_deleted_user_email_can_be_reused(self):
        oem_h = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)
        reuse_email = f"reuse_{self.suffix}@example.com"
        created_ids: list[str] = []

        try:
            r1 = self.client.post(
                "/api/users",
                json={
                    "email": reuse_email,
                    "first_name": "First",
                    "last_name": "Operator",
                    "role": "OPERATOR",
                    "organization_id": self.org1_id,
                    "password": self.pwd,
                },
                headers=oem_h,
            )
            self.assertEqual(r1.status_code, 201, r1.text)
            first_id = r1.json()["id"]
            created_ids.append(first_id)

            r_del = self.client.delete(f"/api/users/{first_id}", headers=oem_h)
            self.assertEqual(r_del.status_code, 200, r_del.text)

            r2 = self.client.post(
                "/api/users",
                json={
                    "email": reuse_email,
                    "first_name": "Second",
                    "last_name": "Operator",
                    "role": "OPERATOR",
                    "organization_id": self.org1_id,
                    "password": self.pwd,
                },
                headers=oem_h,
            )
            self.assertEqual(r2.status_code, 201, r2.text)
            created_ids.append(r2.json()["id"])
        finally:
            if created_ids:
                with db.get_db_cursor(commit=True) as cur:
                    cur.execute("DELETE FROM machine_assign_to_operators WHERE operator_id = ANY(%s::uuid[]);", (created_ids,))
                    cur.execute("DELETE FROM users WHERE id = ANY(%s::uuid[]);", (created_ids,))

    def test_f003_search_does_not_hardcode_temperature(self):
        headers = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)
        q = f"H2{self.suffix[:4].upper()}"
        res = self.client.get(f"/api/search?q={q}", headers=headers)
        self.assertEqual(res.status_code, 200)
        machines = res.json()["machines"]
        self.assertGreaterEqual(len(machines), 1)
        for item in machines:
            self.assertNotEqual(item.get("temp"), "62°C")
            self.assertIsNone(item.get("temp"))

    def test_auth_rbac_and_tenant_isolation(self):
        # Unauthenticated access blocked
        self.assertIn(self.client.get("/api/machines").status_code, (401, 403))
        self.assertIn(self.client.get("/api/machine-models").status_code, (401, 403))

        # Operator forbidden from org/user/machine mutations or role self-escalation
        op_h = self._auth_headers(self.op1_id, self.op1_email, "OPERATOR", self.org1_id)
        self.assertEqual(self.client.get("/api/users", headers=op_h).status_code, 403)
        self.assertEqual(self.client.get(f"/api/users/{self.sa1_id}", headers=op_h).status_code, 403)
        self.assertEqual(self.client.get("/api/organizations", headers=op_h).status_code, 403)
        self.assertEqual(self.client.put(f"/api/machines/{self.mach2_id}", json={"notes": "x"}, headers=op_h).status_code, 403)
        self.assertEqual(self.client.put(f"/api/users/{self.op1_id}", json={"role": "SITE_ADMIN"}, headers=op_h).status_code, 403)
        self.assertEqual(self.client.put(f"/api/users/{self.op1_id}", json={"is_active": False}, headers=op_h).status_code, 403)
        self.assertEqual(self.client.put(f"/api/users/{self.op1_id}", json={"email": "hacked@example.com"}, headers=op_h).status_code, 403)
        self.assertEqual(self.client.get("/api/organizations/next-code", headers=op_h).status_code, 403)
        self.assertEqual(self.client.get("/api/machines/next-code", headers=op_h).status_code, 403)

        # Site Admin 1 cannot access Site Admin 2's org or machine, nor mutate orgs or create OEM users
        sa1_h = self._auth_headers(self.sa1_id, self.sa1_email, "SITE_ADMIN", self.org1_id)
        self.assertEqual(self.client.get(f"/api/organizations/{self.org2_id}", headers=sa1_h).status_code, 403)
        self.assertEqual(self.client.get(f"/api/machines/{self.mach2_id}", headers=sa1_h).status_code, 404)
        self.assertEqual(
            self.client.post(
                "/api/organizations",
                json={
                    "client_code": "CL-9999",
                    "company_name": "Rogue Org",
                    "contact_poc": "Rogue Contact",
                    "email": f"rogue-org-{self.suffix}@example.com",
                    "password": self.pwd,
                },
                headers=sa1_h,
            ).status_code,
            403,
        )
        self.assertEqual(self.client.put(f"/api/organizations/{self.org1_id}", json={"company_name": "Hijack"}, headers=sa1_h).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/organizations/{self.org1_id}", headers=sa1_h).status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/users",
                json={
                    "email": f"rogue-oem-{self.suffix}@example.com",
                    "first_name": "Rogue",
                    "last_name": "Admin",
                    "role": "OEM_MANAGER",
                },
                headers=sa1_h,
            ).status_code,
            403,
        )
        self.assertEqual(self.client.put(f"/api/users/{self.sa1_id}", json={"role": "OEM_MANAGER"}, headers=sa1_h).status_code, 403)
        self.assertEqual(self.client.put(f"/api/users/{self.sa1_id}", json={"is_active": False}, headers=sa1_h).status_code, 403)
        self.assertEqual(self.client.get("/api/organizations/next-code", headers=sa1_h).status_code, 403)
        self.assertEqual(self.client.get("/api/machines/next-code", headers=sa1_h).status_code, 403)

        oem_h = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)
        self.assertEqual(self.client.get("/api/organizations/next-code", headers=oem_h).status_code, 200)
        self.assertEqual(self.client.get("/api/machines/next-code", headers=oem_h).status_code, 200)

    def test_login_logout_and_reset_token_hashing(self):
        r_login = self.client.post("/api/auth/login", json={"email": self.sa1_email, "password": self.pwd})
        self.assertEqual(r_login.status_code, 200)
        self.assertEqual(r_login.json()["user"]["email"], self.sa1_email)

        r_logout = self.client.post("/api/auth/logout")
        self.assertEqual(r_logout.status_code, 200)
        self.client.cookies.clear()
        self.assertIn(self.client.get("/api/machines").status_code, (401, 403))

        raw_token = "reset_token_check_" + self.suffix
        with db.get_db_cursor(commit=True) as cur:
            cur.execute(
                "UPDATE users SET reset_token = %s, reset_token_expires_at = %s WHERE id = %s;",
                (hash_reset_token(raw_token), date.today() + timedelta(days=1), self.sa1_id),
            )
            cur.execute("SELECT reset_token FROM users WHERE id = %s;", (self.sa1_id,))
            stored = cur.fetchone()[0]
            self.assertNotEqual(stored, raw_token)
            self.assertEqual(stored, hash_reset_token(raw_token))
            cur.execute("UPDATE users SET reset_token = NULL, reset_token_expires_at = NULL WHERE id = %s;", (self.sa1_id,))

    def test_machine_lease_validation_and_unassign_workflow(self):
        oem_h = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)
        today_str = date.today().strftime("%Y-%m-%d")
        yesterday_str = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        next_year_str = (date.today() + timedelta(days=365)).strftime("%Y-%m-%d")

        # Invalid end < start returns 422
        r_bad = self.client.put(
            f"/api/machines/{self.mach1_id}",
            json={
                "organization_id": self.org1_id,
                "lease_start_date": today_str,
                "lease_end_date": yesterday_str,
            },
            headers=oem_h,
        )
        self.assertEqual(r_bad.status_code, 422)

        # Valid assignment creates lease and operator assignment
        r_ok = self.client.put(
            f"/api/machines/{self.mach1_id}",
            json={
                "organization_id": self.org1_id,
                "lease_location_label": "Kitchen Bay 1",
                "lease_start_date": today_str,
                "lease_end_date": next_year_str,
            },
            headers=oem_h,
        )
        self.assertEqual(r_ok.status_code, 200)
        self.assertEqual(r_ok.json()["organization_id"], self.org1_id)

        # Unassign terminates lease and revokes operator assignment
        r_un = self.client.post(f"/api/machines/{self.mach1_id}/unassign", json={"termination_remark": "Test complete"}, headers=oem_h)
        self.assertEqual(r_un.status_code, 200)
        with db.get_db_cursor() as cur:
            cur.execute("SELECT organization_id FROM machines WHERE id = %s;", (self.mach1_id,))
            self.assertIsNone(cur.fetchone()[0])
            cur.execute("SELECT status FROM machine_assign_to_operators WHERE operator_id = %s AND machine_id = %s;", (self.op1_id, self.mach1_id))
            op_row = cur.fetchone()
            self.assertIsNotNone(op_row)
            self.assertEqual(op_row[0], "Revoked")

    def test_all_personas_dashboard_search_and_operator_scope(self):
        oem_h = self._auth_headers(self.oem_id, self.oem_email, "OEM_MANAGER", None)
        sa1_h = self._auth_headers(self.sa1_id, self.sa1_email, "SITE_ADMIN", self.org1_id)
        op1_h = self._auth_headers(self.op1_id, self.op1_email, "OPERATOR", self.org1_id)

        temp_code = f"P-{self.suffix[:6].upper()}"
        temp_serial = f"SN-{self.suffix.upper()}"
        temp_mach_id = None

        try:
            r_create = self.client.post(
                "/api/machines",
                json={
                    "machine_code": temp_code,
                    "serial_number": temp_serial,
                    "model": "F100",
                    "organization_id": self.org1_id,
                    "location_label": "Dock Alpha",
                },
                headers=oem_h,
            )
            self.assertEqual(r_create.status_code, 201, r_create.text)
            temp_mach_id = r_create.json()["id"]
            self.assertEqual(r_create.json()["model"], "Foodie F100")

            # OEM sees org1 and org2 machines, non-empty recent_clients, and null telemetry when table empty/absent
            r_oem_stats = self.client.get("/api/dashboard/stats", headers=oem_h)
            self.assertEqual(r_oem_stats.status_code, 200)
            self.assertGreaterEqual(r_oem_stats.json()["total_clients"], 2)
            self.assertGreaterEqual(len(r_oem_stats.json()["recent_clients"]), 1)

            r_oem_mach = self.client.get("/api/machines", headers=oem_h)
            self.assertEqual(r_oem_mach.status_code, 200)
            oem_ids = {m["id"] for m in r_oem_mach.json()}
            self.assertIn(temp_mach_id, oem_ids)
            self.assertIn(self.mach2_id, oem_ids)

            # Site Admin sees only org1 machines & org1 stats
            r_sa_stats = self.client.get("/api/dashboard/stats", headers=sa1_h)
            self.assertEqual(r_sa_stats.status_code, 200)
            self.assertEqual(r_sa_stats.json()["total_clients"], 1)
            self.assertEqual(r_sa_stats.json()["recent_clients"], [])
            self.assertGreaterEqual(r_sa_stats.json()["total_machines"], 1)

            r_sa_mach = self.client.get("/api/machines", headers=sa1_h)
            self.assertEqual(r_sa_mach.status_code, 200)
            sa_ids = {m["id"] for m in r_sa_mach.json()}
            self.assertIn(temp_mach_id, sa_ids)
            self.assertNotIn(self.mach2_id, sa_ids)

            r_sa_search_own = self.client.get(f"/api/search?q={temp_code}", headers=sa1_h)
            self.assertEqual(r_sa_search_own.status_code, 200)
            self.assertEqual(len(r_sa_search_own.json()["machines"]), 1)
            self.assertIsNone(r_sa_search_own.json()["machines"][0]["temp"])

            r_sa_search_other = self.client.get(f"/api/search?q=H2{self.suffix[:4].upper()}", headers=sa1_h)
            self.assertEqual(r_sa_search_other.status_code, 200)
            self.assertEqual(r_sa_search_other.json()["machines"], [])

            self.assertEqual(self.client.post("/api/machines", json={"model": "F25"}, headers=sa1_h).status_code, 403)

            # Operator sees assigned machine, stats & search, then loses access upon revoke
            r_op_stats = self.client.get("/api/dashboard/stats", headers=op1_h)
            self.assertEqual(r_op_stats.status_code, 200)
            self.assertEqual(r_op_stats.json()["total_clients"], 1)
            self.assertGreaterEqual(r_op_stats.json()["total_machines"], 1)

            r_op_mach = self.client.get("/api/machines", headers=op1_h)
            self.assertEqual(r_op_mach.status_code, 200)
            self.assertIn(temp_mach_id, {m["id"] for m in r_op_mach.json()})

            r_op_search = self.client.get(f"/api/search?q={temp_code}", headers=op1_h)
            self.assertEqual(r_op_search.status_code, 200)
            self.assertEqual(len(r_op_search.json()["machines"]), 1)
            self.assertIsNone(r_op_search.json()["machines"][0]["temp"])

            r_assigns = self.client.get(f"/api/machines/operator-assignments?operator_id={self.op1_id}", headers=sa1_h)
            self.assertEqual(r_assigns.status_code, 200)
            active_assign = next(
                (a for a in r_assigns.json() if a["machine_id"] == temp_mach_id and a["status"] == "Active"),
                None,
            )
            self.assertIsNotNone(active_assign)

            r_rev = self.client.post(f"/api/machines/operator-assignments/{active_assign['id']}/revoke", headers=sa1_h)
            self.assertEqual(r_rev.status_code, 200)

            r_op_mach_after = self.client.get("/api/machines", headers=op1_h)
            self.assertEqual(r_op_mach_after.status_code, 200)
            self.assertNotIn(temp_mach_id, {m["id"] for m in r_op_mach_after.json()})

            # Operator cannot delete leased machine; OEM can unassign then delete
            self.assertEqual(self.client.delete(f"/api/machines/{temp_mach_id}", headers=oem_h).status_code, 400)
            self.assertEqual(self.client.post(f"/api/machines/{temp_mach_id}/unassign", json={}, headers=oem_h).status_code, 200)
            self.assertEqual(self.client.delete(f"/api/machines/{temp_mach_id}", headers=oem_h).status_code, 200)
        finally:
            if temp_mach_id:
                with db.get_db_cursor(commit=True) as cur:
                    cur.execute("DELETE FROM machine_assign_to_operators WHERE machine_id = %s;", (temp_mach_id,))
                    cur.execute("DELETE FROM machine_leases WHERE machine_id = %s;", (temp_mach_id,))
                    cur.execute("DELETE FROM machines WHERE id = %s;", (temp_mach_id,))


if __name__ == "__main__":
    unittest.main()
