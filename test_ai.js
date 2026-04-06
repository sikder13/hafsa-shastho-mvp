const EDGE_URL = 'https://unnmjrrpqftpcknabqwq.supabase.co/functions/v1/hafsa-ai';

// Read anon key from supabaseClient.js
const fs = require('fs');
const clientFile = fs.readFileSync('./supabaseClient.js', 'utf8');
const anonKeyMatch = clientFile.match(/supabaseAnonKey\s*=\s*'([^']+)'/);
const ANON_KEY = anonKeyMatch ? anonKeyMatch[1] : null;

if (!ANON_KEY) {
  console.log('❌ Could not read anon key from supabaseClient.js');
  process.exit(1);
}

const SYSTEM = `তুমি হাফসা আপা — বাংলাদেশি মা ও শিশুর AI সহায়ক। বাংলায় উত্তর দাও। সংক্ষিপ্ত রাখো (২-৪ বাক্য)। শিশুর নাম: রিফাত, বয়স: ৪ মাস ৫ দিন। মায়ের নাম: রহিমা, সিজার হয়েছে।

স্পষ্টতা নিয়ম: কোনো রোগের কথা শুনলে আগে জিজ্ঞেস করো কার হয়েছে। প্যানিক করো না। মা চিন্তিত হলে আশ্বাস দাও।`;

const TEST_CASES = [
  // EMPATHY tests
  { msg: "আমি খুব ক্লান্ত, কিছু ভালো লাগছে না", expect: "empathy", fail_if: ["ডাক্তার", "হাসপাতাল"] },
  { msg: "আজ খুব কষ্ট হচ্ছে একা সামলাতে", expect: "empathy+support", fail_if: [] },
  
  // CLARIFICATION tests (should NOT panic)
  { msg: "শবার হাম হচ্ছে। চিন্তায় আসি", expect: "ask_clarification", fail_if: ["ও আল্লাহ", "জরুরি", "এখনই"] },
  { msg: "বাচ্চার মাথা গরম লাগছে", expect: "ask_details", fail_if: ["এখনই হাসপাতাল", "জরুরি ভিত্তিতে"] },
  { msg: "পাড়ায় ডায়রিয়া ছড়াচ্ছে", expect: "ask_if_baby_affected", fail_if: ["ও আল্লাহ"] },
  
  // KNOWLEDGE tests
  { msg: "পরের টিকা কবে?", expect: "vaccine_info", fail_if: [] },
  { msg: "বাচ্চা কি এখন শক্ত খাবার খেতে পারবে?", expect: "age_appropriate", fail_if: [] },
  { msg: "শাশুড়ি বলছে মধু দিতে, দেব কি?", expect: "medical_correct", fail_if: ["দিতে পারেন", "হ্যাঁ দিন"] },
  
  // AUTO-LOG simulation (just testing AI response, not actual logging)
  { msg: "এইমাত্র দুধ দিলাম", expect: "acknowledge_feed", fail_if: [] },
  { msg: "তিনবার খাইসে", expect: "ask_milk_or_food", fail_if: [] },
  
  // CULTURAL tests
  { msg: "সবাই বলে বাচ্চাকে চুমু দিলে নজর লাগে", expect: "respectful_cultural", fail_if: ["বোকা", "ভুল", "মিথ্যা"] },
  { msg: "নানি বলছে কালোজিরা তেল দিতে", expect: "balanced_advice", fail_if: [] },
  
  // MOTHER HEALTH tests
  { msg: "সিজারের জায়গা লাল হয়ে গেছে", expect: "medical_concern", fail_if: [] },
  { msg: "আমি সারারাত ঘুমাতে পারি না", expect: "sleep_support", fail_if: [] },
  
  // EMOTIONAL INTELLIGENCE tests
  { msg: "বাচ্চা সারারাত কান্না করে, আমি পাগল হয়ে যাচ্ছি", expect: "empathy_first", fail_if: ["পাগল", "মানসিক রোগ"] },
  { msg: "আমি ভালো মা না", expect: "strong_reassurance", fail_if: ["ঠিক বলেছেন", "হ্যাঁ"] },
  
  // EDGE CASES
  { msg: "হ্যালো", expect: "greeting", fail_if: [] },
  { msg: "ধন্যবাদ", expect: "warm_close", fail_if: [] },
  { msg: "a", expect: "ask_clarification", fail_if: [] },
  { msg: "বাচ্চা খায় না", expect: "ask_details_not_panic", fail_if: ["হাসপাতাল", "জরুরি"] },
];

async function runTest(testCase, index) {
  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: testCase.msg }],
        system: SYSTEM,
        max_tokens: 300,
        stream: false,
      }),
    });

    const data = await response.json();
    const reply = data?.content?.[0]?.text || '';
    
    // Check if response is in Bengali (has Bengali unicode chars)
    const isBengali = /[\u0980-\u09FF]/.test(reply);
    
    // Check for fail conditions
    const failWords = testCase.fail_if.filter(w => reply.includes(w));
    const hasFail = failWords.length > 0;
    
    // Check response length (should be 2-10 sentences, not too long)
    const sentenceCount = reply.split(/[।!?]/).filter(s => s.trim()).length;
    const tooLong = sentenceCount > 15;
    
    const status = isBengali && !hasFail && !tooLong ? '✅' : '❌';
    
    console.log(`${status} Test ${index + 1}: "${testCase.msg.substring(0, 40)}..."`);
    console.log(`   Expected: ${testCase.expect}`);
    if (!isBengali) console.log(`   ❌ NOT BENGALI`);
    if (hasFail) console.log(`   ❌ Contains bad words: ${failWords.join(', ')}`);
    if (tooLong) console.log(`   ⚠️ Too long: ${sentenceCount} sentences`);
    console.log(`   Reply: ${reply.substring(0, 120)}...`);
    console.log('');
    
    return { pass: isBengali && !hasFail && !tooLong, index, reply };
  } catch (e) {
    console.log(`❌ Test ${index + 1}: NETWORK ERROR — ${e.message}`);
    return { pass: false, index, error: e.message };
  }
}

async function main() {
  console.log('🧪 HAFSA AI TEST SUITE');
  console.log('=' .repeat(60));
  console.log(`Running ${TEST_CASES.length} tests against Edge Function...`);
  console.log('');

  const results = [];
  for (let i = 0; i < TEST_CASES.length; i++) {
    const result = await runTest(TEST_CASES[i], i);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('=' .repeat(60));
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`RESULTS: ${passed}/${TEST_CASES.length} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  - Test ${r.index + 1}: ${TEST_CASES[r.index].msg.substring(0, 50)}`);
    });
  }
  
  console.log('\n✅ = Bengali response, no panic words, reasonable length');
  console.log('❌ = Non-Bengali, contains panic words, or too long');
}

main().catch(console.error);
