// Shapes returned by the API. Field names follow the database (snake_case). Money is always in paise.

export type BranchType = "SHOP" | "MARKET";
/** 0 = Sunday … 6 = Saturday, or every day. */
export type OpenDays = number[] | "DAILY";

export interface Branch {
  id: string;
  code: string;
  name_en: string;
  name_ta: string;
  type: BranchType;
  address_en: string;
  address_ta: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string;
  phone: string;
  open_days: OpenDays;
  open_time: string; // "HH:MM", empty when not known
  close_time: string;
  is_active: boolean;
  show_on_website: boolean;
  is_dispatch: boolean;
  delivery_radius_km: number | null; // null = use the global max radius
  photo_url: string;
  sort_order: number;
  deleted: boolean; // soft delete (kept when sales history exists)
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface BranchHoliday { id: string; branch_id: string; date: string; note: string }

export interface Product {
  id: string;
  code: string;
  name_en: string;
  name_ta: string;
  size_label_en: string;
  size_label_ta: string;
  volume_ml: number;
  description_en: string;
  description_ta: string;
  image_url: string;
  base_price: number; // paise
  is_active: boolean;
  sell_online: boolean;
  sell_in_pos: boolean;
  plan_eligible: boolean;
  max_qty_per_order: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string;
}

export interface BranchProduct {
  branch_id: string;
  product_id: string;
  price_override: number | null; // paise
  is_available: boolean;
  sold_out_date: string | null; // IST date it was marked sold out; "sold out today" only while it equals today
}

export interface DeliverySlab { upto_km: number; fee: number } // fee in paise

export interface DeliverySettings {
  free_radius_km: number;
  slabs: DeliverySlab[];
  max_radius_km: number;
  distance_method: "ROAD" | "STRAIGHT_LINE";
  free_above_amount: number | null; // paise; optional: free delivery above this order value
  /** Orders whose value (before delivery and discounts) is above this get discount_percent off the delivery charge. */
  discount_above_amount: number | null; // paise
  discount_percent: number;
  /** Shown when the road distance cannot be worked out, so the fee is never guessed. */
  support_phone: string;
  /** Mock/testing only: estimate distance when Google road distance is unavailable. Off = ask the customer to call. */
  demo_distance_fallback: boolean;
  district_restriction: string;
  plan_free_delivery: boolean;
  plan_discount_percent: number; // the highest plan discount, for "up to" wording
  /** discount by plan length in days, e.g. { "7": 5, "15": 10, "30": 15 } */
  plan_discounts: Record<string, number>;
  updated_at: string;
  updated_by: string;
}

export interface AuditEntry { id: string; at: string; by: string; entity: string; entity_id: string; action: string; old: unknown; new: unknown }

/** Public view of a product: the price the online shop charges (dispatch branch override, else base). */
export interface PublicProduct extends Product {
  price: number; // paise
  plan_price: number | null; // paise, only when plan eligible
  available: boolean;
  sold_out_today: boolean;
}

export interface DeliveryQuote {
  deliverable: boolean;
  reason?: "OUTSIDE_DISTRICT" | "TOO_FAR" | "NO_LOCATION" | "NO_DISPATCH_BRANCH" | "DISTANCE_UNAVAILABLE";
  message: string;
  branch?: { id: string; code: string; name_en: string };
  distanceKm?: number;
  fee: number; // paise, what the customer pays
  baseFee?: number; // paise, slab charge before any discount
  saving?: number; // paise, baseFee - fee from the order-value discount
  freeReason?: "WITHIN_FREE_RADIUS" | "ABOVE_AMOUNT" | "PLAN";
  method?: "ROAD" | "ROAD_SIMULATED";
}

export interface QuoteRequest {
  addressId?: string;
  lat?: number;
  lng?: number;
  district?: string;
  subtotal?: number; // paise, for free_above_amount
  hasPlan?: boolean;
}

export interface OrderLineRequest { productId: string; qty: number; plan: boolean; planDays?: number }
export interface CreateOrderRequest {
  lines: OrderLineRequest[];
  addressId: string;
  couponCode?: string;
  customer: { name: string; phone: string; email: string };
  payment?: "upi" | "card" | "cod";
}
export interface CreatedOrderPricing {
  items: { productId: string; productName: string; sizeLabel: string; unitPrice: number; qty: number; lineTotal: number; plan: boolean; planDays?: number; planDiscountPct?: number }[];
  subtotal: number;
  couponDiscount: number;
  planDiscount: number;
  deliveryFee: number;
  total: number;
  delivery: { branch_id: string; distance_km: number; method: string; freeReason?: string };
  order_ref: string;
  /** created: a password-less account was made for this mobile; claimToken lets this buyer set its password */
  account: { created: boolean; claimToken?: string };
}
