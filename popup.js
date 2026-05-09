// popup.js - Reddit Growth Copilot
// Minimal popup: last analysis, show panel, settings, pro CTA.

'use strict';

const CONTENT_SCRIPT_FILES = ['analytics.js', 'utils.js', 'content.js', 'opportunity.js'];
const CONTENT_CSS_FILES = ['content.css'];
const PADDLE_CHECKOUT_SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';
const PADDLE_ENVIRONMENT = 'sandbox';
const PADDLE_CLIENT_TOKEN = 'test_replace_with_your_sandbox_client_token';
const PADDLE_PRO_PRICE_ID = 'pri_replace_with_your_pro_price_id';
const PADDLE_SUCCESS_URL = 'https://example.com/paddle-success';

let paddleLoadPromise = null;
let paddleInitialized = false;

function trackPopupEvent(eventName, params) {
  try {
    return (globalThis.RGCAnalytics && globalThis.RGCAnalytics.track)
      ? globalThis.RGCAnalytics.track(eventName, { surface: 'popup', ...params })
      : Promise.resolve(false);
  } catch (e) {
    return Promise.resolve(false);
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadPaddleCheckoutScript() {
  if (globalThis.Paddle && globalThis.Paddle.Checkout && globalThis.Paddle.Checkout.open) {
    return Promise.resolve(globalThis.Paddle);
  }

  if (paddleLoadPromise) return paddleLoadPromise;

  paddleLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-rgc-paddle="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(globalThis.Paddle), { once: true });
      existingScript.addEventListener('error', () => {
        paddleLoadPromise = null;
        reject(new Error('Failed to load the payment script'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PADDLE_CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.dataset.rgcPaddle = 'true';
    script.onload = () => resolve(globalThis.Paddle);
    script.onerror = () => {
      paddleLoadPromise = null;
      reject(new Error('Failed to load the payment script'));
    };
    document.head.appendChild(script);
  });

  return paddleLoadPromise;
}

function initializePaddleCheckout() {
  if (paddleInitialized) return;
  if (!globalThis.Paddle || typeof globalThis.Paddle.Initialize !== 'function') {
    throw new Error('Payment script is unavailable');
  }

  if (globalThis.Paddle.Environment && typeof globalThis.Paddle.Environment.set === 'function') {
    globalThis.Paddle.Environment.set(PADDLE_ENVIRONMENT);
  }

  globalThis.Paddle.Initialize({
    token: PADDLE_CLIENT_TOKEN,
  });

  paddleInitialized = true;
}

async function openProCheckout() {
  await loadPaddleCheckoutScript();
  initializePaddleCheckout();

  if (!globalThis.Paddle || !globalThis.Paddle.Checkout || typeof globalThis.Paddle.Checkout.open !== 'function') {
    throw new Error('Payment script is unavailable');
  }

  globalThis.Paddle.Checkout.open({
    items: [
      {
        priceId: PADDLE_PRO_PRICE_ID,
        quantity: 1,
      },
    ],
    successUrl: PADDLE_SUCCESS_URL,
    settings: {
      displayMode: 'overlay',
    },
  });
}

function canInjectIntoTab(tab) {
  if (!tab || !tab.id || !tab.url) return false;
  try {
    const parsed = new URL(tab.url);
    return parsed.hostname.endsWith('reddit.com') && /^https?:$/.test(parsed.protocol);
  } catch (e) {
    return false;
  }
}

function classifyUrl(url) {
  if (!url) return 'not-reddit';
  let pathname;
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith('reddit.com')) return 'not-reddit';
    pathname = u.pathname.replace(/\/+$/, '') || '/';
  } catch (e) {
    return 'not-reddit';
  }

  if (/\/submit$/.test(pathname)) return 'submit';
  if (/\/r\/[^/]+\/comments\//.test(pathname)) return 'post';
  if (/\/r\/[^/]+(?:\/(?:hot|new|top|rising|controversial))?$/.test(pathname)) return 'subreddit';
  if (/^\/(hot|new|top|rising|best)?$/.test(pathname)) return 'home';
  if (/^\/r\/(all|popular)(?:\/(?:hot|new|top|rising))?$/.test(pathname)) return 'home';
  return 'reddit';
}

async function isDevMode() {
  try {
    const { rgc_dev_mode } = await chrome.storage.local.get('rgc_dev_mode');
    const isDevMode = !!rgc_dev_mode;
    globalThis.rgc_dev_mode = isDevMode;
    return isDevMode;
  } catch (e) {
    globalThis.rgc_dev_mode = false;
    return false;
  }
}

async function clearPopupCache() {
  try {
    await chrome.storage.local.remove(['rgcLastAnalysis']);
  } catch (e) {
    // Best effort only.
  }
}

async function injectContentAssets(tab) {
  if (!canInjectIntoTab(tab)) return false;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: CONTENT_CSS_FILES,
    });
  } catch (e) {
    // Ignore duplicate / restricted CSS injection errors; script injection is the critical part.
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: CONTENT_SCRIPT_FILES,
  });

  await wait(120);
  return true;
}

async function sendMessageToTab(tab, message, ensureInjected) {
  if (!tab || !tab.id) throw new Error('No active tab');

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (e) {
    if (!ensureInjected) throw e;
    await injectContentAssets(tab);
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number' && Number.isNaN(value)) return fallback;
  const text = String(value).trim();
  const lowered = text.toLowerCase();
  if (!text || lowered === 'undefined' || lowered === 'null' || lowered === 'nan') return fallback;
  return text;
}

function formatTiming(value) {
  const text = safeText(value);
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderSummary(data, summaryCard, summaryContent) {
  if (!summaryCard || !summaryContent) return;

  const score = typeof data?.score === 'number'
    ? data.score
    : typeof data?.opportunityScore === 'number'
      ? data.opportunityScore
      : null;

  if (!data || data.type !== 'opportunity' || score == null) {
    summaryCard.hidden = true;
    summaryContent.textContent = '';
    return;
  }

  const label = safeText(data.label || data.recommendation, 'Review');
  const match = formatTiming(data.match || data.matchLabel);
  const engagement = formatTiming(data.engagement || data.engagementLabel);
  const timing = formatTiming(data.timing || data.timingLabel);

  const lines = [
    '<div class="summary-line">' +
      '<span class="summary-key">Opportunity:</span>' +
      '<span class="summary-value summary-opportunity">' + escapeHtml(safeText(score, '0')) + ' — <span class="summary-recommendation">' + escapeHtml(label) + '</span></span>' +
    '</div>',
  ];

  if (match) {
    lines.push(
      '<div class="summary-line">' +
        '<span class="summary-key">Match:</span>' +
        '<span class="summary-value">' + escapeHtml(match) + '</span>' +
      '</div>'
    );
  }
  if (engagement) {
    lines.push(
      '<div class="summary-line">' +
        '<span class="summary-key">Engagement:</span>' +
        '<span class="summary-value">' + escapeHtml(engagement) + '</span>' +
      '</div>'
    );
  }
  if (timing) {
    lines.push(
      '<div class="summary-line">' +
        '<span class="summary-key">Timing:</span>' +
        '<span class="summary-value">' + escapeHtml(timing) + '</span>' +
      '</div>'
    );
  }

  summaryCard.hidden = false;
  summaryContent.innerHTML = lines.join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('togglePanelBtn');
  const panelHint = document.getElementById('panelHint');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const settingsMenu = document.getElementById('settingsMenu');
  const tutorialMenuItem = document.getElementById('tutorialMenuItem');
  const clearCacheMenuItem = document.getElementById('clearCacheMenuItem');
  const developerToolsMenuItem = document.getElementById('developerToolsMenuItem');
  const summaryCard = document.getElementById('summaryCard');
  const summaryContent = document.getElementById('summaryContent');
  let isMenuOpen = false;

  let currentTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;
  } catch (e) {
    currentTab = null;
  }

  const currentPageType = classifyUrl(currentTab ? currentTab.url : null);
  const canShowPanel = currentPageType === 'post';
  if (toggleBtn) {
    toggleBtn.disabled = !canShowPanel;
  }
  if (panelHint) {
    panelHint.hidden = canShowPanel;
  }

  void trackPopupEvent('popup_opened', {
    page_type: currentPageType,
    has_active_tab: Boolean(currentTab),
  });

  try {
    const stored = await chrome.storage.local.get('rgcLastAnalysis');
    renderSummary(stored.rgcLastAnalysis || null, summaryCard, summaryContent);
  } catch (e) {
    if (summaryCard) summaryCard.hidden = true;
  }

  const devMode = await isDevMode();
  if (developerToolsMenuItem) {
    developerToolsMenuItem.hidden = !devMode;
  }

  function closeSettingsMenu() {
    if (!settingsMenu) return;
    isMenuOpen = false;
    settingsMenu.hidden = true;
  }

  function openSettingsMenu() {
    if (!settingsMenu) return;
    isMenuOpen = true;
    settingsMenu.hidden = false;
  }

  function toggleSettingsMenu() {
    if (!settingsMenu) return;
    if (isMenuOpen) closeSettingsMenu();
    else openSettingsMenu();
  }

  closeSettingsMenu();

  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSettingsMenu();
    });
  }

  document.addEventListener('click', (event) => {
    if (!isMenuOpen) return;
    const target = event.target;
    if (!(target instanceof Node)) {
      closeSettingsMenu();
      return;
    }
    if (openSettingsBtn && openSettingsBtn.contains(target)) return;
    if (settingsMenu && settingsMenu.contains(target)) return;
    closeSettingsMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettingsMenu();
  });

  let tabUpdateListener = null;
  if (currentTab && currentTab.id && chrome.tabs && chrome.tabs.onUpdated) {
    tabUpdateListener = (tabId, changeInfo) => {
      if (tabId !== currentTab.id) return;
      if (!changeInfo.url) return;
      closeSettingsMenu();
    };
    chrome.tabs.onUpdated.addListener(tabUpdateListener);
  }

  window.addEventListener('unload', () => {
    if (tabUpdateListener && chrome.tabs && chrome.tabs.onUpdated) {
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
    }
  });

  if (tutorialMenuItem) {
    tutorialMenuItem.addEventListener('click', async () => {
      closeSettingsMenu();
      void trackPopupEvent('tutorial_opened', {
        trigger_source: 'popup_menu',
      });

      if (!currentTab || !canInjectIntoTab(currentTab)) return;
      try {
        await sendMessageToTab(currentTab, {
          type: 'RGC_SHOW_TUTORIAL',
          source: 'popup_menu',
        }, true);
      } catch (e) {
        // Best effort only.
      }
    });
  }

  if (clearCacheMenuItem) {
    clearCacheMenuItem.addEventListener('click', async () => {
      closeSettingsMenu();
      void trackPopupEvent('cache_cleared', {
        trigger_source: 'popup_menu',
      });
      await clearPopupCache();
      try {
        const stored = await chrome.storage.local.get('rgcLastAnalysis');
        renderSummary(stored.rgcLastAnalysis || null, summaryCard, summaryContent);
      } catch (e) {
        if (summaryCard) summaryCard.hidden = true;
      }
    });
  }

  if (developerToolsMenuItem) {
    developerToolsMenuItem.addEventListener('click', async () => {
      closeSettingsMenu();
      void trackPopupEvent('developer_tools_opened', {
        trigger_source: 'popup_menu',
      });

      try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('devtools.html') });
      } catch (e) {
        // Ignore; dev tools are best effort.
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', async () => {
      if (!currentTab || currentPageType !== 'post') return;

      void trackPopupEvent('panel_shown', {
        trigger_source: 'popup',
      });

      try {
        await chrome.storage.local.set({ panelVisible: true });
      } catch (e) {
        // Storage write failed - ignore.
      }

      await sendMessageToTab(currentTab, {
        type: 'RGC_TOGGLE_PANEL',
        visible: true,
        source: 'popup',
      }, true).catch(() => {
        // Safe to ignore on restricted pages; stored value still persists.
      });
    });
  }

});
