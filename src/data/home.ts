// Homepage copy. Everything here comes from the verified shop facts; do not add claims.

// Beat 1 is built from the time-of-day greeting (see BeatCopy); its `line` is the English welcome.
// Health wording is traditional use only; the hero shows the not-medical-advice note.
export const BEATS = [
  // 1. Welcome (the time-of-day greeting is added in BeatCopy)
  { line: "Welcome to Sri Sastha Paruthipaal", grey: "", points: [], side: "left" },
  // 2. Serve
  { line: "Hot, traditional paruthipaal.", grey: "Made fresh for you every day.", points: [], side: "right" },
  // 3. Benefits (traditional use; the not-medical-advice note sits under the ingredients)
  {
    line: "Good for you, the traditional way.", grey: "",
    points: [
      "Gentle warmth for your throat: sukku, pepper and cardamom.",
      "Natural energy: peanut, cashew and coconut.",
      "Sweetened only with country jaggery. No refined sugar.",
    ],
    side: "left",
  },
] as const;

export const HERO_LOCATION = { en: "Alanganallur, Madurai", ta: "அலங்காநல்லூர், மதுரை", since: "Since 1999" };
export const HEALTH_NOTE = "These benefits are based on traditional use of the ingredients and are not medical advice. Contains peanut and cashew; please let us know about any allergies.";

// Floating cards around the glass. x/y are offsets from the glass centre (desktop: vmin, phone: vw).
// `phone: false` cards are hidden on small screens. The "since" card is the one the hero zooms into.
export const FLOAT_CARDS = [
  { id: "protein", label: "Ingredients", text: "Natural protein", x: -36, y: -20, mx: 0, my: 0, depth: 0.6, phone: false },
  { id: "throat", label: "Traditional use", text: "Soothes the throat", x: 36, y: -16, mx: -16, my: -8, depth: 1.1, phone: true },
  { id: "rating", label: "Google", text: "4.8★ · 92 reviews", x: -25, y: 31, mx: 0, my: 0, depth: 0.8, phone: false },
  { id: "jaggery", label: "Sweetened with", text: "Country jaggery", x: 26, y: 30, mx: 0, my: 0, depth: 0.8, phone: false },
  { id: "since", label: "Madurai", text: "Since 1999", x: 2, y: 41, mx: 24, my: -28, depth: 1.1, phone: true },
] as const;

export const INGREDIENTS = [
  { en: "Cotton seed", ta: "பருத்தி விதை", note: "Protein and fibre" },
  { en: "Peanut", ta: "வேர்க்கடலை", note: "Plant protein" },
  { en: "Cashew", ta: "முந்திரி", note: "Richness" },
  { en: "Coconut", ta: "தேங்காய்", note: "Body" },
  { en: "Jaggery", ta: "வெல்லம்", note: "Natural sweetness" },
  { en: "Dry ginger", ta: "சுக்கு", note: "Warmth, traditionally used for digestion" },
  { en: "Cardamom", ta: "ஏலக்காய்", note: "Aroma" },
  { en: "Pepper", ta: "மிளகு", note: "The peppery kick" },
  { en: "Long pepper", ta: "திப்பிலி", note: "Traditionally used for throat and cough" },
];

export const SHOP = {
  address: "Netaji Road, opposite Dindigul Biriyani Kadai, near Periyar Bus Stand, Madurai",
  hours: "Open daily 6:30 am – 8:30 pm",
  rating: "4.8",
  reviewCount: 92,
};

/**
 * Genuine Google reviews, copied word for word (original spelling kept). "…" marks where Google
 * truncated the review. Reviews that mention prices are left out (the homepage shows no prices).
 */
export const REVIEW_QUOTES: { name: string; text: string; localGuide: boolean }[] = [
  { name: "Karthik V.", localGuide: true, text: "The taste is simply amazing, it was served fresh and hot and tasted amazing, with a touch of spices that will clear one's throat and leave a good taste. It is a humble shop and it is the only thing they offer. Do try the cottonseed milk here for sure when in Madurai!" },
  { name: "Gayathri S.", localGuide: true, text: "Loved the paruthipaal here! Absolutely delicious and perfectly spices - my sinuses cleared up immediately." },
  { name: "Ramachandran V.", localGuide: false, text: "I came to here wishing to taste the authenticity of madurai I got exactly what I wanted sweet ,peppery and tasty cotton milk or paruthi paal also the last at the counter was really nice" },
  { name: "Lahari", localGuide: false, text: "My favourite hot drink in madurai 💛 yummy, healthy, filling, unique. Do glad that I stumbled upon this! The shopkeepers are very kind too! …" },
  { name: "Tarun S.", localGuide: true, text: "First time have Cottonseed Milk (Paruthi Paal) and it was very comforting and warm. The pepper and ginger and other spices in the drink are very comforting." },
  { name: "Sasikumar R.", localGuide: true, text: "Unique drink that tastes good. Never tried this drink before. It’s a must have if you visit Madurai." },
  { name: "Narendira J.", localGuide: true, text: "Very healthy refreshing yet very tasty drink. Everyone must try this authentic tamil traditional drink" },
];

/** Topics Google lists for the shop's reviews, with how many reviews mention each. */
export const REVIEW_TOPICS: [string, number][] = [
  ["Paruthipaal", 11], ["Healthy drink", 11], ["Traditional drink", 5], ["Ginger", 4],
  ["Cashews", 2], ["Cardamom", 2], ["Spicy drink", 2], ["Unique drink", 2], ["Hygiene", 2], ["Refreshing drink", 2],
];

/** Opens the shop on Google Maps, where all reviews are listed. */
export const GOOGLE_REVIEWS_URL = "https://www.google.com/maps/search/?api=1&query=Sri+Sastha+Paruthipaal+Netaji+Road+Madurai";
