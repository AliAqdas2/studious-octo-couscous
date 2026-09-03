export function experienceDisplayName(eventType: string): string {
  if (eventType === "In-Person Cooking") return "In-Person Cooking Class";
  const aliases: Record<string, string> = {
    "In-Person Paint & Sip": "In-Person Paint & Sip",
    "In-Person Private Monuments": "In-Person Private Monuments Tour",
    "In-Person Private Food Tour": "In-Person Private Food Tour",
    "Private Food Tour": "Private Food Tour",
    "Group Food Tour": "Group Food Tour",
    "Italian Food Tour": "Italian Food Tour",
    "Georgetown Foodie Tour": "Georgetown Foodie Tour",
    "Indoor Food Tour": "Indoor Food Tour",
    "Flavors of DC": "Flavors of DC",
    "In-Person Terrarium": "In-Person Terrarium",
    "In-Person Pottery": "In-Person Pottery Making",
    "In-Person Mixology": "In-Person Mixology",
    "In-Person Chocolate Making": "In-Person Chocolate Making",
    "In-Person Chocolate & Wine": "In-Person Chocolate and Wine Tasting",
    "In-Person Cheeseboard": "In-Person Cheeseboard Making",
    "In-Person Gingerbread": "In-Person Gingerbread Making",
    "In-Person Lend a Hand": "In-Person Lend a Hand for Good",
    "In-Person Yoga & UnWined": "In-Person Yoga & UnWined",
  };
  return aliases[eventType] || eventType || "your Mangia DC experience";
}
