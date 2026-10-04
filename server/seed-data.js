// Seed catalog: loaded into the database on first run (see server/seed.js).
// After that, edit products in the admin panel at /admin.
// Prices are in NPR. `rating` is the freshness rating (out of 5).
// Photos are from Wikimedia Commons; see images/credits.json and credits.html.

const CATEGORIES = [
  { id: "veg", ne: "साग", en: "Vegetables", image: "images/tomato-baskets.jpg" },
  { id: "fruit", ne: "फल", en: "Fruits", image: "images/apple.jpg" },
  { id: "dairy", ne: "दूध", en: "Dairy & Milk", image: "images/juju-dhau.jpg" },
  { id: "herb", ne: "जडिबुटी", en: "Herbs & Spices", image: "images/coriander.jpg" },
  { id: "other", ne: "अन्य", en: "Other Fresh Items", image: "images/mushroom.jpg" },
];

const PRODUCTS = [
  // ---------- Vegetables ----------
  {
    id: 1, cat: "veg", ne: "रायोको साग", en: "Mustard Greens (Rayo)", unit: "bunch",
    price: 60, rating: 4.8, stock: 40, sold: 920, added: "2026-09-28", image: "images/rayo.jpg",
    origin: "Kavre District, Nepal",
    desc: "Tender rayo leaves picked at dawn from family farms in Kavre. The heart of every Nepali saag: fry with garlic and a pinch of timur.",
    nutrition: [["Energy", "27 kcal"], ["Protein", "2.9 g"], ["Fibre", "3.2 g"], ["Vitamin C", "70 mg"]],
    storage: "Wrap loosely in a damp cloth and keep in the fridge. Best eaten within 2–3 days.",
    reviews: [
      { name: "Sita Shrestha", rating: 5, comment: "So fresh, it tasted just like the saag from my mother's garden." },
      { name: "Bikash Tamang", rating: 4, comment: "Good bunch size. One or two yellow leaves but overall great." },
    ],
  },
  {
    id: 2, cat: "veg", ne: "गोलभेडा", en: "Tomatoes", unit: "kg",
    price: 90, rating: 4.5, stock: 60, sold: 1140, added: "2026-09-20", image: "images/tomato.jpg",
    origin: "Dhading District, Nepal",
    desc: "Firm, juicy local tomatoes, ideal for golbheda ko achar, curries and salads.",
    nutrition: [["Energy", "18 kcal"], ["Protein", "0.9 g"], ["Fibre", "1.2 g"], ["Vitamin C", "14 mg"]],
    storage: "Keep at room temperature away from sunlight until ripe, then refrigerate.",
    reviews: [{ name: "Anjali Gurung", rating: 5, comment: "Perfect for achar. Very red and ripe." }],
  },
  {
    id: 3, cat: "veg", ne: "आलु", en: "Potatoes", unit: "kg",
    price: 70, rating: 4.4, stock: 120, sold: 1310, added: "2026-08-30", image: "images/potato.jpg",
    origin: "Dolakha District, Nepal",
    desc: "Hill-grown potatoes with a buttery texture. Great for aloo tama, aloo chop and aloo sadeko.",
    nutrition: [["Energy", "77 kcal"], ["Protein", "2 g"], ["Fibre", "2.2 g"], ["Vitamin C", "20 mg"]],
    storage: "Store in a cool, dark, dry place. Do not refrigerate. Keeps for 2–3 weeks.",
    reviews: [{ name: "Ramesh Thapa", rating: 4, comment: "Good quality, all similar size." }],
  },
  {
    id: 4, cat: "veg", ne: "काउली", en: "Cauliflower", unit: "kg",
    price: 110, rating: 4.6, stock: 35, sold: 640, added: "2026-09-25", image: "images/cauliflower.jpg",
    origin: "Kavre District, Nepal",
    desc: "Compact white cauliflower heads, perfect for cauli-aloo tarkari.",
    nutrition: [["Energy", "25 kcal"], ["Protein", "1.9 g"], ["Fibre", "2 g"], ["Vitamin C", "48 mg"]],
    storage: "Refrigerate in a perforated bag. Use within 4–5 days.",
    reviews: [{ name: "Pooja Rai", rating: 5, comment: "No insects, very clean. Will order again." }],
  },
  {
    id: 5, cat: "veg", ne: "गाजर", en: "Carrots", unit: "kg",
    price: 100, rating: 4.3, stock: 50, sold: 580, added: "2026-09-10", image: "images/carrot.jpg",
    origin: "Bhaktapur District, Nepal",
    desc: "Sweet, crunchy carrots from Bhaktapur. Lovely in gajar ko haluwa or raw in salads.",
    nutrition: [["Energy", "41 kcal"], ["Protein", "0.9 g"], ["Fibre", "2.8 g"], ["Vitamin A", "835 µg"]],
    storage: "Remove leafy tops and refrigerate in a bag. Keeps for up to 2 weeks.",
    reviews: [{ name: "Suman KC", rating: 4, comment: "Sweet and crunchy." }],
  },
  {
    id: 6, cat: "veg", ne: "फर्सी", en: "Pumpkin", unit: "kg",
    price: 80, rating: 4.2, stock: 25, sold: 310, added: "2026-09-29", image: "images/pumpkin.jpg",
    origin: "Chitwan District, Nepal",
    desc: "Ripe pumpkin with bright orange flesh. Cook as pharsi ko tarkari or roast it.",
    nutrition: [["Energy", "26 kcal"], ["Protein", "1 g"], ["Fibre", "0.5 g"], ["Vitamin A", "426 µg"]],
    storage: "Whole pumpkin keeps for weeks in a cool place. Refrigerate cut pieces and use within 5 days.",
    reviews: [],
  },

  // ---------- Fruits ----------
  {
    id: 7, cat: "fruit", ne: "मुस्ताङको स्याउ", en: "Mustang Apples", unit: "kg",
    price: 320, rating: 4.9, stock: 45, sold: 1020, added: "2026-09-18", image: "images/apple.jpg",
    origin: "Mustang District, Nepal",
    desc: "Famous crisp, sweet apples from the high valleys of Mustang, grown without heavy chemicals.",
    nutrition: [["Energy", "52 kcal"], ["Protein", "0.3 g"], ["Fibre", "2.4 g"], ["Vitamin C", "4.6 mg"]],
    storage: "Refrigerate in the crisper drawer. Stays crisp for 3–4 weeks.",
    reviews: [
      { name: "Nirmala Magar", rating: 5, comment: "Best apples in Nepal, nothing compares." },
      { name: "Hari Adhikari", rating: 5, comment: "Very crunchy and sweet. Kids loved them." },
    ],
  },
  {
    id: 8, cat: "fruit", ne: "केरा", en: "Bananas", unit: "dozen",
    price: 160, rating: 4.4, stock: 70, sold: 870, added: "2026-09-05", image: "images/banana.jpg",
    origin: "Chitwan District, Nepal",
    desc: "Naturally ripened Chitwan bananas: soft, sweet and full of energy.",
    nutrition: [["Energy", "89 kcal"], ["Protein", "1.1 g"], ["Fibre", "2.6 g"], ["Potassium", "358 mg"]],
    storage: "Keep at room temperature. Hang them to slow ripening.",
    reviews: [{ name: "Gita Poudel", rating: 4, comment: "Ripe and ready to eat." }],
  },
  {
    id: 9, cat: "fruit", ne: "आँप", en: "Mango", unit: "kg",
    price: 220, rating: 4.7, stock: 0, sold: 760, added: "2026-06-12", image: "images/mango.jpg",
    origin: "Saptari District, Nepal",
    desc: "Juicy Maldah mangoes from the Terai. Back next summer!",
    nutrition: [["Energy", "60 kcal"], ["Protein", "0.8 g"], ["Fibre", "1.6 g"], ["Vitamin C", "36 mg"]],
    storage: "Ripen at room temperature, then refrigerate for up to 5 days.",
    reviews: [{ name: "Rajesh Yadav", rating: 5, comment: "Sweetest mangoes this season." }],
  },
  {
    id: 10, cat: "fruit", ne: "सुन्तला", en: "Oranges", unit: "kg",
    price: 180, rating: 4.5, stock: 55, sold: 690, added: "2026-09-30", image: "images/orange.jpg",
    origin: "Syangja District, Nepal",
    desc: "Early-season Syangja oranges, tangy and refreshing.",
    nutrition: [["Energy", "47 kcal"], ["Protein", "0.9 g"], ["Fibre", "2.4 g"], ["Vitamin C", "53 mg"]],
    storage: "Keep in a cool place for a week, or refrigerate for up to 3 weeks.",
    reviews: [],
  },
  {
    id: 11, cat: "fruit", ne: "नास्पाती", en: "Pears", unit: "kg",
    price: 150, rating: 4.3, stock: 30, sold: 280, added: "2026-09-22", image: "images/pear.jpg",
    origin: "Dolakha District, Nepal",
    desc: "Hill pears with a crisp bite and gentle sweetness.",
    nutrition: [["Energy", "57 kcal"], ["Protein", "0.4 g"], ["Fibre", "3.1 g"], ["Vitamin C", "4.3 mg"]],
    storage: "Ripen at room temperature, then refrigerate.",
    reviews: [],
  },

  // ---------- Dairy & Milk ----------
  {
    id: 12, cat: "dairy", ne: "गाईको दूध", en: "Fresh Cow Milk", unit: "litre",
    price: 110, rating: 4.8, stock: 80, sold: 1500, added: "2026-09-01", image: "images/milk.jpg",
    origin: "Chitwan District, Nepal",
    desc: "Pasteurised whole milk from cooperative dairy farms, delivered chilled every morning.",
    nutrition: [["Energy", "61 kcal"], ["Protein", "3.2 g"], ["Fat", "3.3 g"], ["Calcium", "113 mg"]],
    storage: "Keep refrigerated below 4°C. Use within 2 days of opening.",
    reviews: [{ name: "Sabina Karki", rating: 5, comment: "Thick and creamy, makes great chiya." }],
  },
  {
    id: 13, cat: "dairy", ne: "जुजु धौ", en: "Juju Dhau (King Curd)", unit: "kg",
    price: 380, rating: 4.9, stock: 20, sold: 540, added: "2026-09-26", image: "images/juju-dhau.jpg",
    origin: "Bhaktapur District, Nepal",
    desc: "Bhaktapur's famous rich, sweet curd, set in traditional clay pots (kataro).",
    nutrition: [["Energy", "~150 kcal"], ["Protein", "4 g"], ["Fat", "6 g"], ["Calcium", "120 mg"]],
    storage: "Refrigerate and enjoy within 3 days.",
    reviews: [{ name: "Prakash Shakya", rating: 5, comment: "Authentic taste, just like in Bhaktapur Durbar Square." }],
  },
  {
    id: 14, cat: "dairy", ne: "छुर्पी", en: "Chhurpi (Hard Cheese)", unit: "250 g",
    price: 600, rating: 4.6, stock: 15, sold: 210, added: "2026-08-15", image: "images/chhurpi.jpg",
    origin: "Dolakha District, Nepal",
    desc: "Traditional hard chhurpi made from yak and cow milk. A long-lasting Himalayan snack.",
    nutrition: [["Energy", "~350 kcal"], ["Protein", "~50 g"], ["Fat", "~5 g"], ["Calcium", "High"]],
    storage: "Store in an airtight container in a dry place. Keeps for months.",
    reviews: [{ name: "Dawa Sherpa", rating: 4, comment: "Hard and long-lasting, just right." }],
  },
  {
    id: 15, cat: "dairy", ne: "घ्यू", en: "Pure Ghee", unit: "500 ml",
    price: 950, rating: 4.7, stock: 18, sold: 330, added: "2026-09-12", image: "images/ghee.jpg",
    origin: "Jumla District, Nepal",
    desc: "Slow-cooked ghee from grass-fed cows in Jumla, with a rich, nutty aroma.",
    nutrition: [["Energy", "~900 kcal"], ["Fat", "100 g"], ["Protein", "0 g"], ["Vitamin A", "High"]],
    storage: "Keep the lid tightly closed in a cool, dry place. No refrigeration needed.",
    reviews: [],
  },

  // ---------- Herbs & Spices ----------
  {
    id: 16, cat: "herb", ne: "धनियाँ", en: "Fresh Coriander", unit: "bunch",
    price: 50, rating: 4.5, stock: 60, sold: 980, added: "2026-09-27", image: "images/coriander.jpg",
    origin: "Kavre District, Nepal",
    desc: "Fragrant coriander bunches to finish every dal, tarkari and achar.",
    nutrition: [["Energy", "23 kcal"], ["Protein", "2.1 g"], ["Fibre", "2.8 g"], ["Vitamin K", "310 µg"]],
    storage: "Stand stems in a glass of water in the fridge, loosely covered.",
    reviews: [],
  },
  {
    id: 17, cat: "herb", ne: "लसुन", en: "Garlic", unit: "500 g",
    price: 160, rating: 4.4, stock: 40, sold: 610, added: "2026-08-20", image: "images/garlic.jpg",
    origin: "Jumla District, Nepal",
    desc: "Strong, aromatic hill garlic with large cloves.",
    nutrition: [["Energy", "149 kcal"], ["Protein", "6.4 g"], ["Fibre", "2.1 g"], ["Vitamin C", "31 mg"]],
    storage: "Store in a dry, ventilated place. Do not refrigerate whole bulbs.",
    reviews: [],
  },
  {
    id: 18, cat: "herb", ne: "हरियो खुर्सानी", en: "Green Chillies", unit: "250 g",
    price: 60, rating: 4.3, stock: 45, sold: 720, added: "2026-09-15", image: "images/chilli.jpg",
    origin: "Ilam District, Nepal",
    desc: "Hot green chillies from Ilam. A must for achar and every Nepali meal.",
    nutrition: [["Energy", "40 kcal"], ["Protein", "2 g"], ["Fibre", "1.5 g"], ["Vitamin C", "240 mg"]],
    storage: "Remove stems and refrigerate in a paper bag for up to a week.",
    reviews: [],
  },
  {
    id: 19, cat: "herb", ne: "पुदिना", en: "Mint Leaves", unit: "bunch",
    price: 50, rating: 4.2, stock: 0, sold: 250, added: "2026-09-08", image: "images/mint.jpg",
    origin: "Lalitpur District, Nepal",
    desc: "Cool, fresh mint for chutney, lemonade and garnish.",
    nutrition: [["Energy", "70 kcal"], ["Protein", "3.8 g"], ["Fibre", "8 g"], ["Iron", "5 mg"]],
    storage: "Wrap in a damp paper towel and refrigerate.",
    reviews: [],
  },

  // ---------- Other Fresh Items ----------
  {
    id: 20, cat: "other", ne: "च्याउ", en: "Oyster Mushrooms", unit: "500 g",
    price: 180, rating: 4.6, stock: 25, sold: 450, added: "2026-10-01", image: "images/mushroom.jpg",
    origin: "Kathmandu District, Nepal",
    desc: "Freshly harvested oyster mushrooms (kanye chyau), great in chilli or soup.",
    nutrition: [["Energy", "33 kcal"], ["Protein", "3.3 g"], ["Fibre", "2.3 g"], ["Vitamin B3", "5 mg"]],
    storage: "Keep in a paper bag in the fridge. Use within 3 days.",
    reviews: [{ name: "Kiran Maharjan", rating: 5, comment: "Fresh and firm, not soggy at all." }],
  },
  {
    id: 21, cat: "other", ne: "लोकल अण्डा", en: "Local Eggs", unit: "dozen",
    price: 360, rating: 4.7, stock: 30, sold: 820, added: "2026-09-24", image: "images/eggs.jpg",
    origin: "Chitwan District, Nepal",
    desc: "Free-range local (rato) eggs with rich, deep-yellow yolks.",
    nutrition: [["Energy", "155 kcal"], ["Protein", "13 g"], ["Fat", "11 g"], ["Vitamin B12", "1.1 µg"]],
    storage: "Refrigerate, pointed end down. Use within 3 weeks.",
    reviews: [],
  },
  {
    id: 22, cat: "other", ne: "मह", en: "Himalayan Honey", unit: "500 g",
    price: 850, rating: 4.8, stock: 12, sold: 390, added: "2026-09-03", image: "images/honey.jpg",
    origin: "Lamjung District, Nepal",
    desc: "Raw, unfiltered honey from hill beekeepers in Lamjung.",
    nutrition: [["Energy", "304 kcal"], ["Sugars", "82 g"], ["Protein", "0.3 g"], ["Fat", "0 g"]],
    storage: "Store at room temperature. Crystallising is natural; warm gently to liquefy.",
    reviews: [],
  },
];

const TESTIMONIALS = [
  { name: "Sita Shrestha", place: "Lalitpur", rating: 5, text: "सागपात एकदमै ताजा आउँछ! The rayo saag tasted like it came straight from the farm." },
  { name: "Ramesh Thapa", place: "Kathmandu", rating: 5, text: "Same-day delivery actually arrived before lunch. The rider even called ahead." },
  { name: "Anjali Gurung", place: "Bhaktapur", rating: 4, text: "Great quality fruit and fair prices. I love paying with eSewa at the door." },
];

function getProduct(id) {
  return PRODUCTS.find((p) => p.id === Number(id));
}

function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id);
}
