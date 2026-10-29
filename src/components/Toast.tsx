import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useStore } from "@/store/store";

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)} role="status">
          {t.kind === "success" ? <CheckCircle2 className="toast-icon" /> : t.kind === "error" ? <AlertCircle className="toast-icon" /> : <Info className="toast-icon" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>,
    document.body
  );
}
