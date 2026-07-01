#!/bin/bash

# WINNMATT POS - Supabase Automated Setup Script
# This script automates Phase 2: Supabase Setup & Configuration

echo "================================================"
echo "WINNMATT POS - Supabase Setup Script"
echo "================================================"
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "✓ .env.local file found"
else
    echo "✗ .env.local file NOT found"
    echo ""
    echo "Creating .env.local from template..."
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        echo "✓ .env.local created from template"
        echo ""
        echo "NEXT: Edit .env.local with your Supabase credentials:"
        echo "  1. Go to https://supabase.com"
        echo "  2. Create a new project named 'winnmatt-pos'"
        echo "  3. Get credentials from Settings → API"
        echo "  4. Update .env.local with:"
        echo "     - NEXT_PUBLIC_SUPABASE_URL"
        echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
        echo "     - SUPABASE_SERVICE_ROLE_KEY"
    else
        echo "✗ .env.local.example template not found"
        exit 1
    fi
fi

echo ""
echo "================================================"
echo "Next Steps:"
echo "================================================"
echo "1. Edit .env.local with your Supabase credentials"
echo "2. Go to Supabase SQL Editor and run:"
echo "   - db-migrations.sql (creates schema)"
echo "   - db-seed.sql (loads test data)"
echo "3. Run: npm run dev"
echo "4. Visit: http://localhost:3000"
echo ""
