#!/bin/bash
# Quick deployment script for Vercel

echo "🚀 Assets Diary - Vercel Deployment Helper"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f "backend/.env" ]; then
  echo "❌ Error: backend/.env not found"
  echo "Please create .env file with your Supabase credentials"
  exit 1
fi

# Check if git is initialized
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init
  git config user.email "setup@example.com"
  git config user.name "Assets Diary"
fi

echo "✅ Checking dependencies..."
cd backend
npm install --silent

echo "✅ Building project..."
# Just verify the code syntax
node -c server.js
node -c supabase.js

cd ..

echo "✅ All checks passed!"
echo ""
echo "Next steps:"
echo "1. Push to GitHub:"
echo "   git add ."
echo "   git commit -m 'Supabase integration'"
echo "   git push origin main"
echo ""
echo "2. Deploy to Vercel:"
echo "   vercel"
echo ""
echo "3. Or import manually at: https://vercel.com/new"
