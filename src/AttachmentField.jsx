import React, { useEffect, useState } from "react";
import { Paperclip, X, Loader2, Download } from "lucide-react";
import { uploadAttachment, getAttachmentUrl, deleteAttachment, formatFileSize } from "./lib/attachments";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB, matches the Supabase bucket limit

// Voice recordings play right on the page instead of downloading.
function AudioPlayer({ path }) {
  const [url, setUrl] = useState("");
  useEffect(() => { let on = true; getAttachmentUrl(path).then((u) => on && setUrl(u)).catch(() => {}); return () => { on = false; }; }, [path]);
  if (!url) return <span className="bsf-muted" style={{ fontSize: 13 }}>🎙️ …</span>;
  return <audio controls preload="metadata" src={url} style={{ height: 40, maxWidth: 260 }} />;
}

// Reusable file attachment control. Pass in the current list of attachments
// and a folder name (e.g. "portfolio", "assignments") and it handles
// uploading, listing, opening, and removing files.
export default function AttachmentField({ folder, files, onChange, readOnly = false }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = async (fileList) => {
    setError("");
    const chosen = Array.from(fileList || []);
    if (chosen.length === 0) return;
    const tooBig = chosen.find((f) => f.size > MAX_SIZE);
    if (tooBig) {
      setError(`${tooBig.name} is over 50MB and cannot be uploaded.`);
      return;
    }
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of chosen) {
        const meta = await uploadAttachment(file, folder);
        uploaded.push(meta);
      }
      onChange([...(files || []), ...uploaded]);
    } catch (err) {
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (path) => {
    try {
      const url = await getAttachmentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open this file. It may have been removed.");
    }
  };

  const removeFile = async (path) => {
    await deleteAttachment(path);
    onChange((files || []).filter((f) => f.path !== path));
  };

  return (
    <div className="bsf-attachments">
      {(files || []).length > 0 && (
        <div className="bsf-attachment-list">
          {files.map((f) => (f.type || "").startsWith("audio/") ? (
            <div key={f.path} className="bsf-attachment-chip" style={{ alignItems: "center", gap: 6 }}>
              <AudioPlayer path={f.path} />
              {!readOnly && (
                <button type="button" className="bsf-iconbtn" onClick={() => removeFile(f.path)} aria-label="Remove recording">
                  <X size={14} />
                </button>
              )}
            </div>
          ) : (
            <div key={f.path} className="bsf-attachment-chip">
              <button type="button" className="bsf-attachment-open" onClick={() => openFile(f.path)}>
                <Download size={14} />
                <span>{f.name}</span>
                <span className="bsf-muted">{formatFileSize(f.size)}</span>
              </button>
              {!readOnly && (
                <button type="button" className="bsf-iconbtn" onClick={() => removeFile(f.path)} aria-label="Remove file">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <label className="bsf-attachment-upload">
          {uploading ? <Loader2 size={16} className="bsf-spin" /> : <Paperclip size={16} />}
          <span>{uploading ? "Uploading..." : "Attach a file"}</span>
          <input
            type="file"
            multiple
            hidden
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      )}
      {error && <p className="bsf-formerror">{error}</p>}
    </div>
  );
}
