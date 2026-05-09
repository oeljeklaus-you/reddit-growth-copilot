// utils.js - Reddit Growth Copilot
// Shared utilities, mock AI functions, and DOM helpers.
//
// ══════════════════════════════════════════════════════════════════════════════
// NOTE: All AI functions in this file are MOCK / local-rule implementations.
//       No external API calls are made. No API keys are required.
//       Each function is clearly marked for future replacement with real AI.
// ══════════════════════════════════════════════════════════════════════════════

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Promotional / spam words that Reddit communities commonly flag.
// Used by scorePostContent().
const SPAM_WORDS = [
  'buy now', 'best tool', 'click here', 'limited offer', 'free money',
  'make money fast', 'guaranteed', 'discount code', 'promo code',
  'check my profile', 'follow me', 'subscribe', 'sign up now',
  'affiliate', 'referral link', 'dm me', 'link in bio',
];

const PRO_USER_STORAGE_KEY = 'rgc_is_pro_user';
const SETTINGS_STORAGE_KEY = 'rgcSettings';
const INTEREST_PROFILE_STORAGE_KEY = 'rgc_interest_profile';
const INTEREST_PROFILE_HISTORY_LIMIT = 120;
const INTEREST_PROFILE_KEYWORD_LIMIT = 200;
const INTEREST_PROFILE_SUBREDDIT_LIMIT = 50;
const INTEREST_PROFILE_RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RGC_DEBUG = false;
const PRO_FEATURES = Object.freeze({
  opportunityScore: 'opportunity_score',
  opIntent: 'op_intent',
  demandScore: 'demand_score',
  fakeActiveRisk: 'fake_active_risk',
  whyThis: 'why_this',
  successRate: 'success_rate',
  suggestedReply: 'suggested_reply',
});

const PRO_LOCK_COPY = '';

let cachedProUserStatus = null;
let proUserStatusLoadPromise = null;
let cachedSettings = null;
let settingsLoadPromise = null;
let cachedInterestProfile = null;
let interestProfileLoadPromise = null;

if (typeof globalThis.calculateMatchScore !== 'function') {
  globalThis.calculateMatchScore = function calculateMatchScore() {
    return {
      matchScore: 0,
      matchLabel: 'unknown',
      matchedKeywords: [],
      matchedSubreddits: [],
      matchComponents: {
        subredditScore: 0,
        keywordScore: 0,
        painScore: 0,
        recentBoost: 0,
      },
      matchSignals: {
        subreddit: null,
        titleKeywords: [],
        topicKeywords: [],
        painKeywords: [],
        productKeywords: [],
        keywords: [],
      },
      reason: 'match_scoring_unavailable',
    };
  };
}

function rgcLog(...args) {
  if (RGC_DEBUG) console.log("[RGC]", ...args);
}

function rgcWarn(...args) {
  if (RGC_DEBUG) console.warn("[RGC]", ...args);
}

function rgcError(...args) {
  if (RGC_DEBUG) console.error("[RGC]", ...args);
}

const INTEREST_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'do', 'does', 'doing', 'for', 'from', 'get', 'got', 'had', 'has', 'have', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'like', 'may', 'me', 'more',
  'my', 'no', 'not', 'of', 'on', 'or', 'our', 'out', 'should', 'so', 'than', 'that',
  'the', 'their', 'them', 'then', 'there', 'this', 'to', 'too', 'up', 'us', 'was',
  'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would',
  'you', 'your', 'reddit', 'post', 'thread'
]);

const INTEREST_TOPIC_PHRASES = [
  'build in public',
  'indie hacker',
  'product hunt',
  'go to market',
  'customer research',
  'user acquisition',
  'landing page',
  'email marketing',
  'content marketing',
  'growth hacking',
  'customer feedback',
  'feature request',
  'pricing page',
  'conversion rate',
  'trial to paid',
  'api integration',
  'workflow automation',
  'browser extension',
  'chrome extension',
  'mobile app',
  'web app',
  'saas',
  'startup',
  'open source',
  'ai agent'
];

const INTEREST_PAIN_PHRASES = [
  'no users',
  'not working',
  'wasting time',
  'running out of time',
  'too expensive',
  'hard to',
  'need help',
  'looking for',
  'struggling with',
  'stuck on',
  'broken',
  'manual work',
  'low conversion',
  'high churn',
  'bad retention',
  'getting buried',
  'no traction',
  'slow growth',
  'does not work',
  'doesn t work',
  'don t work',
  'alternative to',
  'workaround'
];

const INTEREST_PRODUCT_PHRASES = [
  'chrome extension',
  'browser extension',
  'mobile app',
  'web app',
  'desktop app',
  'saas',
  'software',
  'tool',
  'platform',
  'service',
  'plugin',
  'extension',
  'api',
  'crm',
  'automation',
  'analytics',
  'newsletter',
  'landing page',
  'marketing',
  'seo',
  'billing',
  'subscription',
  'dashboard',
  'workflow'
];

function isProFeature(feature) {
  return Object.values(PRO_FEATURES).includes(feature);
}

function isProUserCached() {
  return true;
}

async function refreshProUserStatus() {
  cachedProUserStatus = true;
  proUserStatusLoadPromise = null;
  return true;
}

function shouldLockProFeature(feature) {
  return false;
}

function canAccessProFeature() {
  return true;
}

function isFeatureLocked() {
  return false;
}

function getProStatus() {
  return {
    isProUser: true,
    planName: 'pro',
    proExpiresAt: null,
  };
}

function isValidCheckoutUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname) return false;
    if (parsed.protocol === 'chrome-extension:') return false;
    return true;
  } catch {
    return false;
  }
}

function clearUpgradeCheckoutError(anchor) {
  const root = anchor?.closest?.('.rgc-pro-lock-actions, .rgc-opp-pro-lock-actions, .pro-card, .settings-wrap') || anchor?.parentElement;
  if (!root) return;
  const errorEl = root.querySelector?.('.rgc-pro-checkout-error');
  if (errorEl) errorEl.remove();
}

function showUpgradeCheckoutError(anchor, message) {
  const root = anchor?.closest?.('.rgc-pro-lock-actions, .rgc-opp-pro-lock-actions, .pro-card, .settings-wrap') || anchor?.parentElement;
  if (!root) return;

  let errorEl = root.querySelector?.('.rgc-pro-checkout-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.className = 'rgc-pro-checkout-error';
    errorEl.style.marginTop = '8px';
    errorEl.style.fontSize = '11px';
    errorEl.style.lineHeight = '1.35';
    errorEl.style.color = '#b91c1c';
    errorEl.setAttribute('role', 'status');
    errorEl.setAttribute('aria-live', 'polite');
    root.appendChild(errorEl);
  }
  errorEl.textContent = message || 'Could not open link. Please try again.';
}

function getCheckoutOpenMessage() {
  return { type: 'RGC_OPEN_CHECKOUT' };
}

async function openCheckoutViaBackground() {
  if (!chrome?.runtime?.sendMessage) {
    throw new Error('Could not open link. Please try again.');
  }

  try {
    const response = await chrome.runtime.sendMessage(getCheckoutOpenMessage());
    if (response && response.ok) return true;
    throw new Error('Could not open link. Please try again.');
  } catch (e) {
    throw new Error('Could not open link. Please try again.');
  }
}

function getDefaultRgcSettings() {
  return {
    ui: {
      showFeedScores: true,
      showFeedScoresOnHome: true,
      showFeedScoresOnSubreddit: true,
      feedScoreFilter: 'all',
    },
    personalization: {
      enableHistoryPersonalization: true,
    },
  };
}

function normalizeRgcSettings(stored = {}) {
  const defaults = getDefaultRgcSettings();
  return {
    ui: {
      ...defaults.ui,
      ...(stored && stored.ui ? stored.ui : {}),
    },
    personalization: {
      ...defaults.personalization,
      ...(stored && stored.personalization ? stored.personalization : {}),
    },
  };
}

async function refreshRgcSettings() {
  if (settingsLoadPromise) return settingsLoadPromise;

  settingsLoadPromise = (async () => {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
      cachedSettings = normalizeRgcSettings(stored[SETTINGS_STORAGE_KEY] || {});
    } catch (e) {
      cachedSettings = normalizeRgcSettings();
    } finally {
      settingsLoadPromise = null;
    }
    return cachedSettings;
  })();

  return settingsLoadPromise;
}

async function getRgcSettings() {
  if (cachedSettings) return cachedSettings;
  return refreshRgcSettings();
}

function isHistoryPersonalizationEnabled() {
  return cachedSettings ? cachedSettings.personalization.enableHistoryPersonalization !== false : true;
}

async function openProUpgradeSurface(anchor) {
  clearUpgradeCheckoutError(anchor);
  try {
    await openCheckoutViaBackground();
    return true;
  } catch (error) {
    showUpgradeCheckoutError(anchor, error?.message || 'Could not open link. Please try again.');
    return false;
  }
}

function createProUpgradeButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rgc-pro-lock-btn';
  button.textContent = 'Learn more';
  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    await openProUpgradeSurface(button);
  });
  return button;
}

function createProGateOverlay(feature, message) {
  const overlay = document.createElement('div');
  overlay.className = 'rgc-pro-lock-overlay';
  overlay.setAttribute('data-rgc-pro-feature', feature);

  const badge = document.createElement('div');
  badge.className = 'rgc-pro-lock-badge';
  badge.textContent = 'Info';

  const copy = document.createElement('div');
  copy.className = 'rgc-pro-lock-copy';
  copy.textContent = message || PRO_LOCK_COPY;

  const actions = document.createElement('div');
  actions.className = 'rgc-pro-lock-actions';
  actions.appendChild(createProUpgradeButton());

  overlay.append(badge, copy, actions);
  return overlay;
}

function wrapWithProGate(node, feature, options = {}) {
  if (!node || !isProFeature(feature) || !shouldLockProFeature(feature)) return node;

  const wrapper = document.createElement('div');
  wrapper.className = 'rgc-pro-gated';
  if (options.inline) wrapper.classList.add('rgc-pro-gated--inline');
  if (options.className) wrapper.classList.add(options.className);
  wrapper.setAttribute('data-rgc-pro-feature', feature);
  wrapper.appendChild(node);
  wrapper.appendChild(createProGateOverlay(feature, options.message));
  return wrapper;
}

function normalizeInterestText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+\s/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeTerms(values, limit = Infinity) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const term = normalizeInterestText(value);
    if (!term || seen.has(term)) continue;
    seen.add(term);
    output.push(term);
    if (output.length >= limit) break;
  }
  return output;
}

function countTermOccurrences(text, phrase) {
  if (!text || !phrase) return 0;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundary = phrase.includes(' ') ? '' : '\\b';
  const regex = new RegExp(`${boundary}${escaped}${boundary}`, 'gi');
  return (text.match(regex) || []).length;
}

function collectPhraseMatches(text, phrases) {
  const normalized = normalizeInterestText(text);
  const matches = [];
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (countTermOccurrences(normalized, phrase) > 0) {
      matches.push(phrase);
    }
  }
  return matches;
}

function tokenizeInterestText(text) {
  const normalized = normalizeInterestText(text);
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter((token) => token.length >= 3 && !INTEREST_STOPWORDS.has(token));
}

function extractInterestKeywords(text, limit = 12) {
  const normalized = normalizeInterestText(text);
  if (!normalized) return [];
  const tokens = tokenizeInterestText(normalized);
  const phrases = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  for (let i = 0; i < tokens.length - 2; i += 1) {
    phrases.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return dedupeTerms([
    ...collectPhraseMatches(normalized, INTEREST_TOPIC_PHRASES),
    ...phrases,
    ...tokens,
  ], limit);
}

function extractInterestTags(post = {}) {
  const subreddit = normalizeInterestText(post.subreddit || '');
  const title = String(post.title || '');
  const body = String(post.bodyText || post.body || '');
  const combined = `${title} ${body}`.trim();

  const titleKeywords = extractInterestKeywords(title, 8);
  const topicKeywords = dedupeTerms([
    ...extractInterestKeywords(combined, 10),
    ...collectPhraseMatches(combined, INTEREST_TOPIC_PHRASES),
  ], 10);
  const painKeywords = dedupeTerms([
    ...collectPhraseMatches(combined, INTEREST_PAIN_PHRASES),
  ], 8);
  const productKeywords = dedupeTerms([
    ...collectPhraseMatches(combined, INTEREST_PRODUCT_PHRASES),
  ], 8);

  return {
    subreddit: subreddit || null,
    titleKeywords,
    topicKeywords,
    painKeywords,
    productKeywords,
    keywords: dedupeTerms([
      ...titleKeywords,
      ...topicKeywords,
      ...productKeywords,
    ], INTEREST_PROFILE_KEYWORD_LIMIT),
  };
}

function normalizeInterestProfile(raw = {}) {
  const profile = {
    subreddits: {},
    keywords: {},
    painKeywords: {},
    history: [],
    updatedAt: raw.updatedAt || Date.now(),
  };

  const coerceMap = (source) => {
    const output = {};
    if (!source || typeof source !== 'object') return output;
    for (const [key, value] of Object.entries(source)) {
      const term = normalizeInterestText(key);
      if (!term) continue;
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) continue;
      output[term] = Math.round(num);
    }
    return output;
  };

  profile.subreddits = coerceMap(raw.subreddits);
  profile.keywords = coerceMap(raw.keywords);
  profile.painKeywords = coerceMap(raw.painKeywords);
  if (Array.isArray(raw.history)) {
    profile.history = raw.history
      .map((item) => ({
        postId: normalizeInterestText(item?.postId || ''),
        postUrl: String(item?.postUrl || ''),
        subreddit: normalizeInterestText(item?.subreddit || ''),
        titleKeywords: Array.isArray(item?.titleKeywords) ? item.titleKeywords.map(normalizeInterestText).filter(Boolean) : [],
        topicKeywords: Array.isArray(item?.topicKeywords) ? item.topicKeywords.map(normalizeInterestText).filter(Boolean) : [],
        painKeywords: Array.isArray(item?.painKeywords) ? item.painKeywords.map(normalizeInterestText).filter(Boolean) : [],
        productKeywords: Array.isArray(item?.productKeywords) ? item.productKeywords.map(normalizeInterestText).filter(Boolean) : [],
        ts: Number(item?.ts) || Date.now(),
      }))
      .filter((item) => item.ts > 0);
  }
  return profile;
}

function getInterestIdentity(post = {}) {
  const postId = normalizeInterestText(post.postId || '');
  if (postId) return `id:${postId}`;
  const postUrl = String(post.postUrl || '').trim();
  if (postUrl) return `url:${postUrl}`;
  return '';
}

function getInterestProfileAgeWeight(ts) {
  const age = Math.max(0, Date.now() - (Number(ts) || Date.now()));
  if (age <= INTEREST_PROFILE_RECENT_WINDOW_MS) return 1;
  if (age <= INTEREST_PROFILE_RECENT_WINDOW_MS * 3) return 0.6;
  return 0.3;
}

function rebuildInterestProfile(profile) {
  const rebuilt = {
    subreddits: {},
    keywords: {},
    painKeywords: {},
    history: Array.isArray(profile.history) ? profile.history.slice(0, INTEREST_PROFILE_HISTORY_LIMIT) : [],
    updatedAt: profile.updatedAt || Date.now(),
  };

  for (const entry of rebuilt.history) {
    const weight = getInterestProfileAgeWeight(entry.ts);
    if (entry.subreddit) {
      rebuilt.subreddits[entry.subreddit] = (rebuilt.subreddits[entry.subreddit] || 0) + weight;
    }
    for (const keyword of dedupeTerms([
      ...(entry.titleKeywords || []),
      ...(entry.topicKeywords || []),
      ...(entry.productKeywords || []),
    ])) {
      rebuilt.keywords[keyword] = (rebuilt.keywords[keyword] || 0) + weight;
    }
    for (const keyword of dedupeTerms(entry.painKeywords || [])) {
      rebuilt.painKeywords[keyword] = (rebuilt.painKeywords[keyword] || 0) + weight;
    }
  }

  const pruneMap = (map, limit) => {
    const entries = Object.entries(map)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    return Object.fromEntries(entries.map(([key, value]) => [key, Math.max(1, Math.round(value))]));
  };

  rebuilt.subreddits = pruneMap(rebuilt.subreddits, INTEREST_PROFILE_SUBREDDIT_LIMIT);
  const combinedKeywords = [
    ...Object.entries(rebuilt.keywords).map(([key, value]) => ({ category: 'keywords', key, value })),
    ...Object.entries(rebuilt.painKeywords).map(([key, value]) => ({ category: 'painKeywords', key, value })),
  ]
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, INTEREST_PROFILE_KEYWORD_LIMIT);

  rebuilt.keywords = {};
  rebuilt.painKeywords = {};
  for (const entry of combinedKeywords) {
    const rounded = Math.max(1, Math.round(entry.value));
    if (entry.category === 'painKeywords') rebuilt.painKeywords[entry.key] = rounded;
    else rebuilt.keywords[entry.key] = rounded;
  }
  rebuilt.updatedAt = Date.now();
  return rebuilt;
}

function scoreInterestOverlap(items, profileMap) {
  const entries = Object.entries(profileMap || {})
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { score: 0, matchedWeight: 0, totalWeight: 0, matchedTerms: [] };

  const totalWeight = entries.reduce((sum, [, value]) => sum + value, 0);
  const matchedTerms = [];
  let matchedWeight = 0;
  for (const item of dedupeTerms(items)) {
    const weight = profileMap[item];
    if (!weight) continue;
    matchedTerms.push(item);
    matchedWeight += weight;
  }
  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return {
    score: Math.max(0, Math.min(100, score)),
    matchedWeight,
    totalWeight,
    matchedTerms,
  };
}

function calculateInterestMatchScore(post = {}, profile = cachedInterestProfile || normalizeInterestProfile()) {
  if (!isHistoryPersonalizationEnabled()) {
    return {
      matchScore: 0,
      matchLabel: 'Low match',
      matchedKeywords: [],
      matchedSubreddits: [],
      matchComponents: {
        subredditScore: 0,
        keywordScore: 0,
        painScore: 0,
        recentBoost: 0,
      },
      matchSignals: extractInterestTags(post),
      profileUpdatedAt: normalizeInterestProfile(profile).updatedAt || null,
    };
  }

  const tags = extractInterestTags(post);
  const normalizedProfile = normalizeInterestProfile(profile);
  const profileHasHistory = Object.keys(normalizedProfile.subreddits).length > 0
    || Object.keys(normalizedProfile.keywords).length > 0
    || Object.keys(normalizedProfile.painKeywords).length > 0;

  if (!profileHasHistory) {
    return {
      matchScore: 0,
      matchLabel: 'Low match',
      matchedKeywords: [],
      matchedSubreddits: [],
      matchComponents: {
        subredditScore: 0,
        keywordScore: 0,
        painScore: 0,
        recentBoost: 0,
      },
      matchSignals: tags,
      profileUpdatedAt: normalizedProfile.updatedAt || null,
    };
  }

  const currentSubreddit = normalizeInterestText(tags.subreddit || '');
  const matchedKeywords = [];

  const subredditScore = currentSubreddit && normalizedProfile.subreddits[currentSubreddit] ? 20 : 0;
  const matchedSubreddits = subredditScore > 0 && currentSubreddit ? [currentSubreddit] : [];

  const keywordMatches = tags.titleKeywords.filter((keyword) => Boolean(normalizedProfile.keywords[keyword]));
  const painMatches = tags.painKeywords.filter((keyword) => Boolean(normalizedProfile.painKeywords[keyword]));

  matchedKeywords.push(...keywordMatches, ...painMatches);

  const keywordScore = Math.min(40, keywordMatches.length * 8);
  const painScore = Math.min(30, painMatches.length * 10);

  const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const recentBoost = (normalizedProfile.history || []).some((entry) => {
    if ((Number(entry.ts) || 0) < recentCutoff) return false;
    if (currentSubreddit && normalizeInterestText(entry.subreddit || '') === currentSubreddit) return true;
    const entryKeywords = [
      ...(Array.isArray(entry.titleKeywords) ? entry.titleKeywords : []),
      ...(Array.isArray(entry.topicKeywords) ? entry.topicKeywords : []),
      ...(Array.isArray(entry.painKeywords) ? entry.painKeywords : []),
      ...(Array.isArray(entry.productKeywords) ? entry.productKeywords : []),
    ].map(normalizeInterestText);
    return matchedKeywords.some((keyword) => entryKeywords.includes(keyword));
  }) ? 10 : 0;

  const matchScore = Math.max(0, Math.min(100, subredditScore + keywordScore + painScore + recentBoost));

  let matchLabel = 'Low match';
  if (matchScore >= 70) matchLabel = 'High match';
  else if (matchScore >= 40) matchLabel = 'Medium match';

  return {
    matchScore,
    matchLabel,
    matchedKeywords: dedupeTerms(matchedKeywords, 20),
    matchedSubreddits,
    matchComponents: {
      subredditScore,
      keywordScore,
      painScore,
      recentBoost,
    },
    matchSignals: tags,
    profileUpdatedAt: normalizedProfile.updatedAt || null,
  };
}

function calculateMatchScore(signals, interestProfile) {
  try {
    if (typeof calculateInterestMatchScore === 'function') {
      return calculateInterestMatchScore(signals, interestProfile);
    }
  } catch (e) {
  }
  return {
    matchScore: 0,
    matchLabel: 'Low match',
    matchedKeywords: [],
    matchedSubreddits: [],
    reason: 'match_scoring_not_configured',
  };
}

async function ensureInterestProfileLoaded() {
  if (interestProfileLoadPromise) return interestProfileLoadPromise;

  interestProfileLoadPromise = (async () => {
    try {
      const stored = await chrome.storage.local.get(INTEREST_PROFILE_STORAGE_KEY);
      cachedInterestProfile = normalizeInterestProfile(stored[INTEREST_PROFILE_STORAGE_KEY] || {});
    } catch (e) {
      cachedInterestProfile = normalizeInterestProfile();
    } finally {
      interestProfileLoadPromise = null;
    }
    return cachedInterestProfile;
  })();

  return interestProfileLoadPromise;
}

async function getInterestProfile() {
  if (cachedInterestProfile) return cachedInterestProfile;
  return ensureInterestProfileLoaded();
}

async function recordInterestProfileAnalysis(post = {}) {
  if (!isHistoryPersonalizationEnabled()) return false;

  const identity = getInterestIdentity(post);
  if (!identity) return false;

  const tags = extractInterestTags(post);
  const hasSignals = Boolean(tags.subreddit || tags.keywords.length || tags.painKeywords.length);
  if (!hasSignals) return false;

  const profile = normalizeInterestProfile(await getInterestProfile());
  const nextHistory = profile.history.filter((entry) => {
    const entryIdentity = getInterestIdentity(entry);
    return entryIdentity !== identity;
  });

  nextHistory.unshift({
    postId: normalizeInterestText(post.postId || ''),
    postUrl: String(post.postUrl || '').trim(),
    subreddit: tags.subreddit || '',
    titleKeywords: tags.titleKeywords,
    topicKeywords: tags.topicKeywords,
    painKeywords: tags.painKeywords,
    productKeywords: tags.productKeywords,
    ts: Date.now(),
  });

  profile.history = nextHistory.slice(0, INTEREST_PROFILE_HISTORY_LIMIT);
  const rebuilt = rebuildInterestProfile(profile);
  cachedInterestProfile = rebuilt;

  try {
    await chrome.storage.local.set({ [INTEREST_PROFILE_STORAGE_KEY]: rebuilt });
    return true;
  } catch (e) {
    return false;
  }
}

async function refreshInterestProfile() {
  return ensureInterestProfileLoaded();
}

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[INTEREST_PROFILE_STORAGE_KEY]) return;
    cachedInterestProfile = normalizeInterestProfile(changes[INTEREST_PROFILE_STORAGE_KEY].newValue || {});
  });
}

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SETTINGS_STORAGE_KEY]) return;
    cachedSettings = normalizeRgcSettings(changes[SETTINGS_STORAGE_KEY].newValue || {});
  });
}

async function initProGating() {
  await refreshProUserStatus();
}

void refreshRgcSettings();
void ensureInterestProfileLoaded();

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[PRO_USER_STORAGE_KEY]) return;
    cachedProUserStatus = changes[PRO_USER_STORAGE_KEY].newValue === true;
  });
}

void initProGating();

// ─────────────────────────────────────────────────────────────────────────────
// MOCK AI — TITLE SUGGESTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateTitleSuggestions(title)
 *
 * CURRENT:  Local rule-based mock — generates 3 title variants deterministically.
 * FUTURE:   Replace the function body with an AI API call, e.g.:
 *
 *   const res = await fetch('https://api.openai.com/v1/chat/completions', {
 *     method: 'POST',
 *     headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       model: 'gpt-4o',
 *       messages: [{
 *         role: 'user',
 *         content: `Rewrite this Reddit post title in 3 styles (Question, Story, Data).
 *                   Return JSON array: [{style, icon, text}]\n\nTitle: ${title}`
 *       }]
 *     })
 *   });
 *   const data = await res.json();
 *   return JSON.parse(data.choices[0].message.content);
 *
 * @param {string} title - Original post title entered by user
 * @returns {Array<{ style: string, icon: string, text: string }>}
 */
function generateTitleSuggestions(title) {
  // ── MOCK IMPLEMENTATION START ─────────────────────────────────────────────
  if (!title || title.trim().length === 0) return [];

  const t = title.trim();
  const words = t.split(/\s+/);
  const noun = words.slice(-2).join(' ');  // last 2 words as topic focus

  // ── Style 1: Question ─────────────────────────────────────────
  // Reframes the title as an open question to invite discussion.
  let questionText;
  if (/\?$/.test(t)) {
    questionText = `Why is ${t.replace(/\?$/, '')} such a hot topic right now?`;
  } else if (/^(how|why|what|when|where|who|is|are|can|do|does)/i.test(t)) {
    questionText = t.endsWith('?') ? t : t + ' — share your experience?';
  } else {
    questionText = `Is ${t.charAt(0).toLowerCase() + t.slice(1)} actually worth it? Here's what I found`;
  }

  // ── Style 2: Story ────────────────────────────────────────────
  // Adds a personal narrative framing to increase relatability.
  const storyTemplates = [
    `I spent 3 months on ${noun} — here's what happened`,
    `My honest experience with ${t.toLowerCase()}`,
    `After trying ${t.toLowerCase()} for a month, I have thoughts`,
  ];
  // Pick template deterministically based on title length (no randomness)
  const storyText = storyTemplates[t.length % storyTemplates.length];

  // ── Style 3: Data / Number ────────────────────────────────────
  // Adds credibility through specifics and measurable framing.
  let dataText;
  if (/\d/.test(t)) {
    dataText = `${t} — I tracked the data so you don't have to`;
  } else {
    // Deterministic "number" derived from word count so it's consistent
    const num = (words.length % 7) + 3;
    dataText = `${num} things about ${t.toLowerCase()} that changed my mind`;
  }

  return [
    { style: 'Question', icon: '❓', text: questionText },
    { style: 'Story',    icon: '📖', text: storyText },
    { style: 'Data',     icon: '📊', text: dataText },
  ];
  // ── MOCK IMPLEMENTATION END ───────────────────────────────────────────────
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK AI — CONTENT SCORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * scorePostContent(title, body)
 *
 * CURRENT:  Local rule-based scoring — checks title length, spam words, body
 *           length, discussion hooks, all-caps, clickbait, and formatting.
 * FUTURE:   Replace the function body with an AI API call, e.g.:
 *
 *   const res = await fetch('https://api.anthropic.com/v1/messages', {
 *     method: 'POST',
 *     headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       model: 'claude-sonnet-4-5-20250929',
 *       max_tokens: 500,
 *       messages: [{
 *         role: 'user',
 *         content: `Score this Reddit post 0-100. Return JSON: {score, issues: string[3], suggestions: string[3]}
 *                   Title: ${title}\nBody: ${body}`
 *       }]
 *     })
 *   });
 *   const data = await res.json();
 *   return JSON.parse(data.content[0].text);
 *
 * @param {string} title
 * @param {string} body
 * @returns {{ score: number, issues: string[], suggestions: string[] }}
 */
function scorePostContent(title, body) {
  // ── MOCK IMPLEMENTATION START ─────────────────────────────────────────────
  let score = 100;
  const issues = [];
  const suggestions = [];

  const t = (title || '').trim();
  const b = (body  || '').trim();
  const fullText = (t + ' ' + b).toLowerCase();

  // ── Rule 1: Title length ──────────────────────────────────────
  if (t.length === 0) {
    score -= 30;
    issues.push('Title is missing');
    suggestions.push('Add a descriptive title to attract readers');
  } else if (t.length < 20) {
    score -= 15;
    issues.push(`Title is too short (${t.length} chars — aim for 40–90)`);
    suggestions.push('Expand the title to 40–90 characters for best engagement');
  } else if (t.length > 300) {
    score -= 10;
    issues.push('Title is too long (over 300 chars)');
    suggestions.push('Trim the title to under 150 characters for clarity');
  }

  // ── Rule 2: Spam / promotional language ──────────────────────
  const foundSpam = SPAM_WORDS.filter(w => fullText.includes(w));
  if (foundSpam.length > 0) {
    score -= Math.min(foundSpam.length * 12, 30);
    issues.push(`Promotional language detected: "${foundSpam.slice(0, 2).join('", "')}"`);
    suggestions.push('Remove sales-style language — Reddit communities flag promotional posts');
  }

  // ── Rule 3: Body length ───────────────────────────────────────
  if (b.length === 0) {
    score -= 10;
    issues.push('Body is empty');
    suggestions.push('Add context or a text body to encourage discussion');
  } else if (b.length < 100) {
    score -= 8;
    issues.push(`Body is very short (${b.length} chars — aim for 200+)`);
    suggestions.push('Expand your post body with more detail (aim for 200+ characters)');
  }

  // ── Rule 4: Discussion hook ───────────────────────────────────
  const discussionSignals = ['what do you think', 'thoughts?', 'anyone else', 'have you', 'do you', '?'];
  const hasDiscussion = discussionSignals.some(w => fullText.includes(w));
  if (!hasDiscussion && b.length > 0) {
    score -= 8;
    issues.push('No discussion hook found');
    suggestions.push('End with a question to prompt replies, e.g. "What do you think?"');
  }

  // ── Rule 5: Excessive caps in title ──────────────────────────
  const upperCount  = (t.match(/[A-Z]/g) || []).length;
  const letterCount = (t.match(/[a-zA-Z]/g) || []).length;
  if (letterCount > 5 && upperCount / letterCount > 0.6) {
    score -= 10;
    issues.push('Title uses excessive capital letters');
    suggestions.push('Use normal sentence case — ALL CAPS reads as shouting');
  }

  // ── Rule 6: Clickbait patterns ────────────────────────────────
  if (t.endsWith('...') || /you won't believe|this will shock/i.test(t)) {
    score -= 8;
    issues.push('Clickbait style detected');
    suggestions.push('Be direct — Reddit users prefer honest, specific titles over clickbait');
  }

  // ── Rule 7: Long body missing paragraph breaks ────────────────
  if (b.length > 300 && !b.includes('\n')) {
    score -= 5;
    issues.push('Long body text with no paragraph breaks');
    suggestions.push('Break text into paragraphs with blank lines for readability');
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score));

  // ── Pad to always return exactly 3 issues + 3 suggestions ─────
  const defaultIssues = [
    'Consider adding more context about your experience',
    'Check subreddit rules before posting',
    'Verify the post topic fits the community',
  ];
  const defaultSuggestions = [
    'Read top posts in the subreddit to match the style',
    'Post at peak hours (9–11 AM EST on weekdays)',
    'Engage with comments in the first 30 minutes after posting',
  ];

  while (issues.length < 3)      issues.push(defaultIssues[issues.length]);
  while (suggestions.length < 3) suggestions.push(defaultSuggestions[suggestions.length]);

  return {
    score,
    issues:      issues.slice(0, 3),
    suggestions: suggestions.slice(0, 3),
  };
  // ── MOCK IMPLEMENTATION END ───────────────────────────────────────────────
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE DISPLAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a CSS color for a given score (0–100).
 * @param {number} score
 * @returns {string}
 */
function scoreColor(score) {
  if (score >= 80) return '#46d160';  // green
  if (score >= 55) return '#ffd635';  // yellow
  return '#ff585b';                   // red
}

/**
 * Returns a human label for a given score (0–100).
 * @param {number} score
 * @returns {string}
 */
function scoreLabel(score) {
  if (score >= 80) return 'Great';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 35) return 'Weak';
  return 'Poor';
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM HELPERS — with fallback selectors for Reddit's unstable DOM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safe querySelector that tries multiple selectors in order.
 * Returns the first match, or null if nothing found.
 *
 * Reddit changes its DOM structure frequently between versions (old/new/shreddit).
 * Always use this instead of a bare querySelector.
 *
 * @param {string[]} selectors
 * @param {Document|Element} [root=document]
 * @returns {Element|null}
 */
function safeQuery(selectors, root) {
  root = root || document;
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // Invalid selector syntax — skip silently
    }
  }
  return null;
}

/**
 * Safe querySelectorAll that tries multiple selectors.
 * Returns the first non-empty NodeList as an Array, or [] if nothing found.
 *
 * @param {string[]} selectors
 * @param {Document|Element} [root=document]
 * @returns {Element[]}
 */
function safeQueryAll(selectors, root) {
  root = root || document;
  for (const sel of selectors) {
    try {
      const els = root.querySelectorAll(sel);
      if (els && els.length > 0) return Array.from(els);
    } catch (e) {
      // Invalid selector — skip silently
    }
  }
  return [];
}

/**
 * Get text value from an input, textarea, or contenteditable element.
 * @param {Element} el
 * @returns {string}
 */
function getElementText(el) {
  if (!el) return '';
  // Standard form controls
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    return el.value || '';
  }
  // contenteditable div (Reddit's rich text editor)
  return el.innerText || el.textContent || '';
}

/**
 * Copy text to clipboard.
 * Uses the modern Clipboard API with execCommand fallback for older contexts.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // Fall through to legacy method
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Simple debounce utility.
 * @param {Function} fn
 * @param {number} delay  milliseconds
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE TYPE DETECTION  (shared — loaded by content.js & available to popup.js
// via injected script context)
//
// Uses URL.pathname for reliable classification rather than loose
// string.includes() chains, which break on edge-case URLs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify a Reddit URL into a page type.
 *
 * @param {string} [href]  URL to classify. Defaults to window.location.href.
 * @returns {'submit'|'post'|'subreddit'|'home'|'user'|'other'}
 */
function detectPageType(href) {
  try {
    const url  = new URL(href || window.location.href);
    const path = url.pathname.replace(/\/+$/, '') || '/'; // normalise trailing slash

    // Post submission — /r/{sub}/submit  or  /submit
    if (/\/submit$/.test(path)) return 'submit';

    // Post detail — /r/{sub}/comments/{id}/...
    if (/\/r\/[^/]+\/comments\//.test(path)) return 'post';

    // Subreddit feed — /r/{sub}  or  /r/{sub}/hot  /new  /top  /rising
    if (/\/r\/[^/]+(\/(?:hot|new|top|rising|controversial))?$/.test(path)) return 'subreddit';

    // Home / global feeds — /  /hot  /new  /top  /r/all  /r/popular
    if (/^\/(hot|new|top|rising|best)?$/.test(path)) return 'home';
    if (/^\/r\/(all|popular)(\/(?:hot|new|top|rising))?$/.test(path)) return 'home';

    // User profile
    if (/\/user\//.test(path)) return 'user';

    return 'other';
  } catch (e) {
    return 'other';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAST ANALYSIS SUMMARY
// Persists a compact record of the most recent score / title / subreddit
// analysis so the popup can show a quick recap without re-running anything.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save a compact analysis summary to chrome.storage.local.
 * Silently ignores errors (storage quota, context invalidation, etc.)
 *
 * @param {{ type: string, [key: string]: any }} data
 */
function saveLastAnalysis(data) {
  try {
    chrome.storage.local.set({
      rgcLastAnalysis: { ...data, timestamp: Date.now() },
    });
  } catch (e) {
    // Storage unavailable — safe to ignore
  }
}

globalThis.RGCProGating = Object.freeze({
  FEATURES: PRO_FEATURES,
  PRO_LOCK_COPY,
  refreshProUserStatus,
  isProUserCached,
  shouldLockProFeature,
  canAccessProFeature,
  isFeatureLocked,
  getProStatus,
  wrapWithProGate,
  openProUpgradeSurface,
});

globalThis.RGCInterestProfile = Object.freeze({
  STORAGE_KEY: INTEREST_PROFILE_STORAGE_KEY,
  ensureLoaded: refreshInterestProfile,
  getProfile: getInterestProfile,
  extractInterestTags,
  calculateMatchScore,
  recordPostAnalysis: recordInterestProfileAnalysis,
  isEnabled: isHistoryPersonalizationEnabled,
});

globalThis.calculateMatchScore = calculateMatchScore;
if (typeof window !== 'undefined') {
  window.calculateMatchScore = calculateMatchScore;
}
globalThis.rgcLog = rgcLog;
globalThis.rgcWarn = rgcWarn;
globalThis.rgcError = rgcError;
if (typeof window !== 'undefined') {
  window.rgcLog = rgcLog;
  window.rgcWarn = rgcWarn;
  window.rgcError = rgcError;
}

globalThis.RGCSettings = Object.freeze({
  STORAGE_KEY: SETTINGS_STORAGE_KEY,
  ensureLoaded: refreshRgcSettings,
  getSettings: getRgcSettings,
  isHistoryPersonalizationEnabled,
});

globalThis.openUpgradeCheckout = openCheckoutViaBackground;
globalThis.showUpgradeCheckoutError = showUpgradeCheckoutError;
globalThis.clearUpgradeCheckoutError = clearUpgradeCheckoutError;
