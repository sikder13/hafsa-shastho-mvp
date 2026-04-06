// Test auto-logger patterns without running the app
// Simulates detectActivities() logic

const TEST_CASES = [
  // Should LOG as feed
  { msg: "দুধ দিলাম", expect: "feed", baby_age: 125 },
  { msg: "এইমাত্র বুকের দুধ দিয়েছি", expect: "feed", baby_age: 125 },
  { msg: "দুধ খাইছে", expect: "feed", baby_age: 125 },
  { msg: "বোতল দিলাম", expect: "feed", baby_age: 125 },
  
  // Should LOG as sleep
  { msg: "বাচ্চা ঘুমাচ্ছে এখন", expect: "sleep", baby_age: 125 },
  { msg: "ঘুমিয়ে পড়েছে", expect: "sleep", baby_age: 125 },
  
  // Should LOG as diaper
  { msg: "ডায়াপার বদলালাম", expect: "diaper", baby_age: 125 },
  { msg: "পটি করেছে", expect: "diaper", baby_age: 125 },
  
  // Should LOG as food (baby 7 months)
  { msg: "ভাত খাওয়ালাম", expect: "food", baby_age: 210 },
  { msg: "খিচুড়ি দিলাম", expect: "food", baby_age: 210 },
  
  // Should NOT LOG food (baby 4 months - too young)
  { msg: "ভাত খাওয়ালাম", expect: "food_blocked", baby_age: 125 },
  { msg: "কলা দিলাম", expect: "food_blocked", baby_age: 100 },
  
  // Should NOT LOG (questions)
  { msg: "কয়বার দুধ খেয়েছে?", expect: "no_log", baby_age: 125 },
  { msg: "কি খাওয়াব?", expect: "no_log", baby_age: 125 },
  { msg: "দুধ দেব কি?", expect: "no_log", baby_age: 125 },
  
  // Should NOT LOG (future tense)
  { msg: "দুধ খাওয়াব একটু পরে", expect: "no_log", baby_age: 125 },
  
  // Should NOT LOG (negation)
  { msg: "ঘুম হচ্ছে না", expect: "no_log", baby_age: 125 },
  
  // Should NOT LOG (ambiguous - no food type specified)
  { msg: "তিনবার খাইসে", expect: "no_log", baby_age: 125 },
  { msg: "খেয়েছে", expect: "no_log", baby_age: 125 },
  
  // Should NOT LOG (shopping/buying)
  { msg: "ডায়াপার কিনতে হবে", expect: "no_log", baby_age: 125 },
];

// Simplified detection logic matching autoLogger.js
const QUESTION_INDICATORS = [
  'কয়বার', 'কতবার', 'কত বার', 'কখন', 'কেন', 'কি ', 'কী ',
  'কিভাবে', 'কীভাবে', 'কোথায়', '?',
  'কি করব', 'কী করব', 'উচিত', 'দরকার', 'লাগবে',
  'পারি কি', 'পারি কী', 'দেব কি', 'দেব কী',
  'খাওয়াব কি', 'খাওয়াব কী', 'শুরু করব',
];

const EXCLUSIONS = [
  '?', 'কি?', 'কী?',
  'খাওয়াব', 'দিব', 'দিবো', 'করব', 'করবো', 'দেব', 'দেবো',
  'খাওয়াতে হবে', 'দিতে হবে', 'করতে হবে',
  'কিনতে', 'কিনব', 'কিনলাম', 'দরকার', 'লাগবে',
  'আনতে', 'আনব',
  'কয়বার', 'কতবার', 'কতক্ষণ', 'কখন খাওয়াব', 'কি খাওয়াব',
  'উচিত', 'পারি', 'যায়', 'ভালো হবে',
];

const FOOD_PATTERNS = ['ভাত খাওয়ালাম', 'খিচুড়ি দিলাম', 'ডিম দিলাম', 'কলা দিলাম', 'কলা খাইছে', 'ভাত খাইছে', 'খাবার দিলাম', 'সেরেলাক দিলাম'];
const FEED_PATTERNS = ['দুধ দিলাম', 'দুধ খাওয়ালাম', 'দুধ খাইছে', 'দুধ দিয়েছি', 'বুকের দুধ দিয়েছি', 'বোতল দিলাম', 'বোতল দিয়েছি'];
const SLEEP_PATTERNS = ['ঘুমাচ্ছে', 'ঘুমিয়ে পড়েছে', 'ঘুমিয়ে গেছে', 'ঘুম দিয়েছে'];
const DIAPER_PATTERNS = ['ডায়াপার বদলালাম', 'পটি করেছে', 'ডায়াপার পাল্টালাম', 'পায়খানা করেছে'];

function testAutoLog(msg, babyAge) {
  const lower = msg.toLowerCase().trim();
  
  // Question check
  if (QUESTION_INDICATORS.some(q => lower.includes(q.toLowerCase()))) return 'no_log';
  
  // Exclusion check
  if (EXCLUSIONS.some(ex => lower.includes(ex))) return 'no_log';
  
  // Food patterns
  if (FOOD_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    if (babyAge < 150) return 'food_blocked';
    return 'food';
  }
  
  // Feed patterns
  if (FEED_PATTERNS.some(p => lower.includes(p.toLowerCase()))) return 'feed';
  
  // Sleep patterns
  if (SLEEP_PATTERNS.some(p => lower.includes(p.toLowerCase()))) {
    const negatives = ['হয়নি', 'হচ্ছে না', 'হয় না', 'পারছে না', 'নাই'];
    if (negatives.some(n => lower.includes(n))) return 'no_log';
    return 'sleep';
  }
  
  // Diaper patterns
  if (DIAPER_PATTERNS.some(p => lower.includes(p.toLowerCase()))) return 'diaper';
  
  return 'no_log';
}

console.log('🧪 AUTO-LOGGER TEST SUITE');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

TEST_CASES.forEach((tc, i) => {
  const result = testAutoLog(tc.msg, tc.baby_age);
  const pass = result === tc.expect;
  
  if (pass) {
    passed++;
    console.log(`✅ Test ${i+1}: "${tc.msg}" → ${result} (age: ${tc.baby_age}d)`);
  } else {
    failed++;
    console.log(`❌ Test ${i+1}: "${tc.msg}" → got "${result}", expected "${tc.expect}" (age: ${tc.baby_age}d)`);
  }
});

console.log('='.repeat(60));
console.log(`RESULTS: ${passed}/${TEST_CASES.length} passed, ${failed} failed`);
