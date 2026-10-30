import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  title?: string;
}

export function Modal({ open, onClose, children, maxWidth = 640, title }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Callers pass onClose as an inline function, so it is a new function on every render. Reading it
  // through a ref keeps the effect below tied to `open` only; otherwise it re-ran on every keystroke in
  // the form and moved focus back to the panel, so fields lost focus after each character.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth, outline: "none" }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        {title && <div style={{ padding: "32px 32px 0" }}><h3 className="title-lg">{title}</h3></div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
