import { supabase } from "./supabaseClient";

// This file makes window.storage work the same way it did inside Claude,
// but backed by a real Supabase table instead. The rest of the app
// (App.jsx) is completely unchanged and does not know the difference.

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || "anonymous";
}

async function rowKeyFor(key, shared) {
  if (shared) return key;
  const uid = await currentUserId();
  return `${uid}:${key}`;
}

async function get(key, shared = false) {
  const rowKey = await rowKeyFor(key, shared);
  const { data, error } = await supabase
    .from("app_storage")
    .select("value")
    .eq("key", rowKey)
    .eq("shared", shared)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`No value found for key: ${key}`);
  return { key, value: data.value, shared };
}

async function set(key, value, shared = false) {
  const rowKey = await rowKeyFor(key, shared);
  const { error } = await supabase
    .from("app_storage")
    .upsert({ key: rowKey, value, shared, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    console.error("Storage set failed", error);
    return null;
  }
  return { key, value, shared };
}

async function del(key, shared = false) {
  const rowKey = await rowKeyFor(key, shared);
  const { error } = await supabase.from("app_storage").delete().eq("key", rowKey);
  if (error) {
    console.error("Storage delete failed", error);
    return null;
  }
  return { key, deleted: true, shared };
}

async function list(prefix = "", shared = false) {
  let query = supabase.from("app_storage").select("key").eq("shared", shared);
  if (prefix) query = query.ilike("key", `${prefix}%`);
  const { data, error } = await query;
  if (error) {
    console.error("Storage list failed", error);
    return null;
  }
  return { keys: (data || []).map((r) => r.key), prefix, shared };
}

if (typeof window !== "undefined") {
  window.storage = { get, set, delete: del, list };
}
