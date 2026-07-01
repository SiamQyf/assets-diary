const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://tqlsgrdwblggpwtcpmcn.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your_publishable_key';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============= USERS =============
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data || null;
}

async function getUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function createUser(user) {
  const { data, error } = await supabase
    .from('users')
    .insert([user])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateUser(userId, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============= FOLDERS =============
async function getUserFolders(userId) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function createFolder(folder) {
  const { data, error } = await supabase
    .from('folders')
    .insert([folder])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateFolder(folderId, updates) {
  const { data, error } = await supabase
    .from('folders')
    .update(updates)
    .eq('folderId', folderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getFolder(folderId, userId) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('folderId', folderId)
    .eq('userId', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function deleteFolder(folderId) {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('folderId', folderId);
  if (error) throw error;
}

// ============= STYLES =============
async function createStyle(style) {
  const { data, error } = await supabase
    .from('styles')
    .insert([style])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getStyle(styleId, folderId) {
  const { data, error } = await supabase
    .from('styles')
    .select('*')
    .eq('styleId', styleId)
    .eq('folderId', folderId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function updateStyle(styleId, updates) {
  const { data, error } = await supabase
    .from('styles')
    .update(updates)
    .eq('styleId', styleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteStyle(styleId) {
  const { error } = await supabase
    .from('styles')
    .delete()
    .eq('styleId', styleId);
  if (error) throw error;
}

async function deleteStylesByFolder(folderId) {
  const { error } = await supabase
    .from('styles')
    .delete()
    .eq('folderId', folderId);
  if (error) throw error;
}

module.exports = {
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
};
