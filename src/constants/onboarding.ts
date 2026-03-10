export interface OnboardingQuestion {
  id: string;
  slot: "digital" | "skill" | "energy" | "wildcard";
  text: string;
  placeholder: string;
}

export interface OnboardingSlot {
  name: string;
  description: string;
  variants: OnboardingQuestion[];
}

export const ONBOARDING_SLOTS: OnboardingSlot[] = [
  {
    name: "Digital Anchor",
    description: "YouTube, Twitch, or community interests",
    variants: [
      {
        id: "digital-a",
        slot: "digital",
        text: "Who are 3 YouTubers you'd watch if the internet was ending?",
        placeholder: "e.g. GothamChess, MrBeast, Fireship",
      },
      {
        id: "digital-b",
        slot: "digital",
        text: "Which Twitch streamers do you actually find funny or insightful?",
        placeholder: "e.g. xQc, Pokimane, ThePrimeagen",
      },
      {
        id: "digital-c",
        slot: "digital",
        text: "What's a subreddit or online community you check every single day?",
        placeholder: "e.g. r/chess, r/webdev, HackerNews",
      },
    ],
  },
  {
    name: "Current Skill",
    description: "Gaming rank, coding level, or competitive stats",
    variants: [
      {
        id: "skill-a",
        slot: "skill",
        text: "Do you play any competitive games? What's your rank or ELO?",
        placeholder: "e.g. Chess 420 ELO, Valorant Gold 2, League Silver",
      },
      {
        id: "skill-b",
        slot: "skill",
        text: "What's a skill you've been leveling up lately? How far along are you?",
        placeholder: "e.g. Learning Python (beginner), Guitar (6 months)",
      },
      {
        id: "skill-c",
        slot: "skill",
        text: "If you had to teach someone one thing you're decent at, what would it be?",
        placeholder: "e.g. Chess openings, cooking pasta, photo editing",
      },
    ],
  },
  {
    name: "Energy State",
    description: "Physical vs. mental boredom",
    variants: [
      {
        id: "energy-a",
        slot: "energy",
        text: "When you're bored, are you more 'brain-dead on the couch' or 'restless with energy'?",
        placeholder: "e.g. Usually couch mode, Sometimes restless",
      },
      {
        id: "energy-b",
        slot: "energy",
        text: "After a long day, do you want to zone out or do something active?",
        placeholder: "e.g. Zone out with YouTube, Go for a run",
      },
      {
        id: "energy-c",
        slot: "energy",
        text: "What time of day do you usually get bored? What's your vibe then?",
        placeholder: "e.g. Late night, low energy. Afternoons, restless.",
      },
    ],
  },
  {
    name: "Wildcard",
    description: "Current obsession or long-term goal",
    variants: [
      {
        id: "wildcard-a",
        slot: "wildcard",
        text: "What's something you're lowkey obsessed with right now?",
        placeholder: "e.g. Mechanical keyboards, true crime podcasts",
      },
      {
        id: "wildcard-b",
        slot: "wildcard",
        text: "If you had 3 free hours with zero obligations, what would you actually do?",
        placeholder: "e.g. Play chess, binge anime, build something",
      },
      {
        id: "wildcard-c",
        slot: "wildcard",
        text: "What's a goal or hobby you keep saying you'll start but never do?",
        placeholder: "e.g. Start a YouTube channel, learn to cook, read more",
      },
    ],
  },
];

export function getRandomOnboardingSet(): OnboardingQuestion[] {
  return ONBOARDING_SLOTS.map((slot) => {
    const idx = Math.floor(Math.random() * slot.variants.length);
    return slot.variants[idx];
  });
}
