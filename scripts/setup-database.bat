@echo off
title WINNMATT POS - Database Setup
color 0F

echo ============================================
echo   WINNMATT POS - Database Setup
echo   ============================================
echo.

echo  === STEP-BY-STEP INSTRUCTIONS ===
echo.
echo  Step 1: Create a new Supabase project
echo   - Go to https://app.supabase.com
echo   - Click "New project"
echo   - Name: WINNMATT POS
echo   - Set a database password (save it!)
echo   - Choose region nearest East Africa
echo   - Wait ~2 minutes for provisioning
echo.
echo  Step 2: Get your API keys
echo   - Go to Project Settings ^> API
echo   - Copy these 3 values into .env.local:
echo     NEXT_PUBLIC_SUPABASE_URL = Project URL
echo     NEXT_PUBLIC_SUPABASE_ANON_KEY = anon public
echo     SUPABASE_SERVICE_ROLE_KEY = service_role (secret)
echo.
echo  Step 3: Apply the complete migration
echo   - Go to SQL Editor ^> New Query
echo   - Open scripts\setup-complete.sql (in Notepad)
echo   - Copy ALL the SQL and paste it in
echo   - Click "Run" (takes ~5-10 seconds)
echo.
echo  Step 4: Create Auth users
echo   - Go to Authentication ^> Users ^> Add User
echo   - Create these 3 users:
echo     admin@winnmatt.com  / admin123
echo     cashier@winnmatt.com / cashier123
echo     demo@winnmatt.com   / demo123
echo.
echo  Step 5: Run the last section of setup-complete.sql
echo   - Go back to SQL Editor
echo   - Copy just PART 10 from setup-complete.sql
echo   - This links Auth users to app user profiles
echo.
echo  Step 6: Start the app
echo   - Run: npx next dev
echo   - Or double-click: START_POS.bat
echo   - Open http://localhost:3000
echo   - Sign in with admin@winnmatt.com / admin123
echo.
echo  ============================================
echo.
pause
