// services/hafsaPrompt.js
// Hafsa Aapa's system prompt — compressed for speed, full context awareness
// Target: <500 tokens for identity+rules, dynamic context adds ~200-300 more

import { toBengaliNumber } from '../utils/helpers';

// ============================================================
// MAIN ENTRY
// ============================================================

export function buildHafsaPrompt(context = {}) {
  if (context.babyName !== undefined && context.baby === undefined) {
    return buildHafsaPromptLegacy(context);
  }

  const { baby, mother, vaccine, growth } = context;

  const parts = [
    IDENTITY_PROMPT,
    buildDataSection(baby, mother, vaccine, growth),
    RULES_PROMPT
  ];

  return parts.filter(Boolean).join('\n\n');
}

// ============================================================
// MODULE 1: IDENTITY (fixed text, ~120 tokens)
// ============================================================

const IDENTITY_PROMPT = `তুমি হাফসা আপা — বাংলাদেশি মা ও শিশুর যত্নে অভিজ্ঞ, স্নেহময় বড় বোন। তুমি ডাক্তার নও কিন্তু WHO গাইডলাইন ও BD শিশু যত্নে গভীর জ্ঞান রাখো।

নিয়ম: সবসময় বাংলায় কথা বলো। "আপনি" ব্যবহার করো। সংক্ষিপ্ত উত্তর দাও (২-৪ বাক্য)। আগে অনুভূতি বোঝো, তারপর পরামর্শ। কখনো বিচার করো না। "আলহামদুলিল্লাহ" ভালো খবরে, "ইনশাআল্লাহ" আশায়। 💚 মাঝে মাঝে।`;

// ============================================================
// MODULE 2: DYNAMIC DATA (built from context)
// ============================================================

function buildDataSection(baby, mother, vaccine, growth) {
  const lines = ['# তথ্য'];

  // Baby
  if (baby) {
    const parts = [`শিশু: ${baby.name}, ${baby.bengaliAge}, ${baby.gender === 'male' ? 'ছেলে' : 'মেয়ে'}`];

    const todayItems = [];
    if (baby.today.feed > 0) todayItems.push(`দুধ ${toBengaliNumber(baby.today.feed)}`);
    if (baby.today.sleep > 0) todayItems.push(`ঘুম ${toBengaliNumber(baby.today.sleep)}`);
    if (baby.today.diaper > 0) todayItems.push(`ডায়াপার ${toBengaliNumber(baby.today.diaper)}`);
    if (baby.today.food > 0) todayItems.push(`খাবার ${toBengaliNumber(baby.today.food)}`);

    if (todayItems.length > 0) parts.push(`আজ: ${todayItems.join(', ')}`);

    if (baby.lastFeedMinutesAgo !== null) {
      const h = Math.floor(baby.lastFeedMinutesAgo / 60);
      const m = baby.lastFeedMinutesAgo % 60;
      parts.push(`শেষ দুধ: ${h > 0 ? toBengaliNumber(h) + 'ঘ ' : ''}${m > 0 ? toBengaliNumber(m) + 'মি' : ''} আগে`);
    }

    if (baby.expectedFeeds) parts.push(`স্বাভাবিক: দুধ ${baby.expectedFeeds}, ঘুম ${baby.expectedSleepHours}`);
    if (baby.solidFoodReady) parts.push('৬মাস+ — শক্ত খাবার শুরু করার সময়');

    lines.push(parts.join('. '));
  }

  // Mother
  if (mother) {
    const mParts = [`মা: ${mother.name}, ${mother.isCsection ? 'সিজার' : 'নরমাল'}, দিন ${toBengaliNumber(mother.postpartumDays)}, সুস্থতা ${toBengaliNumber(mother.recovery.percentComplete)}%`];

    if (mother.today.checkedIn) {
      const items = [];
      if (mother.today.mood) items.push(`মন: ${getMood(mother.today.mood)}`);
      if (mother.today.bleeding && mother.today.bleeding !== 'none') items.push(`রক্তপাত: ${getBleeding(mother.today.bleeding)}`);
      if (mother.today.pain && mother.today.pain !== 'none') items.push(`ব্যথা: ${getPain(mother.today.pain)}`);
      if (mother.today.sleepHours) items.push(`ঘুম: ${mother.today.sleepHours}ঘ`);
      if (mother.today.waterIntake > 0) items.push(`পানি: ${toBengaliNumber(mother.today.waterIntake)}/৮`);
      if (mother.today.hadHelp === false) items.push('একা সামলাচ্ছে');
      if (items.length > 0) mParts.push(`আজ: ${items.join(', ')}`);
    }

    // Critical patterns
    if (mother.moodPattern?.consecutiveSadDays >= 3) {
      mParts.push(`⚠ ${toBengaliNumber(mother.moodPattern.consecutiveSadDays)} দিন ধরে বিষন্ন`);
    }
    if (mother.sleepPattern?.avgHours !== null && mother.sleepPattern.avgHours < 4) {
      mParts.push(`⚠ গড় ঘুম ${toBengaliNumber(mother.sleepPattern.avgHours)}ঘ/রাত`);
    }
    if (mother.supportPattern?.consecutiveNoHelpDays >= 3) {
      mParts.push(`⚠ ${toBengaliNumber(mother.supportPattern.consecutiveNoHelpDays)} দিন সাহায্য পায়নি`);
    }
    if (mother.epds) {
      mParts.push(`EPDS: ${toBengaliNumber(mother.epds.score)}/৩০`);
    }

    lines.push(mParts.join('. '));

    // Flags — urgent directives
    if (mother.flags?.length > 0) {
      const flagLines = [];
      if (mother.flags.includes('heavy_bleeding')) flagLines.push('রক্তপাত বেশি — ডাক্তার দেখাতে বলো');
      if (mother.flags.includes('prolonged_sadness')) flagLines.push('দীর্ঘ বিষন্নতা — সংবেদনশীলভাবে জিজ্ঞেস করো');
      if (mother.flags.includes('critical_sleep_deprivation')) flagLines.push('ঘুম বিপজ্জনক কম — সাহায্য নিতে বলো');
      if (mother.flags.includes('self_harm_concern')) flagLines.push('🆘 হেল্পলাইন: ০১৭৭৯-৫৫৪৫৫');
      if (mother.flags.includes('csection_worsening')) flagLines.push('সেলাই খারাপ — ডাক্তার দেখাতে বলো');
      if (flagLines.length > 0) lines.push('⚠ সতর্কতা: ' + flagLines.join('; '));
    }
  }

  // Vaccine
  if (vaccine) {
    if (vaccine.upcoming?.length > 0) {
      lines.push(`টিকা: ${vaccine.upcoming.map(v => v.name + ' (' + toBengaliNumber(v.daysUntil) + ' দিনে)').join(', ')} আসছে`);
    }
    if (vaccine.hasPostVaccineCare) {
      lines.push(`সম্প্রতি ${vaccine.recentlyCompleted[0].name} টিকা নিয়েছে`);
    }
    if (vaccine.overdue?.length > 0) {
      lines.push(`⚠ মিসড টিকা: ${vaccine.overdue.map(v => v.name).join(', ')}`);
    }
  }

  // Growth
  if (growth?.hasMeasurements && growth.latest) {
    const gParts = [`ওজন: ${growth.latest.weight}kg`];
    if (growth.velocityGramsPerMonth !== null) {
      gParts.push(`বৃদ্ধি: ${toBengaliNumber(growth.velocityGramsPerMonth)}g/মাস${growth.isGoodVelocity === false ? ' ⚠ কম' : ''}`);
    }
    lines.push(gParts.join(', '));
  }

  return lines.length > 1 ? lines.join('\n') : null;
}

// ============================================================
// MODULE 3: RULES (fixed text, ~180 tokens)
// ============================================================

const RULES_PROMPT = `# নিয়ম
🔴 জরুরি (এখনই ডাক্তার): জ্বর>১০৩°F, ৩মাসের কমে যেকোনো জ্বর, শ্বাসকষ্ট, ঠোঁট নীল, ১২ঘ+ না খাওয়া, খিঁচুনি, অজ্ঞান
🟡 পর্যবেক্ষণ: জ্বর ১০১-১০২, হালকা বমি, অস্বাভাবিক কান্না — ২৪-৪৮ঘ দেখো
মায়ের জরুরি: ১ঘন্টায় প্যাড ভিজে=ডাক্তার, সেলাই+জ্বর/পুঁজ=ডাক্তার, ৫+দিন বিষন্ন=কাউকে বলুন

কখনো করবে না: রোগ নির্ণয় ("এটি X রোগ"), ওষুধ ডোজ, "১০০% ঠিক হবে" গ্যারান্টি

কৌশল: প্রথমে অনুভূতি বোঝো → ডেটা দিয়ে কথা বলো → পরামর্শ → কখন ডাক্তার

এক্টিভিটি: ইউজার দুধ/ঘুম/ডায়াপার/খাবারের কথা বললে স্বাভাবিকভাবে সাড়া দাও। "লগ করলাম" বলবে না।

সংস্কৃতি: শাশুড়ির কথা সম্মান করো কিন্তু WHO তথ্য জানাও। "দুধ কম" ভয় — ডেটা দিয়ে আশ্বস্ত করো।`;

// ============================================================
// OPENING MESSAGE
// ============================================================

export function buildOpeningMessage(context = {}) {
  const { baby, mother, vaccine } = context;
  if (!baby) return 'আসসালামু আলাইকুম! আমি হাফসা আপা। কিভাবে সাহায্য করতে পারি? 💚';

  const motherName = mother?.name || '';
  const greeting = getTimeGreeting();
  const parts = [];

  parts.push(motherName ? `${greeting} ${motherName}!` : `${greeting}!`);

  // Pick ONE context-aware addition
  if (mother?.flags?.includes('self_harm_concern')) {
    parts.push('আপনি কেমন আছেন? কথা বলতে চাইলে আমি শুনছি। 💚');
  } else if (vaccine?.upcoming?.length > 0 && vaccine.upcoming[0].daysUntil <= 2) {
    parts.push(`${baby.name} এর ${vaccine.upcoming[0].name} টিকার সময়! প্রস্তুতি নিয়ে জানতে চাইলে বলুন।`);
  } else if (vaccine?.hasPostVaccineCare) {
    parts.push(`${baby.name} সম্প্রতি টিকা নিয়েছে। কোনো সমস্যা হলে জানান।`);
  } else if (mother?.today?.mood === 'sad' || mother?.today?.mood === 'bad') {
    parts.push('আজ মন ভালো নেই দেখলাম। কিছু বলতে চাইলে শুনছি। 💚');
  } else if (baby.lastFeedMinutesAgo && baby.lastFeedMinutesAgo > 300) {
    parts.push(`${baby.name} এর দুধ খাওয়ার ${toBengaliNumber(Math.round(baby.lastFeedMinutesAgo / 60))} ঘন্টা হয়েছে। সব ঠিক?`);
  } else {
    parts.push(`${baby.name} নিয়ে যেকোনো প্রশ্ন করুন। 💚`);
  }

  return parts.join(' ');
}

// ============================================================
// EMERGENCY DETECTION
// ============================================================

export function detectEmergency(message) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return EMERGENCY_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

const EMERGENCY_PATTERNS = [
  'নিঃশ্বাস নিতে পারছে না', 'শ্বাস নিতে পারছে না', 'শ্বাসকষ্ট',
  'নীল হয়ে গেছে', 'নীল হয়ে যাচ্ছে', 'অজ্ঞান', 'জ্ঞান হারিয়েছে',
  'খিঁচুনি', 'ফিট হচ্ছে', 'রক্ত বমি', 'রক্ত পায়খানা',
  'একদম নড়ছে না', 'একদম খাচ্ছে না', 'সারাদিন খাচ্ছে না',
  'খুব বেশি জ্বর', 'জ্বর কমছে না', '১০৪', '১০৫'
];

// ============================================================
// LEGACY SUPPORT
// ============================================================

function buildHafsaPromptLegacy(babyContext = {}) {
  const ctx = {
    baby: {
      name: babyContext.babyName || 'শিশু',
      bengaliAge: babyContext.babyAge || 'নতুন',
      gender: null, ageDays: 0, ageMonths: 0,
      today: {
        feed: babyContext.recentLogs?.feed || 0,
        sleep: babyContext.recentLogs?.sleep || 0,
        diaper: babyContext.recentLogs?.diaper || 0,
        food: babyContext.recentLogs?.food || 0
      },
      lastFeedMinutesAgo: null, expectedFeeds: '', expectedSleepHours: '',
      solidFoodReady: false
    },
    mother: null,
    vaccine: {
      upcoming: (babyContext.upcomingVaccines || []).map(n => ({ name: n, daysUntil: 0 })),
      recentlyCompleted: (babyContext.recentVaccines || []).map(n => ({ name: n })),
      overdue: [],
      hasPostVaccineCare: (babyContext.recentVaccines || []).length > 0
    },
    growth: babyContext.latestGrowth ? { hasMeasurements: true, latest: babyContext.latestGrowth, velocityGramsPerMonth: null, isGoodVelocity: null } : { hasMeasurements: false }
  };
  return buildHafsaPrompt(ctx);
}

// ============================================================
// HELPERS
// ============================================================

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'সুপ্রভাত';
  if (h < 17) return 'আসসালামু আলাইকুম';
  return 'শুভ সন্ধ্যা';
}

function getMood(m) { return { happy: 'খুশি', okay: 'ঠিক আছে', sad: 'বিষন্ন', bad: 'খারাপ' }[m] || m; }
function getBleeding(b) { return { none: 'নেই', light: 'হালকা', moderate: 'মাঝারি', heavy: 'বেশি' }[b] || b; }
function getPain(p) { return { none: 'নেই', low: 'হালকা', medium: 'মাঝারি', high: 'তীব্র' }[p] || p; }