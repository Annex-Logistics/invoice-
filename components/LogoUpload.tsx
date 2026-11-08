"use client";

import { Image as ImageIcon, X } from "lucide-react";
import { useRef } from "react";

type Props = {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
};

export function LogoUpload({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onChange(reader.result);
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
            onClick={() => onChange(undefined)}
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
    </div>
  );
}
