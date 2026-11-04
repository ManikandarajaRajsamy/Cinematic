import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, UserRound, X } from "lucide-react";

export interface PickerOption { id: string; label: string; sub?: string; hint?: string }

/**
 * A dropdown that matches the admin design (the browser's own select list can't be styled). The list opens in a
 * layer above the page, so it is never cut off by a scrolling table, and flips upward near the bottom of the screen.
 * Keyboard: arrows to move, Enter to pick, Escape to close.
 */
export function Picker({ value, options, placeholder, emptyText, clearLabel, onChange, label }: {
  value: string; options: PickerOption[]; placeholder: string; emptyText?: string; clearLabel?: string; onChange: (id: string) => void; label: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean }>({ left: 0, top: 0, width: 260, up: false });
  const [hi, setHi] = useState(0);
  const current = options.find((o) => o.id === value);
  const rows: PickerOption[] = [...(value && clearLabel ? [{ id: "", label: clearLabel }] : []), ...options];

  const place = () => {
    const r = btn.current!.getBoundingClientRect();
    const height = Math.min(320, rows.length * 52 + 12);
    const up = r.bottom + height + 12 > window.innerHeight && r.top > height;
    const width = Math.max(r.width, 260);
    setPos({ left: Math.min(r.left, window.innerWidth - width - 8), top: up ? r.top - height - 6 : r.bottom + 6, width, up });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, rows.findIndex((o) => o.id === value)));
    const close = (e: Event) => { if (!btn.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false); };
    const reposition = () => place();
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => { setOpen(false); if (id !== value) onChange(id); btn.current?.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(rows.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows[hi]) pick(rows[hi].id); }
  };

  return (
    <>
      <button ref={btn} type="button" className={`pk ${current ? "set" : ""}`} aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }} onKeyDown={onKey}>
        <span className="pk-ic"><UserRound size={14} /></span>
        <span className="pk-txt">{current ? current.label : options.length ? placeholder : emptyText ?? placeholder}</span>
        <ChevronDown size={16} className={`pk-chev ${open ? "up" : ""}`} />
      </button>
      {open && createPortal(
        <ul ref={list} className={`pk-list ${pos.up ? "up" : ""}`} role="listbox" aria-label={label} style={{ left: pos.left, top: pos.top, width: pos.width }} onClick={(e) => e.stopPropagation()}>
          {rows.length === 0 && <li className="pk-empty">{emptyText ?? "Nothing to choose"}</li>}
          {rows.map((o, i) => (
            <li key={o.id || "none"} role="option" aria-selected={o.id === value} className={`${i === hi ? "hi" : ""} ${o.id === value ? "on" : ""} ${o.id === "" ? "clear" : ""}`}
              onMouseEnter={() => setHi(i)} onClick={() => pick(o.id)}>
              <span className="pk-av">{o.id === "" ? <X size={14} /> : o.label.charAt(0).toUpperCase()}</span>
              <span className="pk-opt"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
              {o.hint && <em>{o.hint}</em>}
              {o.id === value && o.id !== "" && <Check size={16} className="pk-tick" />}
            </li>
          ))}
        </ul>, document.body,
      )}
      <PickerStyles />
    </>
  );
}

let styled = false;
function PickerStyles() {
  // one copy of the styles is enough
  const [first] = useState(() => { const f = !styled; styled = true; return f; });
  useEffect(() => () => { if (first) styled = false; }, [first]);
  if (!first) return null;
  return (
    <style>{`
      .pk { display: inline-flex; align-items: center; gap: 8px; width: 100%; min-width: 200px; height: 40px; padding: 0 10px 0 6px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--bg-card); color: var(--text-dim); font-size: 13px; text-align: left; transition: border-color 160ms, box-shadow 160ms; }
      .pk:hover { border-color: var(--accent-gold); }
      .pk:focus-visible, .pk[aria-expanded="true"] { outline: none; border-color: var(--accent-gold); box-shadow: 0 0 0 3px var(--accent-gold-glow); }
      .pk.set { color: var(--text); font-weight: 600; }
      .pk-ic { width: 28px; height: 28px; flex-shrink: 0; border-radius: 8px; display: grid; place-items: center; background: var(--accent-gold-glow); color: var(--accent-gold); }
      .pk-txt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pk-chev { flex-shrink: 0; color: var(--text-dim); transition: transform 160ms; }
      .pk-chev.up { transform: rotate(180deg); }
      .pk-list { position: fixed; z-index: 10000; list-style: none; max-height: 320px; overflow-y: auto; padding: 6px; border-radius: 12px; background: var(--bg-card, #fff); border: 1px solid var(--border); box-shadow: 0 18px 50px rgba(17, 24, 39, 0.18); animation: pkIn 140ms ease; font-family: var(--font-body); }
      .pk-list.up { animation-name: pkUp; }
      @keyframes pkIn { from { opacity: 0; transform: translateY(-4px); } }
      @keyframes pkUp { from { opacity: 0; transform: translateY(4px); } }
      .pk-list li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; color: var(--text); }
      .pk-list li.hi { background: var(--accent-gold-glow); }
      .pk-list li.on b { color: var(--accent-gold); }
      .pk-av { width: 32px; height: 32px; flex-shrink: 0; border-radius: 50%; display: grid; place-items: center; background: var(--bg-elevated); color: var(--text-muted); font-weight: 700; font-size: 13px; }
      .pk-list li.on .pk-av { background: var(--accent-gold); color: #fff; }
      .pk-list li.clear .pk-av { color: var(--error); }
      .pk-opt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .pk-opt b { font-size: 13.5px; font-weight: 600; }
      .pk-opt small { font-size: 12px; color: var(--text-dim); }
      .pk-list em { font-style: normal; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: rgba(40, 199, 111, 0.12); color: #1E9E57; white-space: nowrap; }
      .pk-tick { color: var(--accent-gold); flex-shrink: 0; }
      .pk-empty { padding: 12px; font-size: 13px; color: var(--text-dim); cursor: default; }
    `}</style>
  );
}
