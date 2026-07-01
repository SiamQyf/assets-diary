// Backend-backed plugin for Assets Diary with per-user storage in a shared Google Drive account.

figma.showUI(__html__, { width: 540, height: 700, title: 'Assets Diary' });

const BACKEND_URLS = ['https://assets-diary.vercel.app', 'https://assets-diary-production.vercel.app', 'http://localhost:3000'];
const AUTH_STORAGE_KEY = 'assets-diary-auth';
let authToken = null;
let currentUser = null;
let footerFolders = [];

async function saveAuthStorage() {
  try {
    await figma.clientStorage.setAsync(AUTH_STORAGE_KEY, {
      token: authToken,
      user: currentUser
    });
  } catch (err) {
    // Continue without persisted auth if client storage is unavailable.
  }
}

async function loadAuthStorage() {
  try {
    const stored = await figma.clientStorage.getAsync(AUTH_STORAGE_KEY);
    if (stored && stored.token) {
      authToken = stored.token;
      currentUser = stored.user || null;
    }
  } catch (err) {
    authToken = null;
    currentUser = null;
  }
}

async function clearAuthStorage() {
  authToken = null;
  currentUser = null;
  try {
    await figma.clientStorage.setAsync(AUTH_STORAGE_KEY, {});
  } catch (err) {
    // Ignore storage errors during logout.
  }
}

function getAuthHeaders() {
  return authToken ? { Authorization: 'Bearer ' + authToken } : {};
}

function buildHeaders(options) {
  options = options || {};
  var headers = {};
  var authHeaders = getAuthHeaders();
  var optionHeaders = options.headers || {};

  Object.keys(authHeaders).forEach(function(key) {
    headers[key] = authHeaders[key];
  });
  Object.keys(optionHeaders).forEach(function(key) {
    headers[key] = optionHeaders[key];
  });

  if (!headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function buildRequestOptions(options) {
  options = options || {};
  var requestOptions = {};

  Object.keys(options).forEach(function(key) {
    requestOptions[key] = options[key];
  });

  requestOptions.headers = buildHeaders(options);
  return requestOptions;
}

async function fetchBackend(path, options) {
  let lastError = null;
  for (var i = 0; i < BACKEND_URLS.length; i++) {
    const baseUrl = BACKEND_URLS[i];
    try {
      const res = await fetch(baseUrl + path, buildRequestOptions(options));
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = null;
      }
      if (!res.ok) {
        const message = data && data.error ? data.error : text || res.statusText;
        throw new Error(message);
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Unable to reach the backend server.');
}

async function fetchBackendText(path, options) {
  let lastError = null;
  for (var i = 0; i < BACKEND_URLS.length; i++) {
    const baseUrl = BACKEND_URLS[i];
    try {
      const res = await fetch(baseUrl + path, buildRequestOptions(options));
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return await res.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Unable to reach the backend server.');
}

function encodeBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

function getFolderById(folderId) {
  return footerFolders.find(f => f.folderId === folderId);
}

function getStyle(folderId, styleId) {
  const folder = getFolderById(folderId);
  if (!folder || !folder.styles) return null;
  return folder.styles.find(s => s.styleId === styleId);
}

function getSelectedFrameInfo() {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  if (node.type !== 'FRAME') return null;
  return {
    name: node.name,
    width: node.width,
    height: node.height,
    nodeId: node.id
  };
}

async function ensureAuthenticated() {
  if (!authToken) return false;
  try {
    const user = await fetchBackend('/api/me', { method: 'GET' });
    currentUser = user;
    await saveAuthStorage();
    return true;
  } catch (err) {
    await clearAuthStorage();
    return false;
  }
}

async function loadFooterStyles() {
  const isAuthenticated = await ensureAuthenticated();
  if (!isAuthenticated) {
    footerFolders = [];
    figma.ui.postMessage({ type: 'auth-state', authenticated: false });
    return;
  }

  const selectedFrame = getSelectedFrameInfo();
  try {
    const data = await fetchBackend('/api/folders', { method: 'GET' });
    footerFolders = Array.isArray(data.folders) ? data.folders : [];
    figma.ui.postMessage({
      type: 'style-state',
      folders: footerFolders,
      selectedFrame,
      currentUser,
      authenticated: true
    });
  } catch (err) {
    footerFolders = [];
    figma.ui.postMessage({ type: 'error', message: err.message });
  }
}

async function loginUser(email, password) {
  const data = await fetchBackend('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  authToken = data.token;
  currentUser = data.user;
  await saveAuthStorage();
  await loadFooterStyles();
  figma.ui.postMessage({ type: 'auth-state', authenticated: true, currentUser });
}

async function registerUser(email, password) {
  const data = await fetchBackend('/api/register', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  authToken = data.token;
  currentUser = data.user;
  await saveAuthStorage();
  await loadFooterStyles();
  figma.ui.postMessage({ type: 'auth-state', authenticated: true, currentUser });
}

async function logoutUser() {
  await clearAuthStorage();
  footerFolders = [];
  figma.ui.postMessage({ type: 'auth-state', authenticated: false });
}

async function createFolder(name) {
  await fetchBackend('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  await loadFooterStyles();
}

async function renameFolder(folderId, newName) {
  await fetchBackend(`/api/folders/${encodeURIComponent(folderId)}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName })
  });
  await loadFooterStyles();
}

async function archiveFolder(folderId, archived) {
  await fetchBackend(`/api/folders/${encodeURIComponent(folderId)}`, {
    method: 'PUT',
    body: JSON.stringify({ archived })
  });
  await loadFooterStyles();
}

async function deleteFolder(folderId) {
  await fetchBackend(`/api/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE'
  });
  await loadFooterStyles();
}

async function saveSelectedFrameAsStyle(folderId) {
  if (!authToken) throw new Error('Please sign in to save a footer.');
  const folder = getFolderById(folderId);
  if (!folder) throw new Error('Folder not found.');

  const selection = figma.currentPage.selection;
  if (selection.length !== 1) throw new Error('Please select a single frame first.');
  const node = selection[0];
  if (node.type !== 'FRAME') throw new Error('Please select a frame to capture.');

  const svgBytes = await node.exportAsync({ format: 'SVG', svgOutlineText: false });
  const pngBytes = await node.exportAsync({ format: 'PNG' });

  const svgData = encodeBase64(svgBytes);
  const pngData = encodeBase64(pngBytes);

  await fetchBackend(`/api/folders/${encodeURIComponent(folderId)}/styles`, {
    method: 'POST',
    body: JSON.stringify({
      title: node.name || 'Captured Frame',
      width: node.width,
      height: node.height,
      svgData,
      pngData
    })
  });

  await loadFooterStyles();
  figma.ui.postMessage({ type: 'code-generated' });
}

async function deleteFooterStyle(folderId, styleId) {
  await fetchBackend(`/api/folders/${encodeURIComponent(folderId)}/styles/${encodeURIComponent(styleId)}`, {
    method: 'DELETE'
  });
  await loadFooterStyles();
}

async function previewStyle(folderId, styleId) {
  const style = getStyle(folderId, styleId);
  if (!style || !authToken) return;
  try {
    const data = await fetchBackend(`/api/folders/${encodeURIComponent(folderId)}/styles/${encodeURIComponent(styleId)}/preview`, {
      method: 'GET'
    });
    figma.ui.postMessage({ type: 'preview', styleId, data: data.data });
  } catch (err) {
    // ignore preview failures
  }
}

async function generateSavedCapture(folderId, styleId) {
  const style = getStyle(folderId, styleId);
  if (!style) throw new Error('Saved capture not found.');
  if (!authToken) throw new Error('Please sign in to restore a footer.');
  try {
    const svgText = await fetchBackendText(`/api/folders/${encodeURIComponent(folderId)}/styles/${encodeURIComponent(styleId)}/svg`, {
      method: 'GET'
    });
    const node = figma.createNodeFromSvg(svgText);
    figma.currentPage.appendChild(node);
    node.x = figma.viewport.center.x - node.width / 2;
    node.y = figma.viewport.center.y - node.height / 2;
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);
    figma.ui.postMessage({ type: 'success' });
  } catch (err) {
    throw new Error('Failed to restore saved capture from server.');
  }
}

figma.ui.onmessage = async (msg) => {
  try {
    if (!msg || !msg.type) return;
    if (msg.type === 'request-styles') {
      await loadFooterStyles();
      return;
    }
    if (msg.type === 'create-folder') {
      await createFolder(msg.name || 'New Folder');
      return;
    }
    if (msg.type === 'delete-folder') {
      await deleteFolder(msg.folderId);
      return;
    }
    if (msg.type === 'archive-folder') {
      await archiveFolder(msg.folderId, !!msg.archived);
      return;
    }
    if (msg.type === 'rename-folder') {
      await renameFolder(msg.folderId, msg.newName || '');
      return;
    }
    if (msg.type === 'add-selected-footer') {
      await saveSelectedFrameAsStyle(msg.folderId);
      return;
    }
    if (msg.type === 'login') {
      await loginUser(msg.email, msg.password);
      return;
    }
    if (msg.type === 'register') {
      await registerUser(msg.email, msg.password);
      return;
    }
    if (msg.type === 'request-password-reset') {
      try {
        await fetchBackend('/api/request-password-reset', { method: 'POST', body: JSON.stringify({ email: msg.email }) });
        figma.ui.postMessage({ type: 'password-reset-sent', email: msg.email });
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: String(e.message || e) });
      }
      return;
    }
    if (msg.type === 'reset-password') {
      try {
        await fetchBackend('/api/reset-password', { method: 'POST', body: JSON.stringify({ token: msg.token, password: msg.password }) });
        figma.ui.postMessage({ type: 'password-reset-success' });
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: String(e.message || e) });
      }
      return;
    }
    if (msg.type === 'resend-verification') {
      try {
        await fetchBackend('/api/resend-verification', { method: 'POST', body: JSON.stringify({ email: msg.email }) });
        figma.ui.postMessage({ type: 'verification-sent', email: msg.email });
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: String(e.message || e) });
      }
      return;
    }
    if (msg.type === 'logout') {
      await logoutUser();
      return;
    }
    if (msg.type === 'preview') {
      await previewStyle(msg.folderId, msg.styleId);
      return;
    }
    if (msg.type === 'generate') {
      await generateSavedCapture(msg.folderId, msg.styleId);
      return;
    }
    if (msg.type === 'delete-footer-style') {
      await deleteFooterStyle(msg.folderId, msg.styleId);
      return;
    }
    figma.ui.postMessage({ type: 'error', message: 'Unhandled message type: ' + msg.type });
  } catch (err) {
    const message = String(err.message || err);
    figma.ui.postMessage({ type: 'error', message });
  }
};

figma.on('selectionchange', () => {
  figma.ui.postMessage({ type: 'style-state', folders: footerFolders, selectedFrame: getSelectedFrameInfo() });
});

(async () => {
  await loadAuthStorage();
  await loadFooterStyles();
})();
