"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
};

// Normalize whatever the user picks (PNG, JPEG, GIF, SVG, …) into a PNG
// data URL, bounded to 512px on the long edge. This guarantees the logo
// renders inside the exported PDF (jsPDF.addImage has no SVG support)
// and keeps localStorage from filling up with multi-megabyte uploads.
function normalizeToPng(src: string, maxDim = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w0 = img.naturalWidth || img.width;
      const h0 = img.naturalHeight || img.height;
      if (!w0 || !h0) return reject(new Error("empty image"));
      const scale = Math.min(1, maxDim / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * scale));
      const h = Math.max(1, Math.round(h0 * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas context"));
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

export function LogoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    // Cap the raw upload so FileReader.readAsDataURL can't be used to
    // OOM the browser with a multi-hundred-MB file. 8 MB is plenty for
    // a logo and covers 12-megapixel JPEGs.
    const MAX_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setError("That image is too large (max 8 MB). Try a smaller one.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== "string") return;
      try {
        const png = await normalizeToPng(reader.result);
        onChange(png);
      } catch {
        // Fall back to the raw data URL if canvas rasterization fails —
        // the preview still works even when the PDF exporter can't use it.
        onChange(reader.result);
        setError("We couldn't convert this image for PDF export. The preview will still show it.");
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? undefined)}
      />
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Business logo"
            className="h-20 w-20 rounded-lg border border-ink-100 bg-white object-contain p-1"
          />
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setError(null);
            }}
            className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-ink-500 shadow ring-1 ring-ink-200 hover:text-rose-600"
            aria-label="Remove logo"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ink-200 bg-white text-ink-400 transition-colors hover:border-brand-400 hover:text-brand-600"
        >
          <ImageIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium uppercase tracking-wide">Logo</span>
        </button>
      )}
      {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}
    </div>
  );
}
