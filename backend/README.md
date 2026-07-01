# Assets Diary Backend

This backend supports the Figma plugin by handling user authentication and saving private assets into a shared Google Drive account.

## Setup

1. Install dependencies:

```bash
cd "d:/FG/Assets Diary/backend"
npm install
```

2. Create a `.env` file in `backend/` with:

```env
PORT=3000
JWT_SECRET=replace-with-a-strong-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=refresh-token-for-google-drive-account
DRIVE_ROOT_FOLDER_ID=optional-google-drive-folder-id
```

3. Start the server:

```bash
npm start
```

4. In the plugin code, set `BACKEND_URL` to the backend address (for local development: `http://localhost:3000`).

## Notes

- The server stores user metadata in `data.json`.
- The Google Drive credentials are only held on the backend.
- Each user receives a private folder inside the shared drive root.
