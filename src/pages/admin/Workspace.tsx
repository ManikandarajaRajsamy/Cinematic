// The admin workspace. Loaded only after a successful sign-in, so visitors never download the admin screens.
import { useEffect, useState } from "react";
import { RotateCcw, LogOut, ShieldCheck, LayoutDashboard, Truck, PartyPopper, CalendarClock, Users, Bike, Wallet, Package, Store, MapPinned, History, Menu, Search, Sun, Moon, Bell, UserRound, ChevronsRight, Megaphone } from "lucide-react";
import { useStore } from "@/store/store";
import { api, useApi } from "@/api/client";
import { AdminBranches } from "./AdminBranches";
import { AdminProducts } from "./AdminProducts";
import { AdminDelivery, AdminAudit } from "./AdminDelivery";
import { errorsFrom } from "./shared";
import { AdminEvents } from "./AdminEvents";
import { AdminCustomers } from "./AdminCustomers";
import { AdminDashboard } from "./AdminDashboard";
import { AdminDeliveries, AdminCash, AdminPartners } from "./AdminDeliveries";
import { AdminPromoters } from "./AdminPromoters";
import { AdminTeam } from "./AdminTeam";
import { AdminUiStyles, BranchFilterCtx } from "./ui";
import { adminShellCss } from "./shellStyles";
import { useIdleSignOut } from "@/hooks/useIdleSignOut";

const TABS = ["events", "dashboard", "deliveries", "cash", "partners", "customers", "products", "branches", "delivery", "audit", "promoters", "team"] as const;
type Tab = (typeof TABS)[number];

/* ---------------- admin workspace: sidebar, top bar, page header, content ---------------- */
type NavItem = { id: Tab; label: string; icon: typeof LayoutDashboard; badge?: "events" };
const NAV: { title: string; items: NavItem[] }[] = [
  { title: "Event orders", items: [{ id: "events", label: "Event orders", icon: PartyPopper, badge: "events" }, { id: "deliveries", label: "Deliveries today", icon: Truck }] },
  { title: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { title: "People", items: [
    { id: "customers", label: "Customers", icon: Users },
    { id: "promoters", label: "Promoters", icon: Megaphone },
  ] },
  { title: "Operations", items: [{ id: "partners", label: "Delivery partners", icon: Bike }, { id: "cash", label: "Cash collection", icon: Wallet }] },
  { title: "Store setup", items: [
    { id: "products", label: "Products & prices", icon: Package }, { id: "branches", label: "Branches", icon: Store },
    { id: "delivery", label: "Shop settings", icon: MapPinned }, { id: "audit", label: "Audit log", icon: History },
  ] },
  { title: "Settings", items: [{ id: "team", label: "Team & access", icon: ShieldCheck }] },
];
const GROUP_OF = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, g.title]))) as Record<Tab, string>;
const tabFromHash = (): Tab => { const h = window.location.hash.slice(1) as Tab; return (TABS as readonly string[]).includes(h) ? h : "events"; };
const greeting = () => { const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export function Dashboard({ onOut }: { onOut: () => void }) {
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const [branch, setBranch] = useState("ALL");
  const [navOpen, setNavOpen] = useState(false);       // phones: sidebar drawer
  const [collapsed, setCollapsed] = useState(false);   // desktop: icon-only sidebar
  const [menu, setMenu] = useState<"" | "bell" | "user">("");
  const [q, setQ] = useState("");
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("ssp-admin-theme") === "dark"; } catch { return false; } });
  const { toast } = useStore();
  const { data: branchList } = useApi("admin-branches", api.admin.branches);
  const events = useApi("admin-event-requests", api.admin.eventRequests);
  const branches = (branchList ?? []).map((b) => ({ id: b.id, name: b.name_en }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const soon = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const newEvents = (events.data ?? []).filter((e) => e.status === "NEW");
  // confirmed events in the next two days: a reminder to prepare and call the customer
  const soonEvents = (events.data ?? []).filter((e) => e.status === "CONFIRMED" && e.event_date >= today && e.event_date <= soon);
  const badge = (b?: NavItem["badge"]) => (b === "events" ? newEvents.length : 0);
  const who = useApi("admin-me", api.adminMe);
  const me = who.data?.mobile ?? "";
  // an expired or old session: back to the sign-in screen instead of a workspace where every action fails
  useEffect(() => { if (who.error) onOut(); }, [who.error]); // eslint-disable-line react-hooks/exhaustive-deps
  // an unattended admin screen signs itself out after 30 minutes
  useIdleSignOut(true, 30, () => { toast("Signed out after 30 minutes without activity", "default"); onOut(); }, "admin");
  const allowed = (t: Tab) => !who.data || who.data.role === "SUPER_ADMIN" || who.data.sections.includes(t);
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.id)) })).filter((g) => g.items.length);
  // land on a section this person may open
  useEffect(() => { if (who.data && !allowed(tab)) { const first = nav[0]?.items[0]?.id; if (first) setTab(first); } }, [who.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // the section lives in the URL, so links and the back button work
  const setTab = (t: Tab) => { setTabState(t); setNavOpen(false); setMenu(""); setQ(""); if (window.location.hash.slice(1) !== t) window.history.pushState(null, "", `#${t}`); window.scrollTo({ top: 0 }); };
  useEffect(() => { const on = () => setTabState(tabFromHash()); window.addEventListener("popstate", on); return () => window.removeEventListener("popstate", on); }, []);
  useEffect(() => { try { localStorage.setItem("ssp-admin-theme", dark ? "dark" : "light"); } catch { /* ignore */ } }, [dark]);
  // drawers and dialogs open outside the workspace, so the theme is switched on for the whole page while it is open
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("adx-on"); html.classList.toggle("adx-dark", dark);
    return () => { html.classList.remove("adx-on", "adx-dark"); };
  }, [dark]);
  useEffect(() => { if (!menu) return; const close = () => setMenu(""); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, [menu]);

  const allItems = nav.flatMap((g) => g.items);
  const found = q.trim() ? allItems.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())) : [];
  const current = allItems.find((i) => i.id === tab) ?? allItems[0] ?? NAV[0].items[0];
  const resetData = async () => {
    if (!confirm("Reset branches, products and delivery settings to the seed data?")) return;
    try { await api.admin.reset(); toast("Reset to seed data", "success"); } catch (e) { toast(errorsFrom(e).message, "error"); }
  };

  return (
    <div className={`adx ${dark ? "dark" : ""} ${collapsed ? "mini" : ""} ${navOpen ? "nav-open" : ""}`}>
      <aside className="adx-side" aria-label="Admin navigation">
        <div className="adx-logo"><img src="/brand/logo.webp" alt="" width={40} /><span><b>Sri Sastha</b><small>Admin</small></span></div>
        <nav>
          {nav.map((g) => (
            <div key={g.title} className="adx-group">
              <span className="adx-group-t">{g.title}</span>
              {g.items.map((i) => {
                const n = badge(i.badge);
                return (
                  <button key={i.id} className={`adx-link ${tab === i.id ? "on" : ""}`} onClick={() => setTab(i.id)} aria-current={tab === i.id ? "page" : undefined} title={i.label}>
                    <i.icon size={19} /><span>{i.label}</span>{n > 0 && <em>{n}</em>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <div className="adx-scrim" onClick={() => setNavOpen(false)} />

      <div className="adx-main">
        <header className="adx-top">
          <button className="adx-ic" aria-label="Menu" onClick={() => (window.matchMedia("(max-width: 1024px)").matches ? setNavOpen(true) : setCollapsed((c) => !c))}><Menu size={20} /></button>
          <h2 className="adx-hello">{greeting()}, {who.data?.role === "MANAGER" ? who.data.name.split(" ")[0] : "Admin"}!</h2>
          <div className="adx-search">
            <Search size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages…" aria-label="Search admin pages" />
            {found.length > 0 && <ul className="adx-pop adx-found">{found.map((i) => <li key={i.id}><button onClick={() => setTab(i.id)}><i.icon size={15} /> {i.label}</button></li>)}</ul>}
          </div>
          <div className="adx-tools">
            <select className="adx-branch" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch filter">
              <option value="ALL">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="adx-ic" aria-label={dark ? "Light mode" : "Dark mode"} onClick={() => setDark((d) => !d)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
            <div className="adx-rel" onClick={(e) => e.stopPropagation()}>
              <button className="adx-ic" aria-label="Notifications" aria-expanded={menu === "bell"} onClick={() => setMenu(menu === "bell" ? "" : "bell")}>
                <Bell size={19} />{newEvents.length + soonEvents.length > 0 && <span className="adx-dot" />}
              </button>
              {menu === "bell" && (
                <div className="adx-pop adx-bell">
                  <strong>Waiting for you</strong>
                  {newEvents.length + soonEvents.length === 0 && <p>All caught up.</p>}
                  {newEvents.length > 0 && <button onClick={() => setTab("events")}><PartyPopper size={15} /> {newEvents.length} event request{newEvents.length > 1 ? "s" : ""} to confirm</button>}
                  {soonEvents.length > 0 && <button onClick={() => setTab("events")}><CalendarClock size={15} /> {soonEvents.length} event{soonEvents.length > 1 ? "s" : ""} in the next 2 days</button>}
                </div>
              )}
            </div>
            <div className="adx-rel" onClick={(e) => e.stopPropagation()}>
              <button className="adx-avatar" aria-label="Account menu" aria-expanded={menu === "user"} onClick={() => setMenu(menu === "user" ? "" : "user")}><UserRound size={20} /></button>
              {menu === "user" && (
                <div className="adx-pop adx-user">
                  <div className="adx-user-h"><span className="adx-avatar"><UserRound size={20} /></span><div><b>{who.data?.name && who.data.name !== "Owner" ? who.data.name : "Owner"}</b><small>{who.data?.role === "MANAGER" ? "Manager" : "Super admin"} · +91 {me}</small></div></div>
                  {who.data?.role !== "MANAGER" && <button onClick={resetData} title="Mock data only: remove before going live"><RotateCcw size={15} /> Reset demo data</button>}
                  <button className="out" onClick={onOut}><LogOut size={15} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="adx-content">
          <div className="adx-head">
            <h1>{current.label}</h1>
            <nav className="adx-crumb" aria-label="Breadcrumb"><span>Admin</span><ChevronsRight size={13} /><span>{GROUP_OF[tab]}</span><ChevronsRight size={13} /><b>{current.label}</b></nav>
          </div>
          <BranchFilterCtx.Provider value={{ branch, setBranch }}>
            <section className="adx-panel" key={tab}>
              {tab === "dashboard" && <AdminDashboard />}
              {tab === "deliveries" && <AdminDeliveries />}
              {tab === "cash" && <AdminCash />}
              {tab === "partners" && <AdminPartners branches={branches} />}
              {tab === "products" && <AdminProducts />}
              {tab === "delivery" && <AdminDelivery />}
              {tab === "audit" && <AdminAudit />}
              {tab === "events" && <AdminEvents />}
              {tab === "customers" && <AdminCustomers />}
              {tab === "branches" && <AdminBranches />}
              {tab === "promoters" && <AdminPromoters />}
              {tab === "team" && <AdminTeam goTo={setTab} />}
            </section>
          </BranchFilterCtx.Provider>
          <footer className="adx-foot">© {new Date().getFullYear()} Sri Sastha Paruthipaal · Admin workspace</footer>
        </main>
      </div>
      <AdminUiStyles />
      <style>{adminShellCss}</style>
    </div>
  );
}
