import argparse
from .database import get_db_cursor, run_schema_migrations


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Foodie PostgreSQL schema migrations.")
    parser.add_argument(
        "--apply-cleanup",
        action="store_true",
        help="Also execute legacy DROP COLUMN / DROP CONSTRAINT cleanup statements after backup.",
    )
    args = parser.parse_args()

    with get_db_cursor(commit=True) as cur:
        run_schema_migrations(cur, apply_destructive_cleanup=args.apply_cleanup)

    print("Database migrations completed successfully.")


if __name__ == "__main__":
    main()

