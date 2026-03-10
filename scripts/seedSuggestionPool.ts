import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

interface PoolSeed {
  text: string;
  category: string;
  platform: string;
  url: string;
}

const SUGGESTIONS: PoolSeed[] = [
  // ═══════════════════════════════════════════════════════════
  // TWITCH INFLUENCERS (real streamers with real URLs)
  // ═══════════════════════════════════════════════════════════
  { text: "Watch shroud — FPS legend with insane aim", category: "influencer", platform: "twitch", url: "https://twitch.tv/shroud" },
  { text: "Pokimane is live — chill vibes and chat energy", category: "influencer", platform: "twitch", url: "https://twitch.tv/pokimane" },
  { text: "xQc streaming — chaotic energy guaranteed", category: "influencer", platform: "twitch", url: "https://twitch.tv/xqc" },
  { text: "GothamChess live — learn chess while being entertained", category: "influencer", platform: "twitch", url: "https://twitch.tv/gothamchess" },
  { text: "Hikaru playing bullet chess at 3000 ELO", category: "influencer", platform: "twitch", url: "https://twitch.tv/hikaru" },
  { text: "Ludwig streaming — always a good time", category: "influencer", platform: "twitch", url: "https://twitch.tv/ludwig" },
  { text: "HasanAbi discussing what's happening in the world", category: "influencer", platform: "twitch", url: "https://twitch.tv/hasanabi" },
  { text: "Valkyrae playing with friends — fun energy", category: "influencer", platform: "twitch", url: "https://twitch.tv/valkyrae" },
  { text: "Mizkif doing random hilarious challenges", category: "influencer", platform: "twitch", url: "https://twitch.tv/mizkif" },
  { text: "Tarik watching esports — perfect background stream", category: "influencer", platform: "twitch", url: "https://twitch.tv/tarik" },
  { text: "IronMouse singing karaoke — wholesome chaos", category: "influencer", platform: "twitch", url: "https://twitch.tv/ironmouse" },
  { text: "TimTheTatman gaming and laughing — instant mood boost", category: "influencer", platform: "twitch", url: "https://twitch.tv/timthetatman" },
  { text: "Nmplol doing IRL streams — never boring", category: "influencer", platform: "twitch", url: "https://twitch.tv/nmplol" },
  { text: "Sykkuno playing Among Us — peak detective energy", category: "influencer", platform: "twitch", url: "https://twitch.tv/sykkuno" },
  { text: "Disguised Toast trying new games — always entertaining", category: "influencer", platform: "twitch", url: "https://twitch.tv/disguisedtoast" },

  // ═══════════════════════════════════════════════════════════
  // YOUTUBE CREATORS (real channels with real URLs)
  // ═══════════════════════════════════════════════════════════
  { text: "MrBeast's latest challenge — insane production value", category: "influencer", platform: "youtube", url: "https://youtube.com/@MrBeast" },
  { text: "Kurzgesagt explains the universe in 10 minutes", category: "learning", platform: "youtube", url: "https://youtube.com/@kurzgesagt" },
  { text: "Veritasium — mind-blowing science you didn't know", category: "learning", platform: "youtube", url: "https://youtube.com/@veritasium" },
  { text: "Mark Rober built another impossible invention", category: "learning", platform: "youtube", url: "https://youtube.com/@MarkRober" },
  { text: "Linus Tech Tips — latest tech explained", category: "tech", platform: "youtube", url: "https://youtube.com/@LinusTechTips" },
  { text: "MKBHD reviewing the newest gadgets", category: "tech", platform: "youtube", url: "https://youtube.com/@mkbhd" },
  { text: "Fireship — 100 seconds of code brilliance", category: "tech", platform: "youtube", url: "https://youtube.com/@Fireship" },
  { text: "GothamChess recap — entertaining chess drama", category: "gaming", platform: "youtube", url: "https://youtube.com/@GothamChess" },
  { text: "Penguinz0 reacting to the internet's wildest clips", category: "entertainment", platform: "youtube", url: "https://youtube.com/@penguinz0" },
  { text: "Danny Gonzalez — comedy commentary gold", category: "entertainment", platform: "youtube", url: "https://youtube.com/@dannygonzalez" },
  { text: "3Blue1Brown — beautiful math visualizations", category: "learning", platform: "youtube", url: "https://youtube.com/@3blue1brown" },
  { text: "Binging with Babish — cook like a pro at home", category: "cooking", platform: "youtube", url: "https://youtube.com/@BingingWithBabish" },
  { text: "Casey Neistat vlog — NYC adventure energy", category: "entertainment", platform: "youtube", url: "https://youtube.com/@caseyneistat" },
  { text: "The Slow Mo Guys — satisfying slow motion science", category: "entertainment", platform: "youtube", url: "https://youtube.com/@theslowmoguys" },
  { text: "Yes Theory — doing things that scare them", category: "adventure", platform: "youtube", url: "https://youtube.com/@YesTheory" },
  { text: "Vsauce — what would happen if...?", category: "learning", platform: "youtube", url: "https://youtube.com/@Vsauce" },
  { text: "Tom Scott — amazing places and things explained", category: "learning", platform: "youtube", url: "https://youtube.com/@TomScottGo" },
  { text: "Corridor Crew — VFX artists react to movie magic", category: "entertainment", platform: "youtube", url: "https://youtube.com/@CorridorCrew" },
  { text: "Marques Brownlee's studio tour — tech workspace goals", category: "tech", platform: "youtube", url: "https://youtube.com/@mkbhd" },
  { text: "JiDion doing wild pranks in public", category: "entertainment", platform: "youtube", url: "https://youtube.com/@JiDion" },

  // ═══════════════════════════════════════════════════════════
  // TIKTOK CREATORS (real profiles with real URLs)
  // ═══════════════════════════════════════════════════════════
  { text: "Khaby Lame — life hacks without saying a word", category: "influencer", platform: "tiktok", url: "https://tiktok.com/@khaby.lame" },
  { text: "Charli D'Amelio — trending dances and vibes", category: "influencer", platform: "tiktok", url: "https://tiktok.com/@charlidamelio" },
  { text: "Zach King — magical illusions in 60 seconds", category: "influencer", platform: "tiktok", url: "https://tiktok.com/@zachking" },
  { text: "Bella Poarch — creative short videos and music", category: "influencer", platform: "tiktok", url: "https://tiktok.com/@bellapoarch" },
  { text: "Spencer X — beatboxing genius on TikTok", category: "music", platform: "tiktok", url: "https://tiktok.com/@spencerx" },
  { text: "Tabitha Brown — wholesome cooking and wisdom", category: "cooking", platform: "tiktok", url: "https://tiktok.com/@iamtabithabrown" },
  { text: "Dude Perfect trick shots — satisfying to watch", category: "entertainment", platform: "tiktok", url: "https://tiktok.com/@dudeperfect" },
  { text: "Doctor Mike — health tips that actually make sense", category: "learning", platform: "tiktok", url: "https://tiktok.com/@doctor.mike" },
  { text: "CorporateNatalie — office humor hits different", category: "entertainment", platform: "tiktok", url: "https://tiktok.com/@corporatenatalie" },
  { text: "Dylan Mulvaney — feel-good daily content", category: "influencer", platform: "tiktok", url: "https://tiktok.com/@dylanmulvaney" },

  // ═══════════════════════════════════════════════════════════
  // CHESS
  // ═══════════════════════════════════════════════════════════
  { text: "Solve today's daily chess puzzle on Chess.com", category: "gaming", platform: "chess", url: "https://chess.com/daily-chess-puzzle" },
  { text: "Play a 3-minute blitz game — quick chess fix", category: "gaming", platform: "chess", url: "https://chess.com/play/online" },
  { text: "Learn a new chess opening — Italian Game basics", category: "learning", platform: "chess", url: "https://chess.com/openings/Italian-Game" },
  { text: "Watch the latest chess tournament highlights", category: "gaming", platform: "chess", url: "https://chess.com/events" },
  { text: "Practice chess tactics — sharpen your pattern recognition", category: "gaming", platform: "chess", url: "https://chess.com/puzzles" },

  // ═══════════════════════════════════════════════════════════
  // ACTIVITIES (no specific platform — general suggestions)
  // ═══════════════════════════════════════════════════════════
  { text: "Do a 5-minute plank challenge and time yourself", category: "physical", platform: "general", url: "" },
  { text: "Learn to juggle with 3 items from your house", category: "physical", platform: "general", url: "" },
  { text: "Go for a 15-minute walk without your phone", category: "physical", platform: "general", url: "" },
  { text: "Try 20 pushups right now — beat your personal best", category: "physical", platform: "general", url: "" },
  { text: "Do a quick yoga flow — just 10 minutes", category: "physical", platform: "general", url: "" },
  { text: "Stretch for 5 minutes — your body will thank you", category: "physical", platform: "general", url: "" },

  { text: "Draw something with your non-dominant hand", category: "creative", platform: "general", url: "" },
  { text: "Write a haiku about your current mood", category: "creative", platform: "general", url: "" },
  { text: "Design your dream room layout on paper", category: "creative", platform: "general", url: "" },
  { text: "Create a playlist of songs that match your vibe right now", category: "creative", platform: "general", url: "" },
  { text: "Write a short story in exactly 50 words", category: "creative", platform: "general", url: "" },
  { text: "Sketch a self-portrait in under 3 minutes", category: "creative", platform: "general", url: "" },

  { text: "Learn 5 words in a language you've never studied", category: "learning", platform: "general", url: "" },
  { text: "Read a Wikipedia article about a random country", category: "learning", platform: "general", url: "https://en.wikipedia.org/wiki/Special:Random" },
  { text: "Practice typing speed for 5 minutes", category: "learning", platform: "general", url: "https://monkeytype.com" },
  { text: "Learn 3 interesting facts about space", category: "learning", platform: "general", url: "" },

  { text: "Text someone you haven't talked to in 6 months", category: "social", platform: "general", url: "" },
  { text: "Call a friend and catch up for 10 minutes", category: "social", platform: "general", url: "" },
  { text: "Send a meme to your group chat that perfectly describes today", category: "social", platform: "general", url: "" },

  { text: "Put on your favorite album and just vibe for 15 minutes", category: "chill", platform: "general", url: "" },
  { text: "Take a 20-minute power nap — set an alarm", category: "chill", platform: "general", url: "" },
  { text: "Light a candle and read a chapter of any book", category: "chill", platform: "general", url: "" },
  { text: "Reorganize your desk — chaos to clarity in 5 minutes", category: "chill", platform: "general", url: "" },

  { text: "Write 3 things you're grateful for right now", category: "mindfulness", platform: "general", url: "" },
  { text: "Meditate for 5 minutes — focus on your breathing", category: "mindfulness", platform: "general", url: "" },
  { text: "Journal about what's been on your mind lately", category: "mindfulness", platform: "general", url: "" },

  { text: "Try a new recipe you've never made before", category: "cooking", platform: "general", url: "" },
  { text: "Make a smoothie with whatever fruits you have", category: "cooking", platform: "general", url: "" },
  { text: "Bake something simple — cookies or banana bread", category: "cooking", platform: "general", url: "" },

  { text: "Build something simple with code in 30 minutes", category: "tech", platform: "general", url: "" },
  { text: "Automate one boring task on your computer", category: "tech", platform: "general", url: "" },
  { text: "Explore a new app or tool you've never used", category: "tech", platform: "general", url: "" },

  { text: "Put together an outfit you'd never normally wear", category: "fashion", platform: "general", url: "" },
  { text: "Create a mood board for your dream aesthetic", category: "fashion", platform: "general", url: "" },

  { text: "Learn the intro to a song on any instrument", category: "music", platform: "general", url: "" },
  { text: "Discover 3 new artists in a genre you don't normally listen to", category: "music", platform: "general", url: "" },
  { text: "Create a 'soundtrack of your life' playlist", category: "music", platform: "general", url: "" },

  { text: "Go to the nearest park and find something you've never noticed", category: "adventure", platform: "general", url: "" },
  { text: "Try something you've been putting off for weeks", category: "adventure", platform: "general", url: "" },
  { text: "Explore a part of your neighborhood you've never been to", category: "adventure", platform: "general", url: "" },
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
      platform: s.platform,
      url: s.url,
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
