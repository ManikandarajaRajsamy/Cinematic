import { ReactNode, useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-panel" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        {title && <div style={{ padding: "32px 32px 0" }}><h3 className="title-lg">{title}</h3></div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
