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
}

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic Sweets" },
  { id: "milk", label: "Milk Sweets" },
  { id: "snacks", label: "Savoury Snacks" },
  { id: "gifts", label: "Gift Boxes" },
] as const;

export const PRODUCTS: Product[] = [
  {
    id: "paruthipaal-classic",
    name: "Paruthipaal Classic",
    tagline: "The signature sesame-coconut milk halwa",
    description:
      "Our namesake sweet. Slow-reduced milk simmered with freshly ground sesame and a whisper of cardamom, set to a dense, fudge-like bite that melts on the tongue. Each batch is cooked in small quantities over a steady flame — the same method our kitchen has used for decades.",
    category: "classic",
    image: "https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/6460381/pexels-photo-6460381.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "pp-250", label: "250g", price: 180, inStock: true },
      { id: "pp-500", label: "500g", price: 340, inStock: true },
      { id: "pp-1kg", label: "1kg", price: 640, inStock: true },
    ],
    bestseller: true,
    tags: ["signature", "cardamom"],
  },
  {
    id: "cashew-fudge",
    name: "Cashew Milk Fudge",
    tagline: "Silken kaju katli steeped in milk",
    description:
      "Premium cashews ground to a paste and folded into thickened milk, rolled thin and cut into diamonds. A restrained sweetness lets the nutty depth of the cashew carry the flavour.",
    category: "milk",
    image: "https://images.pexels.com/photos/6460358/pexels-photo-6460358.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460358/pexels-photo-6460358.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "cf-250", label: "250g", price: 240, inStock: true },
      { id: "cf-500", label: "500g", price: 460, inStock: true },
      { id: "cf-1kg", label: "1kg", price: 880, inStock: false },
    ],
    bestseller: true,
    tags: ["cashew", "festive"],
  },
  {
    id: "jaggery-bites",
    name: "Jaggery Coconut Bites",
    tagline: "Roasted coconut bound in dark jaggery",
    description:
      "Freshly grated coconut roasted golden and bound with unrefined palm jaggery for a deep, caramel-toned sweetness. No refined sugar — just two ingredients brought together by patience.",
    category: "classic",
    image: "https://images.pexels.com/photos/6460370/pexels-photo-6460370.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460370/pexels-photo-6460370.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "jb-250", label: "250g", price: 160, inStock: true },
      { id: "jb-500", label: "500g", price: 300, inStock: true },
    ],
    isNew: true,
    tags: ["jaggery", "coconut"],
  },
  {
    id: "almond-milk-barfi",
    name: "Almond Milk Barfi",
    tagline: "Blanched almond barfi, milk-reduced",
    description:
      "Blanched almonds simmered in milk until the mixture thickens to a creamy, sliceable barfi. A faint saffron thread is pressed into each piece for colour and aroma.",
    category: "milk",
    image: "https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460395/pexels-photo-6460395.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/6460401/pexels-photo-6460401.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "ab-250", label: "250g", price: 280, inStock: true },
      { id: "ab-500", label: "500g", price: 540, inStock: true },
      { id: "ab-1kg", label: "1kg", price: 1040, inStock: true },
    ],
    bestseller: true,
    tags: ["almond", "saffron"],
  },
  {
    id: "pista-roll",
    name: "Pistachio Milk Roll",
    tagline: "Rolled green, flecked with pista",
    description:
      "Milk solids rolled with finely ground pistachios into a log, sliced to reveal a pale-green interior studded with slivers. A restrained, nutty sweetness that lingers.",
    category: "milk",
    image: "https://images.pexels.com/photos/6460370/pexels-photo-6460370.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460370/pexels-photo-6460370.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "pr-250", label: "250g", price: 320, inStock: true },
      { id: "pr-500", label: "500g", price: 620, inStock: true },
    ],
    isNew: true,
    tags: ["pistachio", "festive"],
  },
  {
    id: "savory-mixture",
    name: "Madurai Mixture",
    tagline: "Crisp sev, boondi, and curry leaf",
    description:
      "A savoury counterpoint to our sweets — fine gram-flour sev, spiced boondi, and fried curry leaves tossed with a dry mango-and-chilli masala. The kind of snack that disappears at gatherings.",
    category: "snacks",
    image: "https://images.pexels.com/photos/7437459/pexels-photo-7437459.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/7437459/pexels-photo-7437459.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "mx-200", label: "200g", price: 90, inStock: true },
      { id: "mx-400", label: "400g", price: 170, inStock: true },
    ],
    tags: ["savoury", "spicy"],
  },
  {
    id: "ribbon-pakoda",
    name: "Ribbon Pakoda",
    tagline: "Crunchy spiced gram-flour ribbons",
    description:
      "Flat, crisp ribbons of gram and rice flour, spiced with white sesame and a whisper of asafoetida. A traditional Madurai tea-time companion.",
    category: "snacks",
    image: "https://images.pexels.com/photos/7437460/pexels-photo-7437460.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/7437460/pexels-photo-7437460.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "rp-200", label: "200g", price: 80, inStock: true },
      { id: "rp-400", label: "400g", price: 150, inStock: true },
    ],
    tags: ["savoury", "tea-time"],
  },
  {
    id: "festive-gift-box",
    name: "Festive Gift Box",
    tagline: "A curated assortment in a keepsake box",
    description:
      "Our four most-loved sweets — Paruthipaal, Cashew Fudge, Almond Barfi, and Jaggery Bites — packed in a keepsake box lined with a banana-fibre sheet. Designed for festivals and as a gift that travels well.",
    category: "gifts",
    image: "https://images.pexels.com/photos/6460381/pexels-photo-6460381.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460381/pexels-photo-6460381.jpeg?auto=compress&cs=tinysrgb&w=1200",
      "https://images.pexels.com/photos/6460358/pexels-photo-6460358.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "gb-small", label: "Small · 500g", price: 420, inStock: true },
      { id: "gb-large", label: "Large · 1kg", price: 820, inStock: true },
    ],
    bestseller: true,
    tags: ["gift", "festive", "assortment"],
  },
  {
    id: "premium-thali-box",
    name: "Premium Thali Box",
    tagline: "Sweets and savouries in a single tray",
    description:
      "A divided tray pairing our festive sweets with Madurai Mixture and Ribbon Pakoda — half sweet, half savoury. Built for a family table or as a complete tasting gift.",
    category: "gifts",
    image: "https://images.pexels.com/photos/6460401/pexels-photo-6460401.jpeg?auto=compress&cs=tinysrgb&w=900",
    gallery: [
      "https://images.pexels.com/photos/6460401/pexels-photo-6460401.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
    variants: [
      { id: "tb-mixed", label: "Mixed · 1kg", price: 760, inStock: true },
    ],
    isNew: true,
    tags: ["gift", "mixed", "festive"],
  },
];

export interface DemoEvent {
  id: string;
  title: string;
  date: string; // ISO
  location: string;
  category: "festival" | "pop-up" | "tasting" | "workshop";
  description: string;
  image: string;
}

export const DEMO_EVENTS: DemoEvent[] = [
  {
    id: "deepavali-2026",
    title: "Deepavali Sweet Festival",
    date: "2026-11-01",
    location: "Madurai · Tallakulam Ground",
    category: "festival",
    description:
      "Our flagship festival pop-up. A live Paruthipaal counter, free tasting of the full range, and pre-festival hampers prepared on request. (Demonstration event listing.)",
    image: "https://images.pexels.com/photos/3818758/pexels-photo-3818758.jpeg?auto=compress&cs=tinysrgb&w=900",
  },
  {
    id: "temple-tasting",
    title: "Heritage Temple Tasting",
    date: "2026-12-12",
    location: "Madurai · Meenakshi Temple precinct",
    category: "tasting",
    description:
      "A guided tasting walk pairing our sweets with the temple town's morning rituals. Limited spots, pre-registration required. (Demonstration event listing.)",
    image: "https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=900",
  },
  {
    id: "winter-pop-up",
    title: "Winter Gifting Pop-up",
    date: "2026-12-20",
    location: "Madurai · Goripalayam",
    category: "pop-up",
    description:
      "A weekend pop-up focused on festive gifting. Engrave a name on any gift box at no charge for the demo period. (Demonstration event listing.)",
    image: "https://images.pexels.com/photos/8108064/pexels-photo-8108064.jpeg?auto=compress&cs=tinysrgb&w=900",
  },
  {
    id: "halwa-workshop",
    title: "Paruthipaal Making Workshop",
    date: "2027-01-18",
    location: "Madurai · Anna Nagar",
    category: "workshop",
    description:
      "A hands-on session where our head sweet-maker walks a small group through the slow-reduction method. Take home what you make. (Demonstration event listing.)",
    image: "https://images.pexels.com/photos/5394518/pexels-photo-5394518.jpeg?auto=compress&cs=tinysrgb&w=900",
  },
];

export const SAMPLE_REVIEWS = [
  { id: "r1", name: "Lakshmi R.", rating: 5, text: "The Paruthipaal tastes exactly like my grandmother's. Dense, fragrant, and not too sweet. We order it for every festival now.", date: "Sep 2026" },
  { id: "r2", name: "Anand K.", rating: 4, text: "Gift box arrived neatly packed. The almond barfi was the standout. Delivery was within Madurai as promised.", date: "Aug 2026" },
  { id: "r3", name: "Priya S.", rating: 5, text: "Subscribed to the monthly box — the 15% discount at checkout is a nice touch. Always fresh, never disappointing.", date: "Oct 2026" },
  { id: "r4", name: "Karthik V.", rating: 4, text: "The Madurai mixture is dangerously moreish. I keep a pack at my desk. Wish delivery reached my parents in Chennai.", date: "Jul 2026" },
];

export const FAQS = [
  {
    q: "What products do you offer?",
    a: "Our range centres on Paruthipaal — a slow-reduced sesame-coconut milk halwa — alongside milk sweets like cashew fudge, almond barfi, and pistachio rolls, savoury snacks, and curated gift boxes. Availability updates live on each product card.",
  },
  {
    q: "How do I place an order?",
    a: "Browse the catalogue, choose a variant and quantity, add to cart, then proceed to checkout. The entire flow runs as a local demonstration — no real payment is collected and no order is sent to a business backend.",
  },
  {
    q: "Where do you deliver?",
    a: "We currently deliver within the Madurai district only. We hope to expand to other cities in the future. During checkout you can confirm whether an address falls within our coverage area.",
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
      "We currently deliver within the Madurai district only. Orders placed for addresses outside this area will be flagged at checkout and cannot be completed in the demonstration.",
      "Delivery estimates shown are illustrative and intended for demonstration only — they do not represent a binding delivery promise.",
      "We may expand coverage to additional cities in the future. Any expansion will be announced on this page.",
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
      "Clearing your browser storage removes all demo data. We do not use cookies, analytics, or third-party trackers in this prototype.",
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

export const BRANCHES = [
  {
    id: "b1",
    name: "Madurai · Tallakulam (Flagship)",
    area: "Tallakulam, Madurai",
    note: "Our main kitchen and demonstration storefront. Walk-in tasting available on weekends.",
    image: "https://images.pexels.com/photos/2901209/pexels-photo-2901209.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "b2",
    name: "Madurai · Anna Nagar",
    area: "Anna Nagar, Madurai",
    note: "Pickup point for online demonstration orders within Madurai district.",
    image: "https://images.pexels.com/photos/7710175/pexels-photo-7710175.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
  {
    id: "b3",
    name: "Madurai · Goripalayam",
    area: "Goripalayam, Madurai",
    note: "Festival pop-up location. Check the events page for seasonal hours.",
    image: "https://images.pexels.com/photos/8108064/pexels-photo-8108064.jpeg?auto=compress&cs=tinysrgb&w=800",
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

export const DELIVERY_FEE = 49;
export const SUBSCRIPTION_DISCOUNT = 0.15;

export const FOOTER_NAV = [
  {
    title: "Shop",
    links: [
      { to: "/products", label: "All Products" },
      { to: "/products?category=classic", label: "Classic Sweets" },
      { to: "/products?category=milk", label: "Milk Sweets" },
      { to: "/products?category=gifts", label: "Gift Boxes" },
      { to: "/subscriptions", label: "Subscriptions" },
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
