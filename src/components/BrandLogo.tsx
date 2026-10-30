import { useState } from "react";

// The original logo, shown unaltered at /public/brand/logo.png. It sits on a white disc so it stays
// legible on dark scenes. Until the file is added, the brand name renders as text instead.
export const LOGO_SRC = "/brand/logo.png";

export function BrandLogo({ size = 44 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {!failed && (
        <span style={{ width: size, height: size, borderRadius: "50%", background: "#fff", overflow: "hidden", flexShrink: 0, boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
          <img src={LOGO_SRC} alt="Sri Sastha Paruthipaal logo" onError={() => setFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </span>
      )}
      <span className="logo-text">
        <span className="logo-line1">Sri Sastha</span>
        <span className="logo-line2">Paruthipaal</span>
      </span>
    </span>
  );
}
