export type Currency = "₹";

export interface ProductVariant {
  id: string;
  label: string; // e.g. "250g", "500g", "1kg"
  price: number;
  inStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  image: string;
  gallery: string[];
  variants: ProductVariant[];
  bestseller?: boolean;
  isNew?: boolean;
  tags: string[];
  maxQty?: number;
  planEligible?: boolean;
  soldOutToday?: boolean;
}

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "parcel", label: "Parcels" },
] as const;




export const FAQS = [
  {
    q: "What do you make?",
    a: "Only paruthipaal, made fresh every day and served hot. Online, you can order 500 ML and 1 L parcels delivered hot in Madurai district, start a Daily plan, or book bulk orders and live counters for functions.",
  },
  {
    q: "How do I place an order?",
    a: "Browse the catalogue, choose a variant and quantity, add to cart, then proceed to checkout. The entire flow runs as a local demonstration — no real payment is collected and no order is sent to a business backend.",
  },
  {
    q: "Where do you deliver?",
    a: "Free within {free_radius_km} km of our main branch near Periyar Bus Stand, and for a distance-based fee up to {max_radius_km} km, within {district} district. Set your map location at checkout to see the exact fee.",
  },
  {
    q: "How does the subscription discount work?",
    a: "Eligible subscription orders receive a 15% discount applied at payment in the checkout demonstration. The discount is calculated dynamically and shown clearly before you place a demo order. It is applied only once per eligible order.",
  },
  {
    q: "Is the payment real?",
    a: "No. This is a frontend demonstration. We never collect card numbers, UPI PINs, or bank credentials, and no payment gateway is connected. The 'place order' action creates a local demo order only.",
  },
  {
    q: "Can I track my demo order?",
    a: "Yes. After placing a demo order you will see an order number and a tracking page with a status timeline. An in-page control lets you advance the status to see how the timeline progresses. This is not live GPS tracking.",
  },
  {
    q: "What is the cancellation and refund policy?",
    a: "Demo orders can be cancelled from the order tracking or account pages, which updates the local record. Because no real payment is taken, there is no real refund to process. See the policy centre for the full demonstration policy text.",
  },
];

export const POLICIES = [
  {
    id: "delivery",
    title: "Delivery Policy",
    body: [
      "Delivery is free within {free_radius_km} km of our dispatch branch (Main Branch, near Periyar Bus Stand).",
      "Beyond {free_radius_km} km, a delivery charge applies based on the road (driving) distance from the shop or branch preparing your order, as shown in the table below. Orders above {discount_above} get {discount_percent}% off the delivery charge.",
      "The exact charge for your address is worked out from the map location you set, and shown in your cart before you confirm the order. If the road distance can't be worked out, please call {support_phone} to order.",
      "We deliver up to {max_radius_km} km, within {district} district only. For addresses further away, you're welcome to pick up at Periyar Bus Stand.",
      "Daily plan orders are delivered free{plan_free_suffix}.",
      "Delivery estimates shown are illustrative and intended for demonstration only — they do not represent a binding delivery promise.",
    ],
  },
  {
    id: "cancellation",
    title: "Cancellation Policy",
    body: [
      "Demo orders may be cancelled from the order tracking page or your account order history. Cancelling updates the local demonstration record.",
      "Because no real payment is collected, cancellation has no financial effect. This policy exists to demonstrate the interface only.",
    ],
  },
  {
    id: "refund",
    title: "Refund Policy",
    body: [
      "No real money is exchanged in this prototype. Refunds are therefore not applicable.",
      "If we ever launch a live store, a full refund policy will be published here and reviewed by our team. For now, this page is a placeholder for that future policy and should not be treated as final legal content.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    body: [
      "This is a frontend demonstration. Any details you enter — name, phone, address — are stored only in your own browser's localStorage and never transmitted to a server.",
      "To count website visits, we store an anonymous visitor ID in a first-party cookie (ssp_vid) and record which public pages are viewed and when. It contains no name, phone number or other personal details, is never shared with third parties, and is not used on staff (admin or delivery partner) pages.",
      "We use no third-party analytics or advertising trackers. You can clear the cookie at any time in your browser settings.",
    ],
  },
  {
    id: "terms",
    title: "Terms & Conditions",
    body: [
      "This website is a design prototype. Placing an order does not create a real commercial agreement with any business.",
      "Product images, names, and prices are demonstration content unless stated otherwise. The logo and brand name belong to Sri Sastha Paruthipaal.",
      "Use of the site constitutes acceptance that all orders, payments, and subscriptions shown are simulated.",
    ],
  },
];


export const COUPONS: Record<string, { type: "flat" | "percent"; value: number; label: string }> = {
  WELCOME10: { type: "percent", value: 10, label: "10% off your first order" },
  FESTIVE50: { type: "flat", value: 50, label: "₹50 off on festive orders" },
  MADURAI20: { type: "percent", value: 20, label: "20% off · Madurai district launch" },
};

export const MADURAI_AREAS = [
  "Tallakulam", "Anna Nagar", "Goripalayam", "KK Nagar", "Thallakulam",
  "Teppakulam", "Villapuram", "Koodal", "Simakkal", "Yanaikkal",
  "Arasaradi", "Sellur", "TVS Nagar", "Pasumalai", "Thiruparankundram",
  "Madurai", "Madurai District",
];


export const FOOTER_NAV = [
  {
    title: "Shop",
    links: [
      { to: "/products", label: "All Products" },
      { to: "/subscriptions", label: "Daily plan" },
      { to: "/tracking", label: "Track order" },
    ],
  },
  {
    title: "Account",
    links: [
      { to: "/login", label: "Sign In" },
      { to: "/account", label: "My Account" },
      { to: "/account#orders", label: "Order History" },
      { to: "/account#addresses", label: "Saved Addresses" },
    ],
  },
  {
    title: "About",
    links: [
      { to: "/our-story", label: "Our Story" },
      { to: "/branches", label: "Branches" },
      { to: "/events", label: "Events" },
      { to: "/contact", label: "Contact & Bulk Orders" },
      { to: "/policies", label: "Policies" },
    ],
  },
];
