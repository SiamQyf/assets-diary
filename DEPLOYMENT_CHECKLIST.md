# Vercel Deployment Checklist

## ✅ Project Setup Complete
- [x] Supabase module created (`backend/supabase.js`)
- [x] Server.js migrated to Supabase
- [x] package.json updated with Supabase dependency
- [x] vercel.json created with environment variables
- [x] .gitignore configured
- [x] Git repository initialized

## 📋 Before Deploying to Vercel

### 1. Supabase Setup (5 min)
- [ ] Go to https://supabase.com and create new project
- [ ] Copy **Project URL** from Settings → API
- [ ] Copy **Anon Public Key** from Settings → API
- [ ] Go to SQL Editor and paste `backend/supabase-schema.sql`
- [ ] Run the SQL to create database tables
- [ ] Enable Row Level Security (RLS) if needed in Supabase

### 2. Create `.env` File (2 min)
Create `backend/.env` with:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
JWT_SECRET=your-secret-key-here-change-this
BACKEND_PUBLIC_URL=https://your-vercel-domain.vercel.app
```

Add other optional vars:
- `GOOGLE_CLIENT_ID` (for Google Drive)
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for email)

### 3. Test Locally (5 min)
```powershell
cd backend
node server.js
# Should output: Assets Diary backend running on http://localhost:3000
```

### 4. Push to GitHub (5 min)
```powershell
cd d:\FG\Assets\ Diary
git add .
git commit -m "Initial commit: Supabase integration and Vercel config"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/assets-diary.git
git push -u origin main
```

**Note:** Replace `YOUR_USERNAME` with your GitHub username and create the repo first at github.com/new

### 5. Deploy to Vercel (5 min)
1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Select **Import Git Repository**
4. Paste: `https://github.com/YOUR_USERNAME/assets-diary`
5. Click **Import**
6. Leave **Framework Preset** as None
7. Leave **Root Directory** as `./`
8. Click **Environment Variables** and add:
   - `SUPABASE_URL` = (from step 1)
   - `SUPABASE_ANON_KEY` = (from step 1)
   - `JWT_SECRET` = (from step 2)
   - Any optional vars from step 2
9. Click **Deploy**

### 6. Get Your URL
- After deployment, Vercel will show your URL: `https://your-domain.vercel.app`
- Update your Figma plugin code to use this URL instead of localhost

## 🧪 Test the Deployment
```bash
# Test register
curl -X POST https://your-domain.vercel.app/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Should return: {"token":"...","user":{"id":"...","email":"test@example.com","verified":false}}
```

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| `SUPABASE_URL missing` | Add env var to Vercel → Settings → Environment Variables |
| `Database connection failed` | Check Supabase Project URL is correct |
| `JWT errors` | Ensure `JWT_SECRET` is set in both local `.env` and Vercel |
| `CORS errors` | Supabase handles this automatically |
| `Folder not found` errors | Make sure SQL schema was created in Supabase |

## 📈 Next Steps
1. Migrate existing user data from `data.json` if needed
2. Set up email verification (configure SMTP)
3. Configure Google Drive integration if desired
4. Monitor Supabase usage in dashboard
5. Set up Vercel analytics

## 🔐 Security Reminders
- Never commit `.env` file (it's in `.gitignore`)
- Keep JWT_SECRET secret
- Rotate credentials periodically
- Use environment variables for all secrets
- Enable Supabase RLS policies for production
