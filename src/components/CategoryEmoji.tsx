/**
 * Shared CategoryEmoji component
 * Maps category codes to emoji icons
 */
type CategoryEmojiProps = {
  code: string;
  className?: string;
};

export function CategoryEmoji({ code, className = "" }: CategoryEmojiProps) {
  const emojiMap: Record<string, string> = {
    bakery: "🥐",
    breakfasts: "🍳",
    snacks: "🥨",
    salads: "🥗",
    soups: "🥣",
    pizza: "🍕",
    burgers: "🍔",
    "hot-dishes": "🍽️",
    pasta: "🍝",
    desserts: "🍰",
    drinks: "🥤",
    combos: "🧺",
    "asian-fusion": "🍴",
  };

  // Find matching emoji by checking if code starts with any key
  let emoji = "🍴"; // default
  for (const [key, value] of Object.entries(emojiMap)) {
    if (code.startsWith(key)) {
      emoji = value;
      break;
    }
  }

  return <span className={className}>{emoji}</span>;
}

