import { useScrollProgress } from "@/hooks/useReveal";

export function ScrollProgress() {
  const p = useScrollProgress();
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 8000, pointerEvents: "none" }}>
      <div style={{
        height: "100%", width: `${p * 100}%`,
        background: "linear-gradient(90deg, var(--accent-gold), var(--accent-gold-bright))",
        transition: "width 80ms linear",
      }} />
    </div>
  );
}
