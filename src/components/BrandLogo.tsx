import { useLang } from "@/i18n";

// The original roundels (English and Tamil), shown as supplied: never cropped, recoloured or redrawn.
export const LOGO_SRC = "/brand/logo.webp";
export const LOGO_TA_SRC = "/brand/logo-ta.webp";

/** The roundel in the visitor's language, optionally with the brand name set beside it. */
export function BrandLogo({ size = 52, withName = true }: { size?: number; withName?: boolean }) {
  const { lang } = useLang();
  return (
    <span className="brand">
      <img src={lang === "ta" ? LOGO_TA_SRC : LOGO_SRC} alt="Sri Sastha Paruthipaal" width={size} height={Math.round(size * 0.86)} style={{ width: size, height: "auto" }} />
      {withName && (
        <span className="brand-name">
          <span className="brand-l1">{lang === "ta" ? "ஸ்ரீ சாஸ்தா" : "Sri Sastha"}</span>
          <span className="brand-l2">{lang === "ta" ? "பருத்திப்பால்" : "Paruthipaal"}</span>
        </span>
      )}
    </span>
  );
}
