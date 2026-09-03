import type {
  EateryOrderLine,
  EateryOrderMode,
  EateryTimeLabel,
} from "../../db/schema/eateries.js";

/**
 * Food Tour Restaurant Options and Their Order Scheme — catalog seed.
 * `perGuests` is how many guests one order serves; null means an instruction
 * line that carries no quantity.
 */
export interface EaterySeedRow {
  seedKey: string;
  name: string;
  address: string | null;
  timeLabel: EateryTimeLabel;
  orderMode: EateryOrderMode;
  orderLines: EateryOrderLine[];
  drinkOption: string | null;
  orderKeyDishes: string | null;
  notes: string | null;
  sortOrder: number;
}

export const EATERY_SEED: EaterySeedRow[] = [
  {
    seedKey: "al_tiramisu",
    name: "Al Tiramisu",
    address: null,
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [{ label: "Mushroom Ragu", perGuests: 2 }],
    drinkOption: "Red or White Wine",
    orderKeyDishes: "Mushroom Ragu (1 order for every 2 people)",
    notes: null,
    sortOrder: 10,
  },
  {
    seedKey: "chaia",
    name: "Chaia",
    address: null,
    timeLabel: "Arrival Time",
    orderMode: "ORDERING AT",
    orderLines: [
      { label: "Creamy Kale and Potato Taco", perGuests: 1 },
      {
        label: "Braised Mushroom Taco",
        perGuests: 1,
        note: "Vegan option",
      },
    ],
    drinkOption: "Margarita or Canned Beer",
    orderKeyDishes:
      "1 Creamy Kale and Potato taco per guest; Braised Mushroom Taco is a vegan option",
    notes: null,
    sortOrder: 20,
  },
  {
    seedKey: "das_ethiopian",
    name: "DAS Ethiopian",
    address: null,
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Veggie Plates", perGuests: 4 },
      {
        label: "Request that everyone also has a spoon",
        perGuests: null,
      },
      {
        label: "Make a point to ask the server for more injera",
        perGuests: null,
      },
    ],
    drinkOption: "Honey wine (Tej)",
    orderKeyDishes:
      "1 Veggie Sampler for every 4 guests; gluten free injera is an option",
    notes: null,
    sortOrder: 30,
  },
  {
    seedKey: "dog_tag",
    name: "Dog Tag",
    address: null,
    timeLabel: "Arrival Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Blondie Brownies", perGuests: 1 },
      {
        label: "Warrior Bites",
        perGuests: 1,
        note: "Gluten free option",
      },
    ],
    drinkOption: "Coffee or Tea",
    orderKeyDishes: "Butterscotch Blondie; GF/Vegan = Warrior Bites",
    notes: null,
    sortOrder: 40,
  },
  {
    seedKey: "dolcezza",
    name: "Dolcezza",
    address: null,
    timeLabel: "Arrival Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      {
        label: "Champagne Mango Push-Pop",
        perGuests: 1,
        note: "Dairy-free option",
      },
      { label: "Strawberry Gelato Push-Pop", perGuests: 1 },
    ],
    drinkOption: null,
    orderKeyDishes:
      "Champagne Mango or Strawberry Push-Pops (1 per guest); Mango is a dairy free option",
    notes: null,
    sortOrder: 50,
  },
  {
    seedKey: "i_ricchi",
    name: "I Ricchi",
    address: null,
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Rigatoni Strascicate", perGuests: 2 },
      {
        label: "Risotto del Giorno",
        perGuests: 2,
        note: "Dietary option",
      },
    ],
    drinkOption: "Red or White Wine",
    orderKeyDishes:
      "Rigatoni Strascicate (1 order for every 2 people); Risotto del Giorno (1 order for every 2 people, dietary option)",
    notes: null,
    sortOrder: 60,
  },
  {
    seedKey: "il_canale",
    name: "Il Canale",
    address: "1065 31st St NW, Washington, DC 20007",
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Margherita Pizzas", perGuests: 8 },
      {
        label: "Meatball appetizer",
        perGuests: 2,
        note: "Lunch portion 1 per 2 guests; dinner portion 1 per 4 guests",
      },
    ],
    drinkOption: "Montepulciano d'Abruzzo or Peroni",
    orderKeyDishes:
      "Margherita Pizza sliced 8 ways; 1 order of meatballs for every 2 people; gluten free crust is an option",
    notes: null,
    sortOrder: 70,
  },
  {
    seedKey: "la_tomate",
    name: "La Tomate",
    address: null,
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Cheese Boards", perGuests: 4 },
      { label: "Charcuterie Boards", perGuests: 4 },
    ],
    drinkOption: "Red or White Wine",
    orderKeyDishes:
      "Cheese Boards (1 order for every 4 people); Charcuterie Boards (1 order for every 4 people)",
    notes: null,
    sortOrder: 80,
  },
  {
    seedKey: "mr_smiths_georgetown",
    name: "Mr. Smith's Georgetown",
    address: "3205 Water St NW",
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Apple Pies", perGuests: 8 },
      {
        label: "Ice Cream Sundaes",
        perGuests: 1,
        note: "Nut free dessert option",
      },
      {
        label: "Wings: Buffalo, Honey BBQ, Plain",
        perGuests: null,
        note: "3 wings per guest — 3rd savory portion only",
      },
    ],
    drinkOption: "House Wine, Well Drinks, Domestic Beer (short menu)",
    orderKeyDishes:
      "Wings in 3 flavors (bbq, original, buffalo); gluten free = grilled chicken w/ sauce on side; vegan wings from Wingo's; apple pie a la mode; vegan & gluten free: fruit cup/sundae",
    notes: null,
    sortOrder: 90,
  },
  {
    seedKey: "pizzeria_paradiso",
    name: "Pizzeria Paradiso",
    address: null,
    timeLabel: "Arrival Time",
    orderMode: "ORDERING AT",
    orderLines: [{ label: "Margherita Pizza", perGuests: 4 }],
    drinkOption: "Draft Beer",
    orderKeyDishes: "Margherita Pizza (1 for every 4 guests)",
    notes: null,
    sortOrder: 100,
  },
  {
    seedKey: "sette_osteria",
    name: "Sette Osteria",
    address: null,
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Cheese Boards", perGuests: 4 },
      { label: "Charcuterie Boards", perGuests: 4 },
    ],
    drinkOption: "Red or White Wine",
    orderKeyDishes:
      "Cheese Boards (1 order for every 4 people); Charcuterie Boards (1 order for every 4 people)",
    notes: null,
    sortOrder: 110,
  },
  {
    seedKey: "stachowskis",
    name: "Stachowski's",
    address: "1425 28th St NW",
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Piroshkis", perGuests: 2, note: "1/2 piroshki per guest" },
      {
        label: "Half smoke — chopped up with mustard on the side",
        perGuests: 8,
      },
      {
        label:
          "Dietary options: gluten free whole half-smoke no bun with peppers and onions; vegetarian soup of the day or salad from the case; vegan call ahead; pescatarian shrimp skewers",
        perGuests: null,
      },
    ],
    drinkOption: "Bottled water brought by guide",
    orderKeyDishes:
      "1/2 piroshki per guest; 1 half-smoke cut into samples serves up to 8 guests; vegan = day-of deli sides selection",
    notes: null,
    sortOrder: 120,
  },
  {
    seedKey: "the_tombs",
    name: "The Tombs",
    address: "1226 36th St NW",
    timeLabel: "Reservation Time",
    orderMode: "ORDERING AT",
    orderLines: [
      { label: "Fire Cracker Shrimp Appetizers", perGuests: 2 },
      {
        label: "Elote Loco",
        perGuests: 2,
        note: "Vegetarian and gluten free option",
      },
    ],
    drinkOption: "Prosecco / QR code menu",
    orderKeyDishes:
      "Firecracker Shrimp; Elote Loco (vegetarian and gluten free)",
    notes: null,
    sortOrder: 130,
  },
  {
    seedKey: "tony_and_joes",
    name: "Tony and Joe's",
    address: null,
    timeLabel: "Reservation Time",
    orderMode: "PRE-ORDERED",
    orderLines: [
      { label: "Brownie Sundae", perGuests: 1 },
      { label: "Mango Sorbet", perGuests: 1 },
    ],
    drinkOption: "House Wine or Draft Beer",
    orderKeyDishes:
      "Brownie Sundae (1 per guest); Mango Sorbet (1 per guest)",
    notes: null,
    sortOrder: 140,
  },
  {
    seedKey: "yellow",
    name: "Yellow",
    address: null,
    timeLabel: "Arrival Time",
    orderMode: "ORDERING AT",
    orderLines: [
      { label: "Skeeha (lamb meat pie)", perGuests: 2 },
      {
        label: "Shakshuka",
        perGuests: 2,
        note: "Vegetarian option",
      },
    ],
    drinkOption: "Lebanese Wine or DC Brau",
    orderKeyDishes:
      "1 Skeeha for every 2 people; Shakshuka is the vegetarian option",
    notes: null,
    sortOrder: 150,
  },
];
