import React, { useEffect, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { uploadAttachment, getAttachmentUrl, deleteAttachment } from "./lib/attachments";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB, matches the Supabase bucket limit

// Single photo upload and preview, used on student profiles.
// `photo` is metadata like { path, name, size, type, uploadedAt } or null/undefined.
export default function StudentPhotoField({ photo, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!photo || !photo.path) {
      setPreviewUrl("");
      return;
    }
    getAttachmentUrl(photo.path)
      .then((url) => { if (!cancelled) setPreviewUrl(url); })
      .catch(() => { if (!cancelled) setPreviewUrl(""); });
    return () => { cancelled = true; };
  }, [photo && photo.path]);

  const handleFile = async (fileList) => {
    setError("");
    const file = (fileList || [])[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("That photo is over 50MB and cannot be uploaded.");
      return;
    }
    setUploading(true);
    try {
      if (photo && photo.path) {
        await deleteAttachment(photo.path);
      }
      const meta = await uploadAttachment(file, "student-photos");
      onChange(meta);
    } catch (err) {
      setError("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (photo && photo.path) {
      await deleteAttachment(photo.path);
    }
    onChange(null);
  };

  return (
    <div className="bsf-photofield">
      <div className="bsf-photofield-preview">
        {previewUrl ? <img src={previewUrl} alt="Student" /> : <Camera size={22} />}
      </div>
      <div className="bsf-photofield-actions">
        <label className="bsf-attachment-upload">
          {uploading ? <Loader2 size={16} className="bsf-spin" /> : <Camera size={16} />}
          <span>{uploading ? "Uploading..." : photo ? "Change photo" : "Add photo"}</span>
          <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => handleFile(e.target.files)} />
        </label>
        {photo && (
          <button type="button" className="bsf-iconbtn" onClick={removePhoto} aria-label="Remove photo">
            <X size={14} />
          </button>
        )}
      </div>
      {error && <p className="bsf-formerror">{error}</p>}
    </div>
  );
}
