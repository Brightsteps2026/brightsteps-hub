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
// Links are kept for a while and reused, so the browser can show photos it already
// downloaded instead of fetching every photo again each time a page opens. Requests made
// at the same moment (e.g. every photo on the Students page) go out as one batch.
const LINK_SECONDS = 60 * 60;
const REUSE_MS = 50 * 60 * 1000;
const urlCache = new Map(); // path -> { url, expires }
let queue = new Map(); // path -> [{ resolve, reject }]
let queueTimer = null;

async function flushQueue() {
  const batch = queue;
  queue = new Map();
  queueTimer = null;
  const paths = [...batch.keys()];
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
    if (error) throw error;
    const byPath = new Map((data || []).map((d) => [d.path, d]));
    for (const path of paths) {
      const d = byPath.get(path);
      const waiters = batch.get(path);
      if (d && d.signedUrl && !d.error) {
        urlCache.set(path, { url: d.signedUrl, expires: Date.now() + REUSE_MS });
        waiters.forEach((w) => w.resolve(d.signedUrl));
      } else {
        waiters.forEach((w) => w.reject(new Error((d && d.error) || "Could not open file")));
      }
    }
  } catch (err) {
    batch.forEach((waiters) => waiters.forEach((w) => w.reject(err)));
  }
}

export function getAttachmentUrl(path) {
  const cached = urlCache.get(path);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.url);
  return new Promise((resolve, reject) => {
    if (!queue.has(path)) queue.set(path, []);
    queue.get(path).push({ resolve, reject });
    if (!queueTimer) queueTimer = setTimeout(flushQueue, 30);
  });
}

// Phone photos are often 3–5 MB. Shrink an image to at most `maxSide` pixels and save it
// as JPEG before uploading. Returns the original file if it is already small or cannot be read.
export async function shrinkImage(file, maxSide = 900) {
  if (!file || !file.type || !file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
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
