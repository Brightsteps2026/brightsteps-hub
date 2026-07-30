import { supabase } from "./supabaseClient";

const BUCKET = "attachments";

// Uploads a file into a folder (e.g. "portfolio" or "assignments") and
// returns the metadata we save alongside the entry in app_storage.
export async function uploadAttachment(file, folder) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return {
    path,
    name: file.name,
    size: file.size,
    type: file.type,
    uploadedAt: new Date().toISOString(),
  };
}

// Files are private, so viewing requires a short-lived signed link generated on demand.
export async function getAttachmentUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(path) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
