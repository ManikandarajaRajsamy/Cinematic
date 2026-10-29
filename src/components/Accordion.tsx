import { useState } from "react";
import { Plus } from "lucide-react";

interface Item { q: string; a: string }

export function Accordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="acc-list">
      {items.map((it, i) => (
        <div className="acc-item" key={i}>
          <button className="acc-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span>{it.q}</span>
            <Plus className={`acc-icon ${open === i ? "open" : ""}`} size={22} />
          </button>
          <div className={`acc-body ${open === i ? "open" : ""}`}>
            <div className="acc-body-inner">{it.a}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
