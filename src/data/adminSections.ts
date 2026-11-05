// Admin sections and staff roles, shared by the API (which enforces access) and the admin screens.

export const ADMIN_SECTIONS = [
  { id: "events", label: "Event orders" },
  { id: "dashboard", label: "Dashboard" },
  { id: "deliveries", label: "Deliveries today" },
  { id: "customers", label: "Customers" },
  { id: "promoters", label: "Promoters" },
  { id: "partners", label: "Delivery partners" },
  { id: "cash", label: "Cash collection" },
  { id: "products", label: "Products & prices" },
  { id: "branches", label: "Branches" },
  { id: "delivery", label: "Shop settings" },
  { id: "audit", label: "Audit log" },
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number]["id"] | "team";

export type StaffRole = "SUPER_ADMIN" | "MANAGER";
export const ROLE_LABEL: Record<StaffRole, string> = { SUPER_ADMIN: "Super admin", MANAGER: "Manager" };
/** What a new manager can open unless the super admin changes it: event orders, customers and promoters. */
export const MANAGER_DEFAULT: AdminSection[] = ["events", "customers", "promoters"];

/** Which section an admin API resource belongs to (the API checks the signed-in person's access with this). */
export const SECTION_OF_RESOURCE: Record<string, AdminSection | AdminSection[]> = {
  // the Event orders screen tracks event deliveries, so the jobs resource accepts it too; old orders and plans are read-only history
  dashboard: "dashboard", jobs: ["deliveries", "events"], orders: "dashboard", subscriptions: "dashboard", "event-requests": "events",
  customers: "customers", "reset-links": "customers", promoters: "promoters", commissions: "promoters",
  partners: "partners", cash: "cash", products: "products", "branch-products": "products", branches: "branches", "branch-order": "branches",
  "delivery-settings": "delivery", audit: "audit", staff: "team", reset: "team", me: "dashboard",
};
/** Lists other screens need for their pickers and filters: any staff member may read these. */
export const SHARED_READS = new Set(["partners", "branches", "products", "me"]);
