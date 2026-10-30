import { ApiError } from "@/api/client";

/** Shrinks an uploaded photo to at most `max` px and returns a JPEG data URL (kept small for local storage). */
export function fileToDataUrl(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Choose an image file")); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that image")); };
    img.src = url;
  });
}

/** Field errors from a 422, or a single message for anything else. */
export function errorsFrom(e: unknown): { fields: Record<string, string>; message: string } {
  if (e instanceof ApiError) return { fields: e.fields ?? {}, message: e.message };
  return { fields: {}, message: (e as Error)?.message ?? "Something went wrong" };
}

export const toPaise = (rupees: string) => (rupees.trim() === "" ? null : Math.round(Number(rupees) * 100));
export const toRupeesInput = (paise: number | null | undefined) => (paise == null ? "" : String(paise / 100));

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="adm-toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="adm-toggle-track" aria-hidden="true" />
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export const FieldError = ({ msg }: { msg?: string }) => (msg ? <span className="field-error">{msg}</span> : null);

/** Shown on rows that still hold seed data, so placeholders are not mistaken for checked values. */
export const SeedFlag = ({ by }: { by: string }) => (by === "seed" ? <span className="badge badge-saffron" title="Seed data: check and save in admin">Check</span> : null);
