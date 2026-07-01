@echo off
setlocal enabledelayedexpansion

if "%SUPABASE_DB_URL%"=="" (
  echo ERROR: SUPABASE_DB_URL environment variable not set.
  echo Usage: set SUPABASE_DB_URL=postgresql://user:pass@host:5432/db
  echo Then run: scripts\backup-db.bat
  exit /b 1
)

set BACKUP_DIR=.\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DATETIME=%%I
set FILENAME=winnmatt-pos-%DATETIME:~0,8%_%DATETIME:~8,6%.sql

echo Backing up database to %BACKUP_DIR%\%FILENAME% ...
pg_dump "%SUPABASE_DB_URL%" --clean --if-exists --no-owner > "%BACKUP_DIR%\%FILENAME%"

if %errorlevel% equ 0 (
  echo Backup complete: %BACKUP_DIR%\%FILENAME%
) else (
  echo Backup failed. Is pg_dump installed and SUPABASE_DB_URL correct?
  exit /b 1
)
