# WINNMATT POS - Supabase Automated Setup Script (Windows PowerShell)
# This script automates Phase 2: Supabase Setup & Configuration

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "WINNMATT POS - Supabase Setup Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (Test-Path ".env.local") {
    Write-Host "✓ .env.local file found" -ForegroundColor Green
} else {
    Write-Host "✗ .env.local file NOT found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Creating .env.local from template..." -ForegroundColor Yellow
    
    if (Test-Path ".env.local.example") {
        Copy-Item ".env.local.example" ".env.local"
        Write-Host "✓ .env.local created from template" -ForegroundColor Green
        Write-Host ""
        Write-Host "NEXT: Edit .env.local with your Supabase credentials:" -ForegroundColor Yellow
        Write-Host "  1. Go to https://supabase.com" -ForegroundColor Gray
        Write-Host "  2. Create a new project named 'winnmatt-pos'" -ForegroundColor Gray
        Write-Host "  3. Get credentials from Settings → API" -ForegroundColor Gray
        Write-Host "  4. Update .env.local with:" -ForegroundColor Gray
        Write-Host "     - NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Gray
        Write-Host "     - NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Gray
        Write-Host "     - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Gray
    } else {
        Write-Host "✗ .env.local.example template not found" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "1. Edit .env.local with your Supabase credentials" -ForegroundColor Yellow
Write-Host "2. Go to Supabase SQL Editor and run:" -ForegroundColor Yellow
Write-Host "   - db-migrations.sql (creates schema)" -ForegroundColor Gray
Write-Host "   - db-seed.sql (loads test data)" -ForegroundColor Gray
Write-Host "3. Run: npm run dev" -ForegroundColor Yellow
Write-Host "4. Visit: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
