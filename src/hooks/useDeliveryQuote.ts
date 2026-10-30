import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { DeliveryQuote } from "@/api/types";
import type { Address } from "@/store/store";

/**
 * Server delivery quote for a saved address. Re-quotes when the address, its pin, the order value
 * or the plan mix changes, and whenever admin settings are saved. The browser only displays it.
 */
export function useDeliveryQuote(address: Address | undefined, subtotalRupees: number, hasPlan: boolean) {
  const [q, setQ] = useState<{ quote?: DeliveryQuote; loading: boolean; error?: string }>({ loading: false });
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const on = () => setBump((n) => n + 1);
    window.addEventListener("ssp-db-changed", on);
    return () => window.removeEventListener("ssp-db-changed", on);
  }, []);
  useEffect(() => {
    if (!address) { setQ({ loading: false }); return; }
    let live = true;
    setQ((s) => ({ ...s, loading: true }));
    api.quote({ addressId: address.id, subtotal: Math.round(subtotalRupees * 100), hasPlan })
      .then((quote) => live && setQ({ quote, loading: false }))
      .catch((e: Error) => live && setQ({ loading: false, error: e.message }));
    return () => { live = false; };
  }, [address?.id, address?.lat, address?.lng, address?.district, subtotalRupees, hasPlan, bump]); // eslint-disable-line react-hooks/exhaustive-deps
  return q;
}
