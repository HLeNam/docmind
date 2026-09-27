#!/bin/bash
# scripts/rotate-db-role-passwords.sh — an toàn để commit, không chứa secret nào, chỉ đọc từ env
set -e
: "${APP_DB_PASSWORD:?Chưa set APP_DB_PASSWORD}"
: "${SYSTEM_DB_PASSWORD:?Chưa set SYSTEM_DB_PASSWORD}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
ALTER ROLE docmind_app WITH PASSWORD '$APP_DB_PASSWORD';
ALTER ROLE docmind_system WITH PASSWORD '$SYSTEM_DB_PASSWORD';
SQL