"use client";
import { useState } from "react";
import { PhotoAnalysis } from "./photo-analysis";
export function AiTest() {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="panel form-stack" style={{ maxWidth: 700 }}>
      <label>
        Foto pengujian
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <PhotoAnalysis file={file} />
    </div>
  );
}
