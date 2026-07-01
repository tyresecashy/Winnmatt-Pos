@echo off
title WINNMATT POS System
color 0F

echo ============================================
echo    WINNMATT POS - Supermarket Management System
echo    ============================================
echo.
echo  Checking environment...

:: Check for .env.local
if not exist ".env.local" (
    echo  [WARNING] .env.local not found!
    echo.
    echo  Creating from template...
    copy .env.local.example .env.local 2>nul
    if exist .env.local (
        echo  [OK] Created .env.local
        echo  [ACTION REQUIRED] Edit .env.local with your Supabase credentials
        echo.
        pause
        exit /b 1
    ) else (
        echo  [ERROR] Could not create .env.local
        pause
        exit /b 1
    )
)
echo  [OK] .env.local found

:: Check for node_modules
if not exist "node_modules" (
    echo.
    echo  [INFO] Installing dependencies (first time setup)...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo  [OK] Dependencies installed
) else (
    echo  [OK] Dependencies ready
)

:: Check for Next.js build
if exist ".next" (
    echo  [OK] Build cache found
)

echo.
echo  ============================================
echo    Starting WINNMATT POS System
echo    ============================================
echo.
echo  Opening browser automatically once ready...
echo  Access at: http://localhost:3000
echo.
echo  Press Ctrl+C to stop the server
echo  ============================================
echo.

npx next dev --port 3000

if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Server failed to start. Try running: npm run build
    pause
)
