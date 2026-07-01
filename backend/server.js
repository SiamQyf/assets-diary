const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const {
  supabase,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  getUserFolders,
  createFolder,
  updateFolder,
  getFolder,
  deleteFolder,
  createStyle,
  getStyle,
  updateStyle,
  deleteStyle,
  deleteStylesByFolder,
} = require('./supabase');

const app = express();

app.use(cors());

app.use((req, res, next) => {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') && contentType.includes('application/json')) {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      if (!rawBody) {
        req.body = {};
        return next();
      }
      try {
        req.body = JSON.parse(rawBody);
        next();
      } catch (error) {
        res.status(400).json({ error: 'Invalid JSON payload.' });
      }
    });
    return;
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    express.urlencoded({ extended: true, limit: '20mb' })(req, res, next);
    return;
  }

  next();
});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Assets Diary backend is running.' });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_DRIVE_REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '';
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || null;
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const FROM_EMAIL = process.env.FROM_EMAIL || ('no-reply@' + (process.env.HOSTNAME || 'local'));
const DRIVE_CONFIGURED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_DRIVE_REFRESH_TOKEN);

if (!DRIVE_CONFIGURED) {
  console.warn('Google Drive credentials are not fully configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN.');
}

function getAuthClient() {
  if (!DRIVE_CONFIGURED) {
    throw new Error('Google Drive is not configured.');
  }
  const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });
  return oauth2Client;
}

async function createDriveFolder(name, parentId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : []
    },
    fields: 'id'
  });
  return res.data.id;
}

async function uploadDriveFile(name, mimeType, base64Data, parentId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const buffer = Buffer.from(base64Data, 'base64');
  const res = await drive.files.create({
    requestBody: {
      name,
      parents: parentId ? [parentId] : [],
      mimeType
    },
    media: {
      mimeType,
      body: buffer
    },
    fields: 'id'
  });
  return res.data.id;
}

async function downloadDriveFileBase64(fileId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get({
    fileId,
    alt: 'media'
  }, { responseType: 'arraybuffer' });
  return Buffer.from(res.data).toString('base64');
}

async function downloadDriveFileText(fileId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get({
    fileId,
    alt: 'media'
  }, { responseType: 'text' });
  return res.data;
}

async function deleteDriveFile(fileId) {
  const auth = getAuthClient();
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId });
}

function signToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

function createToken() {
  return uuidv4();
}

async function sendMail(to, subject, text, html) {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10) || 587,
        secure: false,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      await transporter.sendMail({ from: FROM_EMAIL, to, subject, text, html });
      return;
    } catch (err) {
      console.warn('Failed to send email via SMTP:', err.message);
    }
  }
  console.log('--- EMAIL ---');
  console.log('To:', to);
  console.log('Subject:', subject);
  if (text) console.log(text);
  if (html) console.log(html);
  console.log('--- END EMAIL ---');
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}

async function ensureUserFolder(user) {
  if (!DRIVE_CONFIGURED) {
    return null;
  }
  if (user.driveRootFolderId) {
    return user.driveRootFolderId;
  }
  const folderName = `assets-diary-${user.id}`;
  const parentId = DRIVE_ROOT_FOLDER_ID || undefined;
  const folderId = await createDriveFolder(folderName, parentId);
  await updateUser(user.id, { driveRootFolderId: folderId });
  return folderId;
}

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    console.log('[backend] POST /api/register from', req.ip, email);
  } catch (e) {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  const userId = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: userId,
    email: email.toLowerCase(),
    passwordHash: hashedPassword,
    createdAt: new Date().toISOString(),
    driveRootFolderId: null,
    verified: false,
    verificationToken: createToken(),
    verificationExpires: Date.now() + 1000 * 60 * 60 * 24 * 7
  };
  await createUser(user);

  try {
    const verifyUrl = (process.env.BACKEND_PUBLIC_URL || ('http://localhost:' + PORT)) + '/api/verify-email?token=' + encodeURIComponent(user.verificationToken);
    await sendMail(user.email, 'Verify your Assets Diary account', 'Please verify your account by visiting: ' + verifyUrl, '<p>Please verify your account by clicking <a href="' + verifyUrl + '">this link</a>.</p>');
  } catch (e) {
    console.warn('Failed to queue verification email:', e && e.message);
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, verified: user.verified } });
});

app.get('/api/verify-email', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).send('Missing token');
  const user = await supabase
    .from('users')
    .select('*')
    .eq('verificationToken', token)
    .single()
    .then(r => r.data)
    .catch(() => null);
  if (!user || !user.verificationExpires || Date.now() >= user.verificationExpires) {
    return res.status(400).send('Invalid or expired token');
  }
  await updateUser(user.id, {
    verified: true,
    verificationToken: null,
    verificationExpires: null
  });
  res.send('Email verified. You can now return to the plugin.');
});

app.post('/api/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await getUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'Unknown email' });
  const verificationToken = createToken();
  const verificationExpires = Date.now() + 1000 * 60 * 60 * 24 * 7;
  await updateUser(user.id, { verificationToken, verificationExpires });
  try {
    const verifyUrl = (process.env.BACKEND_PUBLIC_URL || ('http://localhost:' + PORT)) + '/api/verify-email?token=' + encodeURIComponent(verificationToken);
    await sendMail(user.email, 'Verify your Assets Diary account', 'Please verify your account by visiting: ' + verifyUrl, '<p>Please verify your account by clicking <a href="' + verifyUrl + '">this link</a>.</p>');
  } catch (e) {}
  res.json({ success: true });
});

app.post('/api/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const user = await getUserByEmail(email);
  if (!user) return res.status(200).json({ success: true });
  const resetToken = createToken();
  const resetExpires = Date.now() + 1000 * 60 * 60;
  await updateUser(user.id, { resetToken, resetExpires });
  try {
    const resetUrl = (process.env.BACKEND_PUBLIC_URL || ('http://localhost:' + PORT)) + '/reset-password?token=' + encodeURIComponent(resetToken);
    await sendMail(user.email, 'Reset your Assets Diary password', 'Reset your password: ' + resetUrl, '<p>Reset your password by clicking <a href="' + resetUrl + '">this link</a>. The link expires in 1 hour.</p>');
  } catch (e) {}
  res.json({ success: true });
});

app.post('/api/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
  const user = await supabase
    .from('users')
    .select('*')
    .eq('resetToken', token)
    .single()
    .then(r => r.data)
    .catch(() => null);
  if (!user || !user.resetExpires || Date.now() >= user.resetExpires) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }
  const hashed = await bcrypt.hash(password, 10);
  await updateUser(user.id, { passwordHash: hashed, resetToken: null, resetExpires: null });
  res.json({ success: true });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = await getUserByEmail(email);
  if (!user) {
    return res.status(400).json({ error: 'Invalid credentials.' });
  }
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(400).json({ error: 'Invalid credentials.' });
  }
  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, verified: !!user.verified } });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const user = req.user;
  res.json({ id: user.id, email: user.email });
});

app.get('/api/folders', authMiddleware, async (req, res) => {
  const folders = await getUserFolders(req.user.id);
  res.json({ folders });
});

app.post('/api/folders', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Folder name is required.' });
  const folder = {
    userId: req.user.id,
    folderId: uuidv4(),
    name,
    archived: false,
    createdAt: new Date().toISOString(),
    styles: []
  };
  const created = await createFolder(folder);
  res.json({ folder: created });
});

app.put('/api/folders/:folderId', authMiddleware, async (req, res) => {
  const { folderId } = req.params;
  const { name, archived } = req.body;
  const folder = await getFolder(folderId, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (archived !== undefined) updates.archived = !!archived;
  const updated = await updateFolder(folderId, updates);
  res.json({ folder: updated });
});

app.delete('/api/folders/:folderId', authMiddleware, async (req, res) => {
  const { folderId } = req.params;
  const folder = await getFolder(folderId, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });

  const { data: styles } = await supabase.from('styles').select('*').eq('folderId', folderId);
  for (const style of styles || []) {
    if (style.driveSvgFileId) {
      try { await deleteDriveFile(style.driveSvgFileId); } catch (e) {}
    }
    if (style.drivePngFileId) {
      try { await deleteDriveFile(style.drivePngFileId); } catch (e) {}
    }
  }
  await deleteStylesByFolder(folderId);
  await deleteFolder(folderId);
  res.json({ success: true });
});

app.post('/api/folders/:folderId/styles', authMiddleware, async (req, res) => {
  const { folderId } = req.params;
  const { title, width, height, svgData, pngData } = req.body;
  if (!title || !svgData || !pngData) {
    return res.status(400).json({ error: 'Title, svgData, and pngData are required.' });
  }
  const folder = await getFolder(folderId, req.user.id);
  if (!folder) return res.status(404).json({ error: 'Folder not found.' });

  const userDriveRoot = await ensureUserFolder(req.user);
  const styleId = uuidv4();
  const style = {
    userId: req.user.id,
    folderId,
    styleId,
    title,
    createdAt: new Date().toISOString(),
    width: width || 0,
    height: height || 0
  };

  if (userDriveRoot) {
    try {
      const svgFileId = await uploadDriveFile(`${styleId}.svg`, 'image/svg+xml', svgData, userDriveRoot);
      const pngFileId = await uploadDriveFile(`${styleId}.png`, 'image/png', pngData, userDriveRoot);
      style.driveSvgFileId = svgFileId;
      style.drivePngFileId = pngFileId;
    } catch (e) {
      style.svgData = svgData;
      style.pngData = pngData;
    }
  } else {
    style.svgData = svgData;
    style.pngData = pngData;
  }

  const created = await createStyle(style);
  res.json({ style: created });
});

app.get('/api/folders/:folderId/styles/:styleId/preview', authMiddleware, async (req, res) => {
  const { folderId, styleId } = req.params;
  const style = await getStyle(styleId, folderId);
  if (!style || style.userId !== req.user.id) {
    return res.status(404).json({ error: 'Style not found.' });
  }
  try {
    if (style.pngData) {
      return res.json({ data: style.pngData });
    }
    if (!style.drivePngFileId) return res.status(404).json({ error: 'Style not found.' });
    const dataBase64 = await downloadDriveFileBase64(style.drivePngFileId);
    res.json({ data: dataBase64 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load preview.' });
  }
});

app.get('/api/folders/:folderId/styles/:styleId/svg', authMiddleware, async (req, res) => {
  const { folderId, styleId } = req.params;
  const style = await getStyle(styleId, folderId);
  if (!style || style.userId !== req.user.id) {
    return res.status(404).json({ error: 'Style not found.' });
  }
  try {
    if (style.svgData) {
      const svgText = Buffer.from(style.svgData, 'base64').toString('utf8');
      return res.type('image/svg+xml').send(svgText);
    }
    if (!style.driveSvgFileId) return res.status(404).json({ error: 'Style not found.' });
    const svgText = await downloadDriveFileText(style.driveSvgFileId);
    res.type('image/svg+xml').send(svgText);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load SVG.' });
  }
});

app.delete('/api/folders/:folderId/styles/:styleId', authMiddleware, async (req, res) => {
  const { folderId, styleId } = req.params;
  const style = await getStyle(styleId, folderId);
  if (!style || style.userId !== req.user.id) {
    return res.status(404).json({ error: 'Style not found.' });
  }
  if (style.driveSvgFileId) {
    try { await deleteDriveFile(style.driveSvgFileId); } catch (e) {}
  }
  if (style.drivePngFileId) {
    try { await deleteDriveFile(style.drivePngFileId); } catch (e) {}
  }
  await deleteStyle(styleId);
  res.json({ success: true });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Assets Diary backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
