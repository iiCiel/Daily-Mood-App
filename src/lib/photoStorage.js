// NOTE: must be the `/legacy` entry. In expo-file-system v19 (SDK 54) the main
// entry only exports the new File/Directory API — documentDirectory is undefined
// there and copyAsync/deleteAsync/makeDirectoryAsync throw at runtime, which
// silently left photos sitting in the ImagePicker cache instead of persisting them.
import * as FileSystem from 'expo-file-system/legacy';

const PHOTO_DIR = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}mood-photos/`
  : null;

function photoExtension(uri) {
  const cleanUri = String(uri || '').split('?')[0].toLowerCase();
  const match = cleanUri.match(/\.([a-z0-9]+)$/);
  const ext = match?.[1];
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
}

function photoName(uri) {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${photoExtension(uri)}`;
}

async function ensurePhotoDir() {
  if (!PHOTO_DIR) return false;
  try {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  } catch {}
  return true;
}

export function isManagedPhotoUri(uri) {
  return !!PHOTO_DIR && typeof uri === 'string' && uri.startsWith(PHOTO_DIR);
}

export async function persistPhotoAsync(uri) {
  if (!uri || isManagedPhotoUri(uri)) return uri;
  if (!(await ensurePhotoDir())) return uri;

  const dest = `${PHOTO_DIR}${photoName(uri)}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

export async function deleteManagedPhotoAsync(uri) {
  if (!isManagedPhotoUri(uri)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}
