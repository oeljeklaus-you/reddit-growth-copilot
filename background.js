'use strict';

const SETTINGS_KEY = 'rgcSettings';
const ANALYTICS_MESSAGE_TYPE = 'RGC_ANALYTICS_EVENT';
const CLIENT_ID_KEY = 'rgcAnalyticsClientId';
const SESSION_KEY = 'rgcAnalyticsSession';
const PRO_USER_KEY = 'rgc_is_pro_user';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const CONTENT_SCRIPT_FILES = ['analytics.js', 'utils.js', 'content.js', 'opportunity.js'];
const CONTENT_CSS_FILES = ['content.css'];
const BILLING_STATUS_ENDPOINT = '/api/user/status';
const RGC_PADDLE_CHECKOUT_URL = '';
const RGC_PADDLE_SANDBOX_CHECKOUT_URL = '';

let proStatusSyncPromise = null;

const GA_CONFIG = Object.freeze({
  enabled: false,
  measurementId: 'G-XXXXXXXXXX',
  apiSecret: 'REPLACE_WITH_GA4_API_SECRET',
  endpoint: 'https://www.google-analytics.com/mp/collect',
  debugMode: false,
});

const DEFAULT_SETTINGS = Object.freeze({
  ui: {
    showFeedScores: true,
    showFeedScoresOnHome: true,
    showFeedScoresOnSubreddit: true,
    feedScoreFilter: 'all',
  },
});

function canInjectIntoUrl(url) {
  try {
    const parsed = new URL(url || '');
    return parsed.hostname.endsWith('reddit.com') && /^https?:$/.test(parsed.protocol);
  } catch (e) {
    return false;
  }
}

async function injectExtensionAssets(tabId) {
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: CONTENT_CSS_FILES,
    });
  } catch (e) {
    // CSS may already exist in the page; continue to script injection.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: CONTENT_SCRIPT_FILES,
  });
}

function mergeSettings(stored) {
  return {
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(stored && stored.ui ? stored.ui : {}),
    },
  };
}

async function getSettings() {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return mergeSettings(stored[SETTINGS_KEY]);
  } catch (e) {
    return mergeSettings(null);
  }
}

function isAnalyticsEnabled() {
  return Boolean(
    GA_CONFIG.enabled &&
    /^G-[A-Z0-9]+$/i.test(GA_CONFIG.measurementId) &&
    GA_CONFIG.apiSecret &&
    !/REPLACE/i.test(GA_CONFIG.apiSecret)
  );
}

function sanitizeName(name) {
  const raw = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!raw) return '';
  const safe = /^[a-z]/.test(raw) ? raw : `e_${raw}`;
  return safe.slice(0, 40);
}

function sanitizeValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value).slice(0, 100);
}

function sanitizeParams(params) {
  const safe = {};
  Object.entries(params || {}).forEach(([key, value]) => {
    const safeKey = sanitizeName(key);
    const safeValue = sanitizeValue(value);
    if (!safeKey || safeValue === undefined) return;
    safe[safeKey] = safeValue;
  });
  return safe;
}

async function getOrCreateClientId() {
  const stored = await chrome.storage.local.get(CLIENT_ID_KEY);
  if (stored[CLIENT_ID_KEY]) return stored[CLIENT_ID_KEY];

  const clientId = `${Date.now()}.${crypto.randomUUID()}`;
  await chrome.storage.local.set({ [CLIENT_ID_KEY]: clientId });
  return clientId;
}

async function getOrCreateSession() {
  const now = Date.now();
  const stored = await chrome.storage.local.get(SESSION_KEY);
  const current = stored[SESSION_KEY];

  if (current && current.id && current.lastSeen && now - current.lastSeen < SESSION_TIMEOUT_MS) {
    const updated = { ...current, lastSeen: now };
    await chrome.storage.local.set({ [SESSION_KEY]: updated });
    return updated;
  }

  const fresh = {
    id: now,
    number: current && current.number ? current.number + 1 : 1,
    lastSeen: now,
  };

  await chrome.storage.local.set({ [SESSION_KEY]: fresh });
  return fresh;
}

function inferSenderSurface(sender) {
  if (sender && sender.tab) return 'content_script';
  if (sender && sender.url && sender.url.startsWith('chrome-extension://')) return 'extension_page';
  return 'background';
}

function classifyPageType(url) {
  try {
    const parsed = new URL(url || '');
    if (!parsed.hostname.endsWith('reddit.com')) return 'not_reddit';
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (/\/submit$/.test(path)) return 'submit';
    if (/\/r\/[^/]+\/comments\//.test(path)) return 'post';
    if (/\/r\/[^/]+(?:\/(?:hot|new|top|rising|controversial))?$/.test(path)) return 'subreddit';
    if (/^\/(hot|new|top|rising|best)?$/.test(path)) return 'home';
    if (/^\/r\/(all|popular)(?:\/(?:hot|new|top|rising))?$/.test(path)) return 'home';
    if (/\/user\//.test(path)) return 'user';
    return 'reddit_other';
  } catch (e) {
    return 'unknown';
  }
}

function isValidCheckoutUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && parsed.protocol !== 'chrome-extension:';
  } catch (e) {
    return false;
  }
}

function getCheckoutUrl() {
  const checkoutUrl = globalThis.RGCCheckoutConfig?.checkoutUrl || RGC_PADDLE_CHECKOUT_URL || '';
  const sandboxCheckoutUrl = globalThis.RGCCheckoutConfig?.sandboxCheckoutUrl || RGC_PADDLE_SANDBOX_CHECKOUT_URL || '';
  const environment = String(globalThis.RGCCheckoutConfig?.environment || '').toLowerCase();

  const candidates = environment === 'sandbox'
    ? [sandboxCheckoutUrl, checkoutUrl]
    : [checkoutUrl, sandboxCheckoutUrl];

  for (const candidate of candidates) {
    if (isValidCheckoutUrl(candidate)) return candidate;
  }

  return '';
}

async function sendAnalyticsEvent(eventName, params = {}, sender) {
  if (!isAnalyticsEnabled()) return { skipped: true, reason: 'disabled' };

  const safeName = sanitizeName(eventName);
  if (!safeName) return { skipped: true, reason: 'invalid_event' };

  const clientId = await getOrCreateClientId();
  const session = await getOrCreateSession();
  const manifest = chrome.runtime.getManifest();
  const senderUrl = sender && (sender.url || (sender.tab && sender.tab.url)) || '';

  const eventParams = sanitizeParams({
    ...params,
    surface: params.surface || inferSenderSurface(sender),
    sender_page_type: params.sender_page_type || classifyPageType(senderUrl),
    session_id: session.id,
    session_number: session.number,
    engagement_time_msec: params.engagement_time_msec || 100,
    debug_mode: GA_CONFIG.debugMode,
  });

  const payload = {
    client_id: clientId,
    user_id: clientId,
    non_personalized_ads: true,
    user_properties: {
      extension_version: { value: String(manifest.version || 'unknown') },
      extension_name: { value: String(manifest.name || 'unknown').slice(0, 36) },
      platform: { value: 'chrome_extension' },
    },
    events: [
      {
        name: safeName,
        params: eventParams,
      },
    ],
  };

  const endpoint = `${GA_CONFIG.endpoint}?measurement_id=${encodeURIComponent(GA_CONFIG.measurementId)}&api_secret=${encodeURIComponent(GA_CONFIG.apiSecret)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`GA request failed: ${response.status}`);
  }

  return { ok: true };
}

async function syncProUserStatus() {
  if (proStatusSyncPromise) return proStatusSyncPromise;

  proStatusSyncPromise = (async () => {
    try {
      const response = await fetch(BILLING_STATUS_ENDPOINT, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Billing status request failed: ${response.status}`);
      }

      const data = await response.json();
      const isPro = Boolean(data && data.isPro);
      await chrome.storage.local.set({ [PRO_USER_KEY]: isPro });
      return isPro;
    } catch (error) {
      await chrome.storage.local.set({ [PRO_USER_KEY]: false });
      return false;
    } finally {
      proStatusSyncPromise = null;
    }
  })();

  return proStatusSyncPromise;
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }

  try {
    const redditTabs = await chrome.tabs.query({ url: ['*://*.reddit.com/*'] });
    await Promise.all(redditTabs
      .filter((tab) => tab.id && canInjectIntoUrl(tab.url))
      .map((tab) => injectExtensionAssets(tab.id).catch(() => {})));
  } catch (e) {
    // ignore tab injection failures
  }

  sendAnalyticsEvent('extension_installed', {
    surface: 'background',
    install_reason: details.reason || 'unknown',
    previous_version: details.previousVersion || 'none',
  }).catch(() => {});

  syncProUserStatus().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  syncProUserStatus().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== ANALYTICS_MESSAGE_TYPE) return;

  sendAnalyticsEvent(message.eventName, message.params || {}, sender)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'RGC_OPEN_CHECKOUT') return;

  const checkoutUrl = getCheckoutUrl();
  if (!checkoutUrl) {
    sendResponse({ ok: false, error: 'Checkout is not configured yet.' });
    return;
  }

  chrome.tabs.create({ url: checkoutUrl })
    .then(() => sendResponse({ ok: true }))
    .catch(() => sendResponse({ ok: false, error: 'Could not open checkout. Please disable ad blocker or try again.' }));

  return true;
});

void syncProUserStatus();
