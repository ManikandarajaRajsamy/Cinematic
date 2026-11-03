import type { OrderStatus } from "@/api/opsServer";

/** Customer-facing names for each order status, shared by the account, tracking and admin screens. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending confirmation",
  confirmed: "Order confirmed",
  picked_up: "Pickup confirmed",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABEL = {
  ONLINE: "Paid by UPI · being verified",
  VERIFIED: "Paid by UPI · verified",
  DUE: "Cash on delivery · due",
  COLLECTED: "Paid on delivery",
} as const;

export const statusBadge = (s: OrderStatus) =>
  s === "delivered" ? "badge-success" : s === "rejected" || s === "cancelled" ? "badge-error" : s === "pending" ? "badge-saffron" : "badge-gold";
