import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { uploadAttachment } from "./lib/attachments";

// Voice reflection for the youngest students (Pre-N to Grade 1, Myri, 28 Oct 2026).
// Big, simple buttons: tap to record, tap to stop. The recording is uploaded
// like any other portfolio file and appears as a player on the entry.
const MAX_SECONDS = 180;

function pickType() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac", "audio/ogg"];
  if (typeof MediaRecorder === "undefined") return null;
  return options.find((t) => MediaRecorder.isTypeSupported?.(t)) || "";
}

export default function VoiceRecorder({ folder = "portfolio", onRecorded }) {
  const [state, setState] = useState("idle"); // idle | recording | saving
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const rec = useRef(null);
  const chunks = useRef([]);
  const stream = useRef(null);
  const timer = useRef(null);

  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && pickType() !== null;

  const cleanup = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => cleanup, []);

  const stop = () => { if (rec.current && rec.current.state === "recording") rec.current.stop(); };

  const start = async () => {
    setError("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("The Hub can't use the microphone. Allow the microphone for this site and try again.");
      return;
    }
    const type = pickType();
    const r = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      cleanup();
      const mime = (r.mimeType || type || "audio/webm").split(";")[0];
      const blob = new Blob(chunks.current, { type: mime });
      if (!blob.size) { setState("idle"); return; }
      const ext = mime.includes("mp4") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const stamp = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
      const file = new File([blob], `Voice recording ${stamp}.${ext}`, { type: mime });
      setState("saving");
      try {
        const meta = await uploadAttachment(file, folder);
        onRecorded?.(meta);
      } catch {
        setError("The recording couldn't be saved. Check your connection and try again.");
      }
      setState("idle");
    };
    rec.current = r;
    r.start();
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  };

  if (!supported) return <p className="bsf-muted" style={{ fontSize: 13 }}>Voice recording isn't available in this browser.</p>;

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const base = { display: "inline-flex", alignItems: "center", gap: 10, border: "none", borderRadius: 999, padding: "14px 22px", fontSize: 16, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#fff" };

  return (
    <div className="bsf-voice">
      {state === "idle" && (
        <button type="button" style={{ ...base, background: "#801524" }} onClick={start}>
          <Mic size={22} /> Record my voice
        </button>
      )}
      {state === "recording" && (
        <button type="button" style={{ ...base, background: "#B23A3A" }} onClick={stop}>
          <Square size={18} fill="#fff" /> Stop · {mmss}
        </button>
      )}
      {state === "saving" && (
        <span style={{ ...base, background: "#9AA3A4", cursor: "default" }}>
          <Loader2 size={18} className="bsf-spin" /> Saving…
        </span>
      )}
      {state === "recording" && <p className="bsf-muted" style={{ margin: "6px 0 0", fontSize: 12 }}>Recording… tap Stop when you're done (3 minutes max).</p>}
      {error && <p className="bsf-formerror">{error}</p>}
    </div>
  );
}
