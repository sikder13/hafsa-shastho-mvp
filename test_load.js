const fs = require('fs');
const clientFile = fs.readFileSync('./supabaseClient.js', 'utf8');
const anonKeyMatch = clientFile.match(/supabaseAnonKey\s*=\s*'([^']+)'/);
const ANON_KEY = anonKeyMatch[1];
const EDGE_URL = 'https://unnmjrrpqftpcknabqwq.supabase.co/functions/v1/hafsa-ai';

const MESSAGES = [
  "দুধ দিলাম",
  "বাচ্চা কেমন আছে?",
  "আমি ক্লান্ত",
  "পরের টিকা কবে?",
  "ঘুম হচ্ছে না",
  "শিশুর ওজন কি ঠিক আছে?",
  "হ্যালো",
  "বাচ্চা কান্না করছে",
  "সিজারের ব্যথা কমছে না",
  "দুধ কম হচ্ছে",
];

async function sendRequest(id) {
  const start = Date.now();
  const msg = MESSAGES[id % MESSAGES.length];
  
  try {
    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: msg }],
        system: 'তুমি হাফসা আপা। বাংলায় ২ বাক্যে উত্তর দাও।',
        max_tokens: 100,
        stream: false,
      }),
    });

    const data = await response.json();
    const elapsed = Date.now() - start;
    const hasReply = data?.content?.[0]?.text?.length > 0;
    const isBengali = /[\u0980-\u09FF]/.test(data?.content?.[0]?.text || '');
    
    return { id, status: response.status, elapsed, hasReply, isBengali, error: null };
  } catch (e) {
    return { id, status: 0, elapsed: Date.now() - start, hasReply: false, isBengali: false, error: e.message };
  }
}

async function runLoadTest(concurrency, label) {
  console.log(`\n🔥 ${label}: ${concurrency} concurrent requests`);
  console.log('-'.repeat(50));
  
  const start = Date.now();
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(sendRequest(i));
  }
  
  const results = await Promise.all(promises);
  const totalTime = Date.now() - start;
  
  const succeeded = results.filter(r => r.status === 200 && r.hasReply && r.isBengali);
  const failed = results.filter(r => r.status !== 200 || !r.hasReply);
  const times = results.filter(r => r.elapsed).map(r => r.elapsed);
  const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  console.log(`✅ Succeeded: ${succeeded.length}/${concurrency}`);
  console.log(`❌ Failed: ${failed.length}/${concurrency}`);
  console.log(`⏱️  Avg response: ${avgTime}ms | Min: ${minTime}ms | Max: ${maxTime}ms`);
  console.log(`⏱️  Total batch time: ${totalTime}ms`);
  
  if (failed.length > 0) {
    console.log(`\nFailed details:`);
    failed.forEach(r => {
      console.log(`  Request ${r.id}: status=${r.status}, error=${r.error || 'no reply'}`);
    });
  }
  
  return { concurrency, succeeded: succeeded.length, failed: failed.length, avgTime, maxTime, totalTime };
}

async function main() {
  console.log('🧪 HAFSA EDGE FUNCTION LOAD TEST');
  console.log('='.repeat(50));
  console.log('Testing concurrent request handling...');
  
  // Round 1: 5 simultaneous (warm up)
  const r1 = await runLoadTest(5, 'Round 1 (warm-up)');
  
  // Small delay between rounds
  await new Promise(r => setTimeout(r, 3000));
  
  // Round 2: 10 simultaneous
  const r2 = await runLoadTest(10, 'Round 2');
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Round 3: 20 simultaneous
  const r3 = await runLoadTest(20, 'Round 3');
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Round 4: 50 simultaneous (stress test)
  const r4 = await runLoadTest(50, 'Round 4 (STRESS)');
  
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY:');
  console.log(`  5 concurrent:  ${r1.succeeded}/5 passed, avg ${r1.avgTime}ms`);
  console.log(`  10 concurrent: ${r2.succeeded}/10 passed, avg ${r2.avgTime}ms`);
  console.log(`  20 concurrent: ${r3.succeeded}/20 passed, avg ${r3.avgTime}ms`);
  console.log(`  50 concurrent: ${r4.succeeded}/50 passed, avg ${r4.avgTime}ms`);
  
  const totalRequests = 5 + 10 + 20 + 50;
  const totalPassed = r1.succeeded + r2.succeeded + r3.succeeded + r4.succeeded;
  console.log(`\n  TOTAL: ${totalPassed}/${totalRequests} requests succeeded`);
  
  if (totalPassed === totalRequests) {
    console.log('  🎉 ALL PASSED — Edge Function handles 50 concurrent users!');
  } else {
    console.log('  ⚠️  Some failures — check Anthropic rate limits or Edge Function logs');
  }
}

main().catch(console.error);
