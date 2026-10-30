import { Phone } from "lucide-react";

/** One tap-to-call link per number in a comma-separated phone field. */
export function PhoneLinks({ phone, className }: { phone: string; className?: string }) {
  const numbers = phone.split(/[,/]/).map((n) => n.trim()).filter(Boolean);
  return (
    <>
      {numbers.map((n) => (
        <a key={n} className={className} href={`tel:${n.replace(/[^\d+]/g, "")}`}><Phone size={13} /> {n}</a>
      ))}
    </>
  );
}
