import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

const SUGGESTIONS: Array<{ text: string; category: string }> = [
  // Physical / Active
  { text: "Do a 5-minute plank challenge and time yourself", category: "physical" },
  { text: "Learn to juggle with 3 items from your house", category: "physical" },
  { text: "Go for a 15-minute walk without your phone", category: "physical" },
  { text: "Try 20 pushups right now — beat your personal best", category: "physical" },
  { text: "Do a quick yoga flow — just 10 minutes", category: "physical" },
  { text: "Run up and down the stairs 5 times as fast as you can", category: "physical" },
  { text: "Stretch for 5 minutes — your body will thank you", category: "physical" },

  // Creative
  { text: "Draw something with your non-dominant hand", category: "creative" },
  { text: "Write a haiku about your current mood", category: "creative" },
  { text: "Design your dream room layout on paper", category: "creative" },
  { text: "Create a playlist of songs that match your vibe right now", category: "creative" },
  { text: "Write a short story in exactly 50 words", category: "creative" },
  { text: "Sketch a self-portrait in under 3 minutes", category: "creative" },
  { text: "Compose a beat using only household objects", category: "creative" },

  // Learning / Skill
  { text: "Learn 5 words in a language you've never studied", category: "learning" },
  { text: "Watch a 10-minute documentary about deep sea creatures", category: "learning" },
  { text: "Learn one magic trick and perform it for someone", category: "learning" },
  { text: "Read a Wikipedia article about a random country", category: "learning" },
  { text: "Learn to solve a Rubik's cube — just the first layer", category: "learning" },
  { text: "Practice typing speed for 5 minutes on a typing test", category: "learning" },
  { text: "Learn 3 interesting facts about space", category: "learning" },
  { text: "Study a famous painting for 5 minutes and write what you see", category: "learning" },

  // Social
  { text: "Text someone you haven't talked to in 6 months", category: "social" },
  { text: "Call a friend and catch up for 10 minutes", category: "social" },
  { text: "Write a genuine compliment to 3 people in your contacts", category: "social" },
  { text: "Plan a hangout for this weekend with someone you miss", category: "social" },
  { text: "Send a meme to your group chat that perfectly describes today", category: "social" },

  // Relaxation / Chill
  { text: "Put on your favorite album and just vibe for 15 minutes", category: "chill" },
  { text: "Make the fanciest drink possible with what's in your kitchen", category: "chill" },
  { text: "Take a 20-minute power nap — set an alarm", category: "chill" },
  { text: "Sit outside and cloud-watch for 10 minutes", category: "chill" },
  { text: "Light a candle and read a chapter of any book", category: "chill" },
  { text: "Take a shower and pretend you're in a music video", category: "chill" },
  { text: "Reorganize your desk — chaos to clarity in 5 minutes", category: "chill" },

  // Gaming / Competitive
  { text: "Play a speed chess game — 3 minutes, no takebacks", category: "gaming" },
  { text: "Try to beat your high score in any mobile game", category: "gaming" },
  { text: "Play a quick round of your favorite competitive game", category: "gaming" },
  { text: "Learn a new opening in chess and practice it 3 times", category: "gaming" },
  { text: "Challenge someone to a 1v1 in any game", category: "gaming" },
  { text: "Speedrun a puzzle game and time yourself", category: "gaming" },

  // Mindfulness / Reflection
  { text: "Write 3 things you're grateful for right now", category: "mindfulness" },
  { text: "Meditate for just 5 minutes — focus on your breathing", category: "mindfulness" },
  { text: "Journal about what's been on your mind lately", category: "mindfulness" },
  { text: "List 5 things that made you smile this week", category: "mindfulness" },

  // Cooking / Food
  { text: "Try a new recipe you've never made before", category: "cooking" },
  { text: "Make a smoothie with whatever fruits you have", category: "cooking" },
  { text: "Bake something simple — cookies, brownies, or banana bread", category: "cooking" },
  { text: "Learn to make a dish from a cuisine you've never tried", category: "cooking" },

  // Fashion / Style
  { text: "Put together an outfit you'd never normally wear", category: "fashion" },
  { text: "Clean out your closet and donate what you don't wear", category: "fashion" },
  { text: "Create a mood board for your dream aesthetic", category: "fashion" },
  { text: "Try styling one item 3 completely different ways", category: "fashion" },

  // Music
  { text: "Learn the intro to a song on any instrument", category: "music" },
  { text: "Discover 3 new artists in a genre you don't normally listen to", category: "music" },
  { text: "Create a 'soundtrack of your life' playlist", category: "music" },
  { text: "Learn to beatbox a basic pattern", category: "music" },

  // Tech / Coding
  { text: "Build something simple with code in 30 minutes", category: "tech" },
  { text: "Automate one boring task on your computer", category: "tech" },
  { text: "Learn a new keyboard shortcut and practice it", category: "tech" },
  { text: "Explore a new app or tool you've never used", category: "tech" },

  // Adventure / Random
  { text: "Go to the nearest park and find something you've never noticed", category: "adventure" },
  { text: "Take a photo of something beautiful you walk past every day", category: "adventure" },
  { text: "Try something you've been putting off for weeks", category: "adventure" },
  { text: "Flip a coin — heads: go outside, tails: start a project", category: "adventure" },
  { text: "Explore a part of your neighborhood you've never been to", category: "adventure" },
];

function generatePlaceholderEmbedding(text: string, category: string): number[] {
  const hash = crypto.createHash("sha256").update(`${category}:${text}`).digest();
  const vec: number[] = [];

  for (let i = 0; i < 1536; i++) {
    const byte = hash[i % hash.length];
    const offset = (i * 7 + byte) % 256;
    vec.push((offset / 255) * 2 - 1);
  }

  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / magnitude);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Seeding ${SUGGESTIONS.length} suggestions with placeholder embeddings...`);
  console.log(`(Using deterministic hash-based vectors — swap to OpenAI later for real semantics)\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < SUGGESTIONS.length; i++) {
    const s = SUGGESTIONS[i];
    const embedding = generatePlaceholderEmbedding(s.text, s.category);
    const embeddingStr = `[${embedding.join(",")}]`;

    const { error } = await supabase.from("suggestion_pool").insert({
      content_text: s.text,
      category: s.category,
      embedding: embeddingStr,
    });

    if (error) {
      console.error(`  FAIL: "${s.text.slice(0, 40)}..." — ${error.message}`);
      failed++;
    } else {
      success++;
    }

    if ((i + 1) % 10 === 0 || i === SUGGESTIONS.length - 1) {
      console.log(`  ${i + 1}/${SUGGESTIONS.length} done (${success} ok, ${failed} err)`);
    }
  }

  console.log(`\nDone! ${success} seeded, ${failed} failed.`);
}

main().catch(console.error);
