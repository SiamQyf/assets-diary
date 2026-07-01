# Supabase + Vercel Setup Guide

## Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project" and create a new project
3. Save your **Project URL** and **Anon Key** from the API settings

## Step 2: Create Database Schema
1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query** and paste the SQL from `backend/supabase-schema.sql`
3. Click **Run** to create the tables

## Step 3: Prepare for Vercel
1. Install dependencies locally:
   ```powershell
   cd backend
   npm install
   ```

2. Create a `.env` file in the `backend` folder with your values:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   JWT_SECRET=your_jwt_secret
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token
   DRIVE_ROOT_FOLDER_ID=optional_folder_id
   SMTP_HOST=your_smtp_host
   SMTP_PORT=587
   SMTP_USER=your_smtp_user
   SMTP_PASS=your_smtp_password
   FROM_EMAIL=your_email
   BACKEND_PUBLIC_URL=https://your-domain.com
   ```

## Step 4: Push to GitHub
1. Initialize git in your project root:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit with Supabase integration"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/assets-diary.git
   git push -u origin main
   ```

## Step 5: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Import Project**
3. Paste your GitHub repo URL
4. Set **Root Directory** to `backend` (or keep as-is if monorepo is your preference)
5. Click **Environment Variables** and add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_REFRESH_TOKEN`
   - (and any other env vars)
6. Click **Deploy**

## Step 6: Update Your Frontend
Update your Figma plugin to use the Vercel URL:
```javascript
// In your code.js or UI code
const BACKEND_URL = 'https://your-vercel-deployment.vercel.app';
```

## Migrate Data (If Moving from JSON)
If you have existing data in `data.json`, you can use a migration script:
```javascript
// Run this once to migrate from JSON to Supabase
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

for (const user of data.users) {
  await supabase.from('users').insert([user]);
}

for (const folderEntry of data.folders) {
  for (const folder of folderEntry.folders) {
    const folderObj = {
      userId: folderEntry.userId,
      ...folder,
      styles: folder.styles || []
    };
    await supabase.from('folders').insert([folderObj]);
    
    for (const style of folder.styles || []) {
      const styleObj = {
        userId: folderEntry.userId,
        folderId: folder.folderId,
        ...style
      };
      await supabase.from('styles').insert([styleObj]);
    }
  }
}
```

## Troubleshooting
- **CORS errors**: Supabase handles CORS automatically
- **Auth errors**: Check your JWT_SECRET is consistent
- **Missing env vars**: Verify all required env vars are set in Vercel
- **Database errors**: Check the SQL schema was created correctly in Supabase

## Next Steps
- Configure email verification (SMTP settings)
- Set up Google Drive integration if needed
- Monitor your Supabase usage in the dashboard
- Set up Vercel analytics and monitoring
