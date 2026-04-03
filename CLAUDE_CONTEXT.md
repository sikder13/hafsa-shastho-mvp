# HAFSA SHASTHO MVP 2.0 — Complete Project Context for Claude Code

> **READ THIS ENTIRE FILE before making ANY changes to the codebase.**
> This document captures the full development history, every architectural decision, every pivot, every bug fix, and every strategic choice made across 10+ development sessions spanning March–April 2026.

---

## 1. WHAT IS THIS PROJECT?

**Hafsa Shastho** (হাফসা স্বাস্থ্য) is Bangladesh's first AI-powered maternal and infant health app. It tracks BOTH mother's postpartum health AND baby's health in Bengali. The AI companion "Hafsa Aapa" (হাফসা আপা) is a caring elder sister who knows everything about the specific mother and baby.

**Parent Company:** Nahl Technologies Inc. based in Indiana, USA
**Founder:** Udaay Sikder (solo developer, based in Indiana, USA), Mohieminul Islam Khan (Co-founder, based in Indiana, USA)
**Target Users:** Bangladeshi mothers (0–24 months postpartum)
**Market:** 4M annual births in Bangladesh, ZERO Bengali postpartum apps exist
**Competitor:** ToguMogu (200K users, e-commerce platform that added parenting — they completely ignore mother's health)

---

## 2. PROJECT ORIGIN STORY & PIVOTS

### Pre-March 2026: Initial Build (in another Claude conversation)
- Original MVP was built using Cursor with Claude-generated prompts
- Had basic screens: HomeScreen, DailyLogScreen, VaccineScreen, GrowthScreen, BabyProfileScreen, AuthScreen
- ChatTestScreen was referenced but MISSING from codebase (would crash if opened)
- No mother health tracking at all
- No AI context awareness
- No global state management (each screen loaded data independently)
- Mock user ID hardcoded — auth not connected
- WHO growth data was boys only, missing months 7,8,10,11

### March 1–3, 2026: Codebase Upload & Analysis
- ZIP uploaded to Claude for full codebase review
- Complete feature walkthrough document generated (14-page Feature Specification)
- Original 11-phase build plan created (65–70 hours estimated)
- Identified missing ChatTestScreen as crash risk

### March 4, 2026: CRITICAL SECURITY INCIDENT
- **Found `.env` file with ANTHROPIC_API_KEY was committed to GitHub** — the `.gitignore` had a typo (`*.tar.gz.env` instead of `.env` on its own line)
- API key was exposed publicly on GitHub
- **Fix:** Rotated API key immediately, fixed `.gitignore`, force-pushed clean history
- Also found GitHub personal access token was exposed
- This incident led to strict security-first approach for all subsequent development

### March 4, 2026: Master Build Blueprint
- Created comprehensive 8-section architecture document (docx)
- Established shared utilities pattern (helpers.js, constants.js)
- Created AppContext.js as global state provider
- Built foundation for all subsequent phases

### March 5, 2026: Phase 3 (Mother Postpartum Tracker) Built
- MotherCheckInScreen with 3-step flow (mood/physical → wellbeing → Hafsa response)
- Edinburgh Postnatal Depression Scale (EPDS) — full 10-question clinical screening
- This is the app's core differentiating feature

### March 9, 2026: MAJOR PIVOT — AI Chat Overhaul (Phase 5 moved before Phase 4)
- **Decision: Build AI Chat before Navigation** because chat was the most complex and risky feature
- Built complete chat system:
  - `services/contextBuilder.js` — gathers ALL data for AI context
  - `services/hafsaPrompt.js` — orchestrator that builds system prompt with pre-computed assessments
  - `services/claudeAPI.js` — rewritten with XHR streaming (not fetch, because React Native)
  - `services/autoLogger.js` — 2-tier Bengali activity detection (200+ patterns)
  - 2-tier detection: Tier 1 (30 root words) → Tier 2 (verb conjugation fallback)
  - Exclusion rules to prevent false positives (questions, negations, future tense)
  - Midnight reset fix for daily log counters

### March 11, 2026: MAJOR PIVOT — Expert Review & Architecture Redesign
- **Competitive analysis vs ToguMogu** — determined Hafsa's advantage is deep health intelligence, not breadth
- **Expert review rated the architecture 10/10** after the redesign
- **Key insight: "ToguMogu completely ignores the mother"** — this is our biggest opportunity

#### The Hybrid AI Pattern (established here, NON-NEGOTIABLE):
```
User data → Rules Engine (JavaScript, deterministic) → Pre-computed assessment
→ Assessment passed to Claude → Claude wraps in empathetic Bengali → Response
```
- **The LLM NEVER decides medical assessments. Only the Rules Engine does.**
- This prevents hallucinated medical advice that could harm babies

#### Intelligence Service Architecture (Phase 1 rebuild):
- 8 files in `services/rules/`: dateUtils, feedRules, motherRules, growthRules, vaccineRules, crossRules, milestoneRules
- Main brain: `services/intelligenceService.js` with 11 exported functions
- All rules return STRUCTURED DATA, never Bengali text
- dayjs used for all date operations (timezone-safe)

#### Screen Refactoring (Phase 2 rebuild):
- All 5 screens connected to Intelligence Service
- HomeScreen: getHomeInsights(), alerts, milestones, 14 age-specific daily tips
- DailyLogScreen: getLogFeedback() contextual cards
- ChatScreen: getAIContext() replaces old contextBuilder
- MotherCheckInScreen: getCheckInAssessment() with emotional contradiction detection
- GrowthScreen: getGrowthInsight() post-measurement feedback

### March 11, 2026: Strategic Business Decisions
- **Pricing discussion:** Free for first 3 months, then ৳49/month via bKash/Nagad web link
- **No in-app ads in chat or check-in** (ever) — minimal ads only on HomeScreen post-beta
- **Data is the moat** — Bengali maternal health dataset for RLHF training
- **Flo Health comparison:** They have 380M users, $1B+ valuation, started exactly like us
- **BabyTree (China) raised $650M** for similar parenting app
- **UNICEF, WHO, BRAC** would pay for our anonymized behavioral data
- **Future vision:** Bengali LLM fine-tuned on our RLHF data → Hindi → Urdu → Bahasa (300M+ users across South/Southeast Asia)

### March 11, 2026: Revised 7-Phase Build Plan (replaced original 11-phase)
The expert review completely restructured the build order:
1. Intelligence Service (brain first) ✅
2. Screen Refactoring (screens become renderers) ✅
3. Voice + RLHF ✅
4. Supabase Backend ✅
5. Notifications + Milestones + Sharing ⬜
6. Analytics + Error Handling + Polish ⬜
7. Testing + Beta Build ⬜

### March 14–18, 2026: Phase 4 — Supabase Backend (largest phase)
- 12 Supabase tables created with RLS + indexes
- `services/supabaseService.js` — all sync operations
- Mandatory login (Option B chosen over Optional login Option A)
- Email/password auth for testing (phone OTP needs Twilio Message Service SID)
- Session persistence via AsyncStorage adapter
- Cloud hydration on login (hydrateFromSupabase)
- Offline sync queue with retry (up to 5 attempts)
- Logout preserves cloud data, account deletion CASCADE deletes everything
- **7 database gaps identified and fixed:**
  1. All syncs verified across all tables
  2. RLHF feedback syncs to ai_interactions
  3. EPDS syncs to epds_assessments
  4. Growth records sync
  5. chat_history table created + messages sync
  6. Analytics queries verified (5 of 5 ran successfully)
  7. Division/district added to onboarding (8 divisions, 64 districts, BD diaspora)

### Key Bugs Fixed Along the Way:
- vaccine_records had NOT NULL constraint on age_days — changed to nullable
- vaccine_records needed unique constraint on (baby_id, vaccine_name) for upsert
- VaccineScreen didn't update AppContext — HomeScreen showed stale vaccine data
- HomeScreen showed raw "weight_below_p15" key instead of Bengali text
- RLHF feedback saved to AsyncStorage but didn't update Supabase ai_interactions row
- syncFeedbackToCloud added to MessageBubble.js to complete the training pipeline

---

## 3. TECH STACK

| Layer | Technology |
|---|---|
| Frontend | React Native (Expo 54), React Navigation v7 |
| Local Storage | AsyncStorage (offline-first, primary) |
| Cloud Backend | Supabase (PostgreSQL, RLS, Auth) |
| AI | Claude Sonnet 4 API (streaming via XHR, NOT fetch) |
| Date Library | dayjs (timezone-safe, required for all date ops) |
| Voice | expo-speech-recognition (Bengali bn-BD STT) |
| Build | EAS (Expo Application Services) for cloud builds |
| Dev Environment | Linux (Ubuntu), testing via Expo Go on physical iPhone |
| IDE | Cursor with Claude Code |

---

## 4. FILE STRUCTURE (Current State)

```
hafsa-shastho-mvp/
├── App.js                          # Root: Auth check → Onboarding → TabNavigator
├── supabaseClient.js               # Supabase client with AsyncStorage session persistence
├── .env                            # ANTHROPIC_API_KEY (NEVER commit to git)
│
├── context/
│   └── AppContext.js                # Global state, all screens read/write here
│                                    # Every write triggers Supabase background sync
│
├── components/
│   └── MessageBubble.js             # Chat bubble with RLHF thumbs up/down + Supabase sync
│
├── services/
│   ├── intelligenceService.js       # Main brain — 11 exported functions
│   ├── claudeAPI.js                 # ONLY file that talks to Claude API (streaming + fallback)
│   ├── hafsaPrompt.js               # System prompt builder with pre-computed assessments
│   ├── contextBuilder.js            # Gathers all data for AI context
│   ├── autoLogger.js                # 2-tier Bengali activity detection (200+ patterns)
│   ├── supabaseService.js           # ALL Supabase operations (sync, hydration, queue)
│   ├── voiceService.js              # Bengali STT (expo-speech-recognition, safe Expo Go fallback)
│   └── rules/
│       ├── dateUtils.js             # Timezone-safe date ops using dayjs
│       ├── feedRules.js             # Feed adequacy, timing, trends, dehydration risk
│       ├── motherRules.js           # Mood patterns, sleep, bleeding, recovery, EPDS
│       ├── growthRules.js           # WHO percentile, velocity, predictions
│       ├── vaccineRules.js          # Due/overdue detection, post-vaccine care
│       ├── crossRules.js            # Mother+Baby cross-connections (7 rules)
│       └── milestoneRules.js        # Age, weight, streak, vaccine milestones
│
├── screens/
│   ├── AuthScreen.js                # Email/password auth (phone OTP pending Twilio)
│   ├── OnboardingScreen.js          # 5-step: Welcome → Baby → Mother → Location → Done
│   ├── HomeScreen.js                # Dashboard: greeting, alerts, milestones, daily tips
│   ├── BabyHubScreen.js             # Baby feature grid → DailyLog, Vaccine, Growth
│   ├── BabyProfileScreen.js         # Baby profile display
│   ├── DailyLogScreen.js            # Feed/sleep/diaper/food one-tap logging
│   ├── VaccineScreen.js             # 18-vaccine EPI schedule + 50+ center finder
│   ├── GrowthScreen.js              # WHO percentile chart (boys + girls, 0-24 months)
│   ├── MotherCheckInScreen.js       # 3-step postpartum check-in
│   ├── EdinburghScaleScreen.js      # Full 10-question EPDS clinical screening
│   ├── ChatScreen.js                # AI chat with streaming, auto-logging, RLHF
│   └── SettingsScreen.js            # Profile edit, logout, delete account (subtle)
│
├── navigation/
│   ├── TabNavigator.js              # Bottom tabs: হোম, শিশু, মা, হাফসা
│   ├── HomeStack.js
│   ├── BabyStack.js
│   └── MotherStack.js
│
├── data/
│   ├── bdEPISchedule.js             # 18 vaccines Bangladesh EPI schedule
│   ├── bdLocations.js               # 8 divisions, 64 districts, BD abroad options
│   ├── epiCenters.js                # 50+ Dhaka EPI centers with GPS
│   └── whoGrowthStandards.js        # Boys + girls, months 0-24, p3/p15/p50/p85/p97
│
└── utils/
    ├── helpers.js                   # toBengaliNumber, calculateAge, formatDate, etc.
    └── constants.js                 # COLORS, STORAGE_KEYS, TEXT constants
```

---

## 5. SUPABASE DATABASE (12 tables + chat_history, all with RLS)

| Table | Rows (as of March 18) | Purpose |
|---|---|---|
| profiles | 1 | Mother profile, division/district |
| babies | 1 | Baby profile |
| daily_logs | 8+ | Feed/sleep/diaper/food logs |
| mother_daily_logs | 2+ | Postpartum check-in data |
| growth_records | 1+ | Weight/height measurements |
| vaccine_records | 4+ | EPI vaccine completion |
| ai_interactions | 1+ | RLHF: user message + Hafsa response + feedback |
| ai_usage | — | Daily query counts for rate limiting |
| epds_assessments | 1+ | Edinburgh Depression Scale scores |
| subscriptions | 1 | Tier, trial dates |
| user_consents | 3+ | PDPO 2025 consent versioning |
| chat_history | 2+ | Conversation backup for cloud restore |

**Key schema details:**
- vaccine_records has unique constraint on (baby_id, vaccine_name) for upsert
- vaccine_records.age_days is nullable (was NOT NULL, caused sync failures)
- All tables have user_id with RLS policy: `(select auth.uid()) = user_id`
- Denormalized columns: baby_age_days, postpartum_day on log rows for analytics

---

## 6. CRITICAL ARCHITECTURAL DECISIONS (Do Not Change)

### [DECISION] Hybrid AI Pattern (NON-NEGOTIABLE)
Rules Engine decides medical assessments → Claude only communicates in Bengali.
LLM never does medical reasoning. See `services/rules/` for all rules.

### [DECISION] Offline-First
AsyncStorage is primary, Supabase syncs in background. Failed syncs queued (5 retries).
App works fully without internet.

### [DECISION] Mandatory Login (Option B)
Auth required before app use. Data safety > friction. Chosen over "optional login."

### [DECISION] No GPS Tracking
Division/district dropdown only (data/bdLocations.js). No cross-app data collection.
Privacy-first approach — culturally appropriate for Bangladesh.

### [DECISION] Data Moat Strategy
RLHF from day one. Every AI interaction stored with thumbs up/down feedback.
This dataset trains a future Bengali maternal health LLM.

### [DECISION] Delete Account Required (App Store Rule 5.1.1v)
Must exist for Apple approval. Styled as subtle gray underlined text at bottom of Settings.
Double confirmation with warm retention message. CASCADE delete removes all data.

### [DECISION] LLM-Agnostic Design
Claude is accessed ONLY through `services/claudeAPI.js`. No other file imports Claude.
To swap LLM providers: change API URL and model in one file.

### [DECISION] Bengali Auto-Detection (2-Tier)
`autoLogger.js` uses Tier 1 (30 root words with activity type) → Tier 2 (verb conjugation fallback).
Exclusion rules prevent false positives for questions, negations, future tense.
200+ patterns cover Standard Bengali + Sylheti, Chittagonian, Barisali, Rangpuri dialects.

### [DECISION] Free for 0-10K Users
No subscription for first 3 months. Then ৳49/month ($0.45) via bKash/Nagad web link.
No in-app ads in chat or check-in screens (ever). Minimal ads on HomeScreen post-beta only.

---

## 7. KNOWN ISSUES & GOTCHAS

### Local Baby ID vs Supabase UUID
Baby IDs in AsyncStorage use format `baby-1710000000` but Supabase uses real UUIDs.
The `getSupabaseBabyId()` helper in supabaseService.js handles this with caching.
**Pattern: Always use this helper when syncing baby-related data to Supabase.**

### DailyLogScreen Bypasses AppContext
DailyLogScreen has its own local state AND writes directly to AsyncStorage.
It also calls `setGlobalLogs()` to sync to AppContext, but this was added later.
**When modifying DailyLogScreen: ensure writes go through BOTH AsyncStorage AND AppContext.**

### Voice Input Untested
expo-speech-recognition requires a dev build, not Expo Go.
voiceService.js has a safe fallback for Expo Go (shows "not available" message).
**Voice cannot be tested until an EAS dev build is created.**

### Auth is Email/Password (Temporary)
Phone OTP requires Twilio Message Service SID configuration.
Email/password works for development and testing.
**Before App Store launch: configure Twilio for phone OTP.**

### Streaming Uses XHR, Not Fetch
React Native's fetch doesn't support streaming properly.
`claudeAPI.js` uses XMLHttpRequest with `onreadystatechange` for real-time streaming.
**Do not replace XHR with fetch — it will break streaming.**

---

## 8. ENGINEERING MANDATES (Non-Negotiable Rules)

1. **NO medical logic in UI components.** UI calls Intelligence Service only.
2. **NO medical reasoning by LLM.** Rules Engine decides. LLM communicates.
3. **EVERY AI response has thumbs up/down.** Stored in ai_interactions.
4. **RLS on EVERY Supabase table.** Never use service_role key in client.
5. **EVERY log row has baby_age_days and postpartum_day** denormalized.
6. **LLM provider NEVER imported outside claudeAPI.js.** LLM-agnostic.
7. **Voice input shows text BEFORE sending.** User must review/edit.
8. **Consent screen in onboarding.** Versioned, stored in user_consents.
9. **Chat topic classification on every message.**
10. **All screens use pictograms + Bengali text.** Never text-only for critical actions.

---

## 9. REMAINING BUILD PLAN

| Phase | Status | What It Contains |
|---|---|---|
| Phase 1: Intelligence Service | ✅ Complete | 8 rule files + intelligenceService.js |
| Phase 2: Screen Refactoring | ✅ Complete | All 5 screens connected to Intelligence |
| Phase 3: Voice + RLHF | ✅ Complete | Bengali STT + thumbs up/down + Supabase sync |
| Phase 4: Supabase Backend | ✅ Complete | 12 tables, RLS, auth, sync, hydration, all gaps fixed |
| **Phase 5: Notifications + Milestones + Sharing + Predictive Card + One-Tap Logging** | ⬜ **NEXT** | Push notifications (7 types), milestone celebrations, WhatsApp sharing, predictive "Tonight" card, notification-driven logging |
| Phase 6: Analytics + Error Handling + Polish | ⬜ | Error boundaries, loading states, Bengali font, visual WHO growth curves, remove dev tools |
| Phase 7: Testing + Beta Build | ⬜ | EAS Build (APK + TestFlight), 15-35 beta mothers, feedback survey |

### Phase 5 Details (next to build):

**5A: Notifications (expo-notifications, local):**
- Vaccine reminder (2 days before due)
- Feed alert (last feed > 4 hours, baby < 6 months) — WITH one-tap action button "এইমাত্র খাওয়ালাম" that logs feed WITHOUT opening app
- Check-in prompt (no check-in by 8 PM)
- Evening summary (daily at 9 PM)
- Milestone celebration (age/weight milestones)
- Weekly report (every Sunday 10 AM)
- EPDS reminder (14 days since last assessment)

**5B: One-Tap Notification Logging (CRITICAL for retention):**
The biggest risk is daily active use habit formation. If logging takes too many taps, mothers log for 3 days then stop and the AI becomes useless without data.

Two solutions:
1. **Alert-driven logging:** When feed alert fires, notification has action buttons: "এইমাত্র খাওয়ালাম" (just fed) and "পরে" (later). Tapping logs the feed WITHOUT opening the app. Uses expo-notifications notification categories with action buttons.
2. **Morning catchup notification:** Every morning at 8 AM: "সুপ্রভাত! গতরাত কয়বার দুধ দিয়েছেন?" with buttons: ১ / ২ / ৩ / ৪+. One tap = last night's feeds logged. No app open needed. This captures retrospective data from mothers who forgot to log in real time.

**5C: Predictive "Tonight" Card (KILLER FEATURE — no competitor has this):**
Every evening at 7-8 PM, HomeScreen shows one card replacing the daily tip:
- "আজ রাতে [baby name] প্রায় ৩ বার উঠতে পারে। ফিড ছিল কম। ঘুমানোর আগে একবার ফিড করিয়ে নিন।"
- Predictive, specific, actionable — one card, one sentence, one action
- Uses existing data: last 7 nights' feeding pattern, last feed time, age-based sleep expectations, mother's sleep deprivation level, tomorrow's vaccine due
- Implementation: `getPredictiveCard()` in intelligenceService.js — pure Rules Engine, no LLM
- Color-coded border: green (normal night), yellow (prepare for disruption), orange (you need help tonight)

**5D: Milestones (services/milestoneService.js):**
- Age milestones: 1 week, 1/2/3/4/5/6 months
- Weight milestones: 4kg, 5kg, 6kg, etc.
- Logging streaks: 3, 7, 14, 30 consecutive days
- Vaccine progress: each completion
- Recovery milestones: 25%, 50%, 75%, 100%

**5E: WhatsApp Sharing (services/shareService.js):**
- Share milestones, weekly reports, daily summaries
- Formatted Bengali message with app download link
- Each share = organic viral growth (10-50 impressions per share)

### Phase 6 Details (updated):
In addition to error boundaries and polish, Phase 6 now includes:
- **Visual WHO Growth Curves:** Replace bar chart with dot-on-curve visualization showing WHO percentile bands (shaded red/orange/green zones) with baby's measurements plotted as dots. Not interactive/zoomable for MVP — just visual. Low-health-literacy users understand a dot on a curve better than "P47."

### Offline AI Decision (decided against for MVP):
All AI-powered apps fail when offline. Local LLMs don't speak Bengali well enough yet (Phi-3-mini, Gemma 2B are too weak for medical Bengali). However, our Intelligence Service IS our offline AI — alerts, milestones, daily tips, feed adequacy analysis all work fully offline because they're deterministic JavaScript. Only conversational chat requires internet. ChatScreen shows offline indicator when no connection. Year 2 opportunity when Bengali small models improve.

### Post-Beta Roadmap:
- Minimal controlled ads (HomeScreen only, NEVER in chat)
- App Store + Play Store simultaneous submission
- Month 1-3: Collect DGHS medical corpus for RAG
- Month 3-6: RAG with vector database + premium tier (৳49/month)
- Month 6-12: Custom Bengali maternal health LLM from RLHF data
- Year 2: Doctor portal, government dashboard, research API
- Year 2-3: Regional expansion (Hindi, Urdu) → South Asia

---

## 10. COMPETITIVE POSITIONING

### Hafsa Shastho vs ToguMogu
- ToguMogu: 200K users, e-commerce platform, 20-person team, 5 years old
- Their weakness: **completely ignores mother's health** — no postpartum tracking, no mental health, no mood tracking
- Our advantage: Deep health intelligence, mother-first approach, AI that knows full family context
- Strategy: Don't compete on breadth (e-commerce, services). Win on depth (health intelligence, emotional support)
- Positioning: "মা ও শিশুর AI সহায়ক" (Mother & Baby AI Companion) — NOT a parenting platform

### Hafsa Shastho vs Huckleberry (US)
- Huckleberry: US baby tracker, excellent UX, no mother health
- Our advantage: Bengali language, cultural context, postpartum depression detection, dual mother+baby tracking

---

## 11. HOW TO WORK WITH THIS CODEBASE

### For Claude Code in Cursor:
1. **Read this file first** — understand the architecture before making changes
2. **Check the relevant rules file** before modifying any health logic (services/rules/)
3. **Never put medical logic in UI** — screens only render data from Intelligence Service
4. **Test with `npx expo start --clear`** after every change
5. **Commit with descriptive messages** following pattern: `feat: Phase X — description`

### Preferred Development Pattern:
- UD prefers **complete file rewrites** over targeted edits when instructions are complex
- All code deliveries should include **test plans and git commit/push instructions**
- Phases completed sequentially — one phase fully done before next begins
- Pre-planning in Claude conversation → implementation in Cursor/Claude Code

### When in Doubt:
- Medical assessment logic → `services/rules/` (deterministic JavaScript)
- Bengali text rendering → check `utils/helpers.js` for toBengaliNumber()
- Date operations → use dayjs (imported in `services/rules/dateUtils.js`)
- Supabase operations → `services/supabaseService.js` (never call Supabase directly from screens)
- AI communication → `services/claudeAPI.js` (the ONLY file that talks to Claude)

---

*Last updated: April 3, 2026*
*Phases 1-4 complete. Database verified. RLHF pipeline active. Ready for Phase 5.*
