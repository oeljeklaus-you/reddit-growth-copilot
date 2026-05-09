// content.js - Reddit Growth Copilot
// Main content script. Injected into every reddit.com page.
// Manages the floating side panel, tab switching, and all feature rendering.
//
// Depends on: utils.js (loaded first via manifest content_scripts order)

'use strict';

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// CONSTANTS & SELECTORS
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const PANEL_ID = 'rgc-panel';
const ONBOARDING_STORAGE_KEY = 'rgc_tutorial_seen';
const LEGACY_ONBOARDING_STORAGE_KEY = 'rgcPanelOnboardingSeen';
const ONBOARDING_CARD_ID = 'rgc-onboarding-card';
const ONBOARDING_OVERLAY_ID = 'rgc-onboarding-overlay';
let onboardingSeenLoaded = false;
let onboardingSeen = false;
let onboardingRunning = false;
let onboardingAutoOpenTimer = null;
let onboardingTimers = [];
let onboardingStepIndex = 0;
let onboardingTutorial = null;
let onboardingKeyHandler = null;

// Reddit DOM selectors 鈥?ordered from most reliable to broadest fallback.
// Reddit ships 3+ distinct DOM layouts (old, new, shreddit/web-components).
// All queries go through safeQuery / safeQueryAll from utils.js.
const SELECTORS = {
  // 鈹€鈹€ Title input 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  // Ordered: shreddit (2024 new Reddit) 鈫?new Reddit fallbacks 鈫?old Reddit.
  //
  // The new post editor in shreddit uses a <textarea> inside a shadow-less
  // custom element. The most reliable attribute is data-testid="post-title-input"
  // or the aria-placeholder that says "Title".
  titleInput: [
    // shreddit / new Reddit (2023-24) 鈥?confirmed working
    'textarea[data-testid="post-title-input"]',
    'div[data-testid="post-title-input"] textarea',
    '[placeholder="Title"]',
    '[aria-placeholder="Title"]',
    // previous new Reddit (pre-shreddit)
    'textarea[name="title"]',
    '[data-testid="post-composer"] textarea',
    // broad fallbacks
    'textarea[placeholder*="Title" i]',
    'input[placeholder*="Title" i]',
    '#title',
    'textarea.title',
  ],

  // 鈹€鈹€ Body / text input 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
  // Reddit's rich-text body is a contenteditable <div>. Must read via
  // innerText, NOT .value 鈥?hence getRedditBody() uses innerText explicitly.
  //
  // The shreddit composer wraps the editor inside a shadow-less web component;
  // the inner contenteditable has data-testid="post-content" or role="textbox".
  bodyInput: [
    // shreddit / new Reddit (2023-24) 鈥?confirmed working
    'div[data-testid="post-content"]',
    '[data-testid="post-content"] div[contenteditable]',
    // rich-text editor (Lexical / Draft.js)
    'div[contenteditable="true"][role="textbox"]',
    'div.public-DraftEditor-content',
    'div[data-contents="true"]',
    // older new Reddit
    'div[data-testid="post-body-editor"] div[contenteditable]',
    'div.notranslate[contenteditable]',
    // markdown / old Reddit textarea
    'textarea[name="text"]',
    'textarea#text',
  ],
  // Feed post titles 鈥?tried in order: new Reddit, shreddit, old Reddit
  postFeedItems: [
    '[data-testid="post-container"] h3',
    'h3.post-title',
    '.Post h3',
    'article h3',
    '[data-click-id="body"] h3',
    'a[data-click-id="body"] h3',
    '.thing .title a.title',       // old.reddit.com
    'shreddit-post [slot="title"]', // shreddit (Web Component)
  ],
  subredditName: [
    'h1[data-testid="subreddit-name"]',
    'header h1',
    'shreddit-subreddit-header h1',
    '.subreddit-header h1',
    'h1',
  ],
};

// detectPageType() is defined in utils.js (loaded first) 鈥?not duplicated here.

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// STRING HELPERS (local, no external dependency)
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function bucketCount(value) {
  if (!value || value <= 0) return '0';
  if (value < 20) return '1_19';
  if (value < 50) return '20_49';
  if (value < 100) return '50_99';
  if (value < 200) return '100_199';
  return '200_plus';
}

function trackContentEvent(eventName, params) {
  try {
    return (globalThis.RGCAnalytics && globalThis.RGCAnalytics.track)
      ? globalThis.RGCAnalytics.track(eventName, {
          surface: 'content_panel',
          page_type: detectPageType(),
          ...params,
        })
      : Promise.resolve(false);
  } catch (e) {
    return Promise.resolve(false);
  }
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// READ REDDIT INPUTS
//
// Key points:
//  1. Title is a <textarea> on shreddit 鈥?read via .value
//  2. Body is a contenteditable <div> 鈥?MUST use .innerText, not .value
//  3. Both return { text, found } so callers can distinguish
//     "editor not in DOM yet" from "editor found but empty"
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function isVisibleTitleField(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  return Boolean(el.offsetParent !== null && rect.width > 100 && rect.height > 20);
}

function getTitleFieldTextLength(el) {
  if (!el) return 0;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    return String(el.value || '').trim().length;
  }
  return String(el.textContent || '').trim().length;
}

function matchesTitleLabel(text) {
  return /\btitle\b/i.test(text) || /标题/.test(text);
}

function getTitleFieldLabelDistance(field) {
  if (!field || typeof field.getBoundingClientRect !== 'function') return Number.POSITIVE_INFINITY;
  const fieldRect = field.getBoundingClientRect();
  const fieldTop = fieldRect.top + window.scrollY;
  const fieldLeft = fieldRect.left + window.scrollX;
  let bestDistance = Number.POSITIVE_INFINITY;

  safeQueryAll('label, [aria-label], [aria-labelledby], span, div, p').forEach((candidate) => {
    if (!candidate || candidate === field) return;
    const text = candidate.getAttribute('aria-label')
      || candidate.getAttribute('aria-labelledby')
      || (candidate.textContent || '').trim();
    if (!text || !matchesTitleLabel(text)) return;
    if (!isVisibleTitleField(candidate) && candidate.tagName !== 'LABEL') return;

    const rect = candidate.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const left = rect.left + window.scrollX;
    const distance = Math.abs(top - fieldTop) + Math.abs(left - fieldLeft);
    if (distance < bestDistance) bestDistance = distance;
  });

  return bestDistance;
}

function findRedditTitleField() {
  const selectorGroups = [
    [
      'input[name="title"]',
      'input[placeholder*="Title"]',
      'input[placeholder*="标题"]',
      'input[aria-label*="Title"]',
      'input[aria-label*="标题"]',
    ],
    [
      'textarea[name="title"]',
      'textarea[placeholder*="Title"]',
      'textarea[placeholder*="标题"]',
      'textarea[aria-label*="Title"]',
      'textarea[aria-label*="标题"]',
    ],
    [
      '[contenteditable="true"][aria-label*="Title"]',
      '[contenteditable="true"][aria-label*="标题"]',
      '[role="textbox"][contenteditable="true"]',
    ],
  ];

  for (const selectors of selectorGroups) {
    for (const selector of selectors) {
      const field = safeQuery(selector);
      if (field && isVisibleTitleField(field)) {
        return field;
      }
    }
  }

  const candidates = [];
  safeQueryAll('input, textarea, [contenteditable="true"]').forEach((field) => {
    if (!field || !isVisibleTitleField(field)) return;
    const rect = field.getBoundingClientRect();
    if (getTitleFieldTextLength(field) >= 300) return;
    if (rect.top > window.innerHeight * 0.75) return;
    candidates.push(field);
  });

  if (!candidates.length) return null;

  let bestField = null;
  let bestScore = Number.POSITIVE_INFINITY;
  candidates.forEach((field) => {
    const labelDistance = getTitleFieldLabelDistance(field);
    const rect = field.getBoundingClientRect();
    const score = labelDistance !== Number.POSITIVE_INFINITY
      ? labelDistance
      : (rect.top + window.scrollY);
    if (score < bestScore) {
      bestScore = score;
      bestField = field;
    }
  });

  if (bestField) {
  }
  return bestField;
}

function getRedditTitle() {
  const el = findRedditTitleField();
  if (!el) {
    globalThis.rgcWarn?.('title field not found');
    return { text: '', found: false };
  }
  // input/textarea use .value; contenteditable uses textContent.
  const text = (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')
    ? (el.value || '').trim()
    : (el.textContent || '').trim();
  return { text, found: true };
}

function getRedditBody() {
  const el = safeQuery(SELECTORS.bodyInput);
  if (!el) {
    return { text: '', found: false };
  }
  // contenteditable <div> 鈥?innerText is the only reliable way to read
  // the user's visible text (Draft.js / Lexical store formatting in data-*)
  let text;
  if (el.tagName === 'TEXTAREA') {
    text = (el.value || '').trim();
  } else {
    // innerText respects CSS display:none and <br> line-breaks correctly
    text = (el.innerText || el.textContent || '').trim();
  }
  return { text, found: true };
}

function dispatchEditorEvents(el) {
  ['input', 'change', 'blur'].forEach(type => {
    el.dispatchEvent(new Event(type, { bubbles: true }));
  });
}

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

function setElementText(el, text) {
  if (!el) return false;

  try {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.focus();
      const setter = el.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;
      if (setter) setter.call(el, text);
      else el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      el.focus();
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  } catch (e) {
    return false;
  }

  return false;
}

function applySuggestedTitle(text) {
  const titleEl = findRedditTitleField();
  if (!titleEl) return false;
  const ok = setElementText(titleEl, text);
  return ok;
}

async function hasSeenOnboarding() {
  if (onboardingSeenLoaded) return onboardingSeen;
  try {
    const stored = await chrome.storage.local.get([ONBOARDING_STORAGE_KEY, LEGACY_ONBOARDING_STORAGE_KEY]);
    onboardingSeen = stored[ONBOARDING_STORAGE_KEY] === true || stored[LEGACY_ONBOARDING_STORAGE_KEY] === true;
    if (onboardingSeen && stored[ONBOARDING_STORAGE_KEY] !== true) {
      await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: true });
    }
  } catch (e) {
    onboardingSeen = false;
  }
  onboardingSeenLoaded = true;
  return onboardingSeen;
}

async function markOnboardingSeen() {
  onboardingSeen = true;
  onboardingSeenLoaded = true;
  try {
    await chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: true });
  } catch (e) {
    // safe to ignore
  }
}

async function resetOnboardingState() {
  onboardingSeen = false;
  onboardingSeenLoaded = true;
  try {
    await chrome.storage.local.remove([ONBOARDING_STORAGE_KEY, LEGACY_ONBOARDING_STORAGE_KEY]);
  } catch (e) {
    // safe to ignore
  }
}

function clearOnboardingTimers() {
  onboardingTimers.forEach(timer => clearTimeout(timer));
  onboardingTimers = [];
}

function clearOnboardingAutoOpenTimer() {
  if (onboardingAutoOpenTimer) {
    clearTimeout(onboardingAutoOpenTimer);
    onboardingAutoOpenTimer = null;
  }
}

function syncCollapseButton(isCollapsed) {
  const btn = document.getElementById('rgc-collapse-btn');
  if (!btn) return;
  btn.textContent  = isCollapsed ? '+' : '−';
  btn.title        = isCollapsed ? 'Expand panel' : 'Collapse panel';
  btn.setAttribute('aria-label', isCollapsed ? 'Expand panel' : 'Collapse panel');
}

function getOnboardingTutorial(pageType) {
  if (pageType === 'submit') {
    return {
      key: 'submit',
      title: 'Quick start',
      intro: 'Use the panel to polish a post before you publish it.',
      steps: [
        {
          tab: 'titles',
          selector: '#rgc-drag-handle',
          label: 'Step 1',
          description: 'Find the panel',
        },
        {
          tab: 'titles',
          selector: '#rgc-gen-titles-btn',
          label: 'Step 2',
          description: 'Generate title options',
        },
        {
          tab: 'score',
          selector: '#rgc-score-btn',
          label: 'Step 3',
          description: 'Check the draft score',
        },
        {
          tab: 'subreddit',
          selector: '#rgc-pane-subreddit .rgc-hint',
          label: 'Step 4',
          description: 'Learn the feed style',
        },
      ],
    };
  }

  if (pageType === 'subreddit' || pageType === 'home') {
    return {
      key: pageType,
      title: 'Quick start',
      intro: 'Use the panel to spot what this feed rewards.',
      steps: [
        {
          tab: 'subreddit',
          selector: '#rgc-drag-handle',
          label: 'Step 1',
          description: 'Open the panel',
        },
        {
          tab: 'subreddit',
          selector: '#rgc-analyze-sub-btn',
          label: 'Step 2',
          description: 'Analyze the feed',
        },
        {
          tab: 'titles',
          selector: '#rgc-pane-titles .rgc-empty-text',
          label: 'Step 3',
          description: 'Use title ideas later',
        },
        {
          tab: 'score',
          selector: '#rgc-pane-score .rgc-empty-text',
          label: 'Step 4',
          description: 'Check the draft before posting',
        },
      ],
    };
  }

  if (pageType === 'post') {
    return {
      key: 'post',
      title: 'Quick start',
      intro: 'Use the panel to decide if this Reddit thread deserves a reply.',
      steps: [
        {
          tab: 'subreddit',
          selector: '#rgc-drag-handle',
          label: 'Step 1',
          description: 'Check the recommendation',
        },
        {
          tab: 'subreddit',
          selector: '#rgc-analyze-sub-btn',
          label: 'Step 2',
          description: 'Read the reason',
        },
        {
          tab: 'score',
          selector: '#rgc-pane-score .rgc-empty-text',
          label: 'Step 3',
          description: 'Use the suggested angle',
        },
        {
          tab: 'titles',
          selector: '#rgc-pane-titles .rgc-empty-text',
          label: 'Step 4',
          description: 'Reply faster',
        },
      ],
    };
  }

  return {
    key: 'other',
    title: 'Quick start',
    intro: 'Use the panel to understand the current Reddit page.',
    steps: [
      {
        tab: 'titles',
        selector: '#rgc-drag-handle',
        label: 'Step 1',
        description: 'Open the panel',
      },
      {
        tab: 'subreddit',
        selector: '#rgc-pane-subreddit .rgc-empty-text',
        label: 'Step 2',
        description: 'Scan the feed later',
      },
      {
        tab: 'titles',
        selector: '#rgc-pane-titles .rgc-empty-text',
        label: 'Step 3',
        description: 'Use title help on post pages',
      },
    ],
  };
}

function removeOnboardingCard() {
  clearOnboardingAutoOpenTimer();
  clearOnboardingTimers();
  onboardingRunning = false;
  onboardingTutorial = null;
  onboardingStepIndex = 0;

  const card = document.getElementById(ONBOARDING_CARD_ID);
  if (card) card.remove();

  const overlay = document.getElementById(ONBOARDING_OVERLAY_ID);
  if (overlay) overlay.remove();

  const panel = document.getElementById(PANEL_ID);
  if (panel) {
    panel.classList.remove('rgc-onboarding-active', 'rgc-onboarding-enter');
    panel.querySelectorAll('.rgc-tour-focus').forEach((el) => el.classList.remove('rgc-tour-focus'));
    const pointer = panel.querySelector('.rgc-onboarding-pointer');
    if (pointer) pointer.remove();
  }

  if (onboardingKeyHandler) {
    document.removeEventListener('keydown', onboardingKeyHandler);
    onboardingKeyHandler = null;
  }
}

function resolveOnboardingTarget(panel, step) {
  const tabEl = step.tab ? panel.querySelector(`.rgc-tab[data-tab="${step.tab}"]`) : null;
  const primary = step.selector ? panel.querySelector(step.selector) : null;
  return {
    tabEl,
    primary: primary || tabEl,
  };
}

function positionOnboardingPointer(panel, target) {
  const pointer = panel.querySelector('.rgc-onboarding-pointer');
  if (!pointer) return;

  if (!target) {
    pointer.style.opacity = '0';
    return;
  }

  const panelRect = panel.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const centerY = targetRect.top - panelRect.top + (targetRect.height / 2);
  const boundedY = Math.max(84, Math.min(centerY, panelRect.height - 42));
  pointer.style.top = `${boundedY}px`;
  pointer.style.opacity = '1';
}

function updateOnboardingStep(stepIndex) {
  const panel = document.getElementById(PANEL_ID);
  const card = document.getElementById(ONBOARDING_CARD_ID);
  if (!panel || !card || !onboardingTutorial || !onboardingTutorial.steps[stepIndex]) return;

  onboardingStepIndex = stepIndex;
  const step = onboardingTutorial.steps[stepIndex];

  switchTab(step.tab);
  const body = panel.querySelector('.rgc-body');
  const { tabEl, primary } = resolveOnboardingTarget(panel, step);

  panel.querySelectorAll('.rgc-tour-focus').forEach((el) => el.classList.remove('rgc-tour-focus'));
  if (tabEl) tabEl.classList.add('rgc-tour-focus');
  if (primary && primary !== tabEl) primary.classList.add('rgc-tour-focus');
  if (primary && typeof primary.scrollIntoView === 'function') {
    primary.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else if (body) {
    body.scrollTop = 0;
  }

  requestAnimationFrame(() => positionOnboardingPointer(panel, primary));

  const intro = card.querySelector('.rgc-onboarding-subtitle');
  const stepTitle = card.querySelector('.rgc-onboarding-step-title');
  const stepDesc = card.querySelector('.rgc-onboarding-step-desc');
  const nextBtn = card.querySelector('.rgc-onboarding-next');
  if (intro) intro.textContent = safeText(onboardingTutorial.intro);
  if (stepTitle) stepTitle.textContent = safeText(step.label);
  if (stepDesc) stepDesc.textContent = safeText(step.description);
  if (nextBtn) nextBtn.textContent = 'Next';

  void trackContentEvent('panel_onboarding_step_shown', {
    step_index: stepIndex + 1,
    step_name: step.label,
    tutorial_key: onboardingTutorial.key,
    page_type: detectPageType(),
  });
}

function finishOnboarding(reason) {
  const tutorialKey = onboardingTutorial ? onboardingTutorial.key : 'unknown';
  removeOnboardingCard();
  void markOnboardingSeen();
  void trackContentEvent('panel_onboarding_dismissed', {
    reason: reason || 'done',
    tutorial_key: tutorialKey,
    page_type: detectPageType(),
  });
}

function goToNextOnboardingStep() {
  if (!onboardingTutorial) return;
  if (onboardingStepIndex >= onboardingTutorial.steps.length - 1) {
    finishOnboarding('completed');
    return;
  }
  updateOnboardingStep(onboardingStepIndex + 1);
}

function goToPreviousOnboardingStep() {
  if (!onboardingTutorial || onboardingStepIndex <= 0) return;
  updateOnboardingStep(onboardingStepIndex - 1);
}

async function maybeStartOnboarding(triggerSource, force) {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || panel.classList.contains('rgc-hidden')) return;
  if (onboardingRunning) {
    if (!force) return;
    removeOnboardingCard();
  }
  if (!force && await hasSeenOnboarding()) return;

  onboardingRunning = true;
  onboardingTutorial = getOnboardingTutorial(detectPageType());

  panel.classList.remove('rgc-collapsed');
  panel.classList.add('rgc-onboarding-active', 'rgc-onboarding-enter');
  syncCollapseButton(false);

  const body = panel.querySelector('.rgc-body');
  if (!body) {
    onboardingRunning = false;
    return;
  }
  body.scrollTop = 0;

  const overlay = document.createElement('div');
  overlay.id = ONBOARDING_OVERLAY_ID;
  overlay.addEventListener('click', () => finishOnboarding('overlay_click'));
  document.body.appendChild(overlay);

  const card = document.createElement('div');
  card.id = ONBOARDING_CARD_ID;
  card.className = 'rgc-onboarding-card';
  card.innerHTML = `
    <div class="rgc-onboarding-title">${escapeHtml(onboardingTutorial.title)}</div>
    <div class="rgc-onboarding-subtitle"></div>
    <div class="rgc-onboarding-step-title"></div>
    <div class="rgc-onboarding-step-desc"></div>
    <div class="rgc-onboarding-footer">
      <div class="rgc-onboarding-actions">
        <button class="rgc-onboarding-skip" type="button">Skip</button>
        <button class="rgc-onboarding-next" type="button">Next</button>
      </div>
    </div>
  `;

  document.body.appendChild(card);

  const pointer = document.createElement('div');
  pointer.className = 'rgc-onboarding-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  pointer.textContent = '看这里 →';
  panel.appendChild(pointer);

  const skipBtn = card.querySelector('.rgc-onboarding-skip');
  const nextBtn = card.querySelector('.rgc-onboarding-next');
  if (skipBtn) skipBtn.addEventListener('click', () => finishOnboarding('skip_button'));
  if (nextBtn) nextBtn.addEventListener('click', goToNextOnboardingStep);

  onboardingKeyHandler = (event) => {
    if (!onboardingRunning) return;
    if (event.key === 'Escape') finishOnboarding('escape_key');
    if (event.key === 'ArrowRight' || event.key === 'Enter') goToNextOnboardingStep();
    if (event.key === 'ArrowLeft') goToPreviousOnboardingStep();
  };
  document.addEventListener('keydown', onboardingKeyHandler);

  updateOnboardingStep(0);
  onboardingTimers.push(setTimeout(() => {
    panel.classList.remove('rgc-onboarding-enter');
  }, 900));

  void trackContentEvent('panel_onboarding_shown', {
    trigger_source: triggerSource || 'auto',
    tutorial_key: onboardingTutorial.key,
    page_type: detectPageType(),
  });
}

async function requestOnboarding(triggerSource, options = {}) {
  const { auto = false, force = false } = options;
  const panel = document.getElementById(PANEL_ID);
  if (!panel || panel.classList.contains('rgc-hidden')) return false;

  const pageType = detectPageType();
  if (pageType !== 'post') return false;

  if (auto) {
    if (onboardingAutoOpenTimer || onboardingRunning) return false;
    if (await hasSeenOnboarding()) return false;

    await markOnboardingSeen();
    onboardingAutoOpenTimer = setTimeout(() => {
      onboardingAutoOpenTimer = null;
      if (detectPageType() !== 'post') return;
      const currentPanel = document.getElementById(PANEL_ID);
      if (!currentPanel || currentPanel.classList.contains('rgc-hidden')) return;
      if (onboardingRunning) return;
      void maybeStartOnboarding(triggerSource || 'initial_auto_open', true);
    }, 800);
    return true;
  }

  if (!force && await hasSeenOnboarding()) return false;
  return maybeStartOnboarding(triggerSource, true);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// PANEL HTML BUILD
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function buildPanel() {
  const pageType = detectPageType();
  const defaultTab = getDefaultTabForPageType(pageType);
  const tabState = getTabStateForPageType(pageType);
  const pageLabel = pageType === 'submit'
    ? 'Editor'
    : pageType === 'subreddit'
      ? 'Subreddit'
      : pageType === 'post'
        ? 'Detail'
        : pageType === 'home'
        ? 'Home'
        : 'Reddit';
  const panelStatus = getPanelStatusCopy(pageType);

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Reddit Growth Copilot');

  panel.innerHTML = `
    <!-- 鈹€鈹€ Header 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
    <div class="rgc-header" id="rgc-drag-handle">
      <div class="rgc-header-left">
        <span class="rgc-logo" aria-hidden="true">🚀</span>
        <div class="rgc-header-copy">
          <div class="rgc-title">Growth Copilot</div>
          <div class="rgc-subtitle">Titles · Score · Subreddit</div>
        </div>
      </div>
      <div class="rgc-header-badge">${pageLabel}</div>
      <div class="rgc-header-controls">
        <button class="rgc-icon-btn" id="rgc-collapse-btn" title="Collapse panel" aria-label="Collapse panel">−</button>
        <button class="rgc-icon-btn" id="rgc-close-btn" title="Hide panel" aria-label="Hide panel">×</button>
      </div>
    </div>

    <!-- 鈹€鈹€ Tab Bar 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
    <div class="rgc-tabs" role="tablist">
      <button class="rgc-tab ${defaultTab === 'titles' ? 'rgc-active' : ''} ${tabState.titles.muted ? 'rgc-tab--muted' : ''}" data-tab="titles" role="tab" aria-selected="${defaultTab === 'titles' ? 'true' : 'false'}">
        <span class="tab-icon" aria-hidden="true">✍️</span>
        <span>Titles</span>
      </button>
      <button class="rgc-tab ${defaultTab === 'score' ? 'rgc-active' : ''} ${tabState.score.muted ? 'rgc-tab--muted' : ''}" data-tab="score" role="tab" aria-selected="${defaultTab === 'score' ? 'true' : 'false'}">
        <span class="tab-icon" aria-hidden="true">📊</span>
        <span>Score</span>
      </button>
      <button class="rgc-tab ${defaultTab === 'subreddit' ? 'rgc-active' : ''} ${tabState.subreddit.muted ? 'rgc-tab--muted' : ''}" data-tab="subreddit" role="tab" aria-selected="${defaultTab === 'subreddit' ? 'true' : 'false'}">
        <span class="tab-icon" aria-hidden="true">📚</span>
        <span>Subreddit</span>
      </button>
    </div>

    ${pageType === 'post' ? '' : `
      <div class="rgc-panel-status">
        <div class="rgc-panel-status-chip">${panelStatus.kicker}</div>
        <div class="rgc-panel-status-text">${panelStatus.text}</div>
      </div>
    `}

    <!-- 鈹€鈹€ Panel Body 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ -->
    <div class="rgc-body">

      <!-- TAB: Title Suggestions -->
      <div class="rgc-tab-pane ${defaultTab === 'titles' ? 'rgc-active' : ''}" id="rgc-pane-titles" role="tabpanel">
        ${buildTitlesPane(pageType)}
      </div>

      <!-- TAB: Content Score -->
      <div class="rgc-tab-pane ${defaultTab === 'score' ? 'rgc-active' : ''}" id="rgc-pane-score" role="tabpanel">
        ${buildScorePane(pageType)}
      </div>

      <!-- TAB: Subreddit Analysis -->
      <div class="rgc-tab-pane ${defaultTab === 'subreddit' ? 'rgc-active' : ''}" id="rgc-pane-subreddit" role="tabpanel">
        ${buildSubredditPane(pageType)}
      </div>

    </div>
  `;

  return panel;
}

// 鈹€鈹€ Pane templates 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function buildTitlesPane(pageType) {
  if (pageType === 'submit') {
    return `
      <div class="rgc-card rgc-tool-card rgc-tool-card--titles">
        <div class="rgc-tool-eyebrow">Title workflow</div>
        <div class="rgc-tool-title">Turn one rough title into 3 sharper versions</div>
        <p class="rgc-hint rgc-tool-hint">Generate cleaner hooks, then copy or apply one directly into the Reddit title box.</p>
        <div class="rgc-tool-tags">
          <span class="rgc-tool-tag">Better hook</span>
          <span class="rgc-tool-tag">Cleaner angle</span>
          <span class="rgc-tool-tag">1-click apply</span>
        </div>
        <button class="rgc-btn rgc-btn-primary" id="rgc-gen-titles-btn">✍️ Optimize Title</button>
      </div>
      <div id="rgc-titles-result"></div>
    `;
  }
  const copy = pageType === 'post'
    ? {
        title: 'Title Optimizer',
        text: 'This post is already published, so title rewriting is not available here.',
        helper: 'Open a Create Post page to generate new title options.',
      }
    : {
        title: 'Title Optimizer',
        text: 'Available on Reddit create-post pages.',
        helper: 'Open any subreddit, then choose Create Post.',
      };
  return buildLightNote(copy.title, copy.text, copy.helper);
}

function getPanelStatusCopy(pageType) {
  if (pageType === 'submit') {
    return {
      kicker: 'Editor live',
      text: 'Optimize the title, check the draft, and post with a clearer angle.',
    };
  }

  if (pageType === 'subreddit' || pageType === 'home') {
    return {
      kicker: 'Research mode',
      text: 'Scan what already performs well here before you decide what to write next.',
    };
  }

  if (pageType === 'post') {
    return {
      kicker: 'Review mode',
      text: 'Use the score and subreddit signals to decide if this conversation is worth entering.',
    };
  }

  return {
    kicker: 'Copilot ready',
    text: 'Open a subreddit, thread, or post editor to unlock the most useful workflows.',
  };
}

function buildScorePane(pageType) {
  if (pageType === 'submit') {
    return `
      <div class="rgc-card rgc-tool-card rgc-tool-card--score">
        <div class="rgc-tool-eyebrow">Draft quality</div>
        <div class="rgc-tool-title">Check if this post is ready before you publish</div>
        <p class="rgc-hint rgc-tool-hint">Score your title and body with lightweight local rules, then fix the biggest issues first.</p>
        <div class="rgc-tool-tags">
          <span class="rgc-tool-tag">Title quality</span>
          <span class="rgc-tool-tag">Body clarity</span>
          <span class="rgc-tool-tag">Actionable fixes</span>
        </div>
        <button class="rgc-btn rgc-btn-primary" id="rgc-score-btn">📊 Analyze Post</button>
      </div>
      <div id="rgc-score-result"></div>
    `;
  }
  const copy = pageType === 'post'
    ? {
        title: 'Content Score',
        text: 'Score is meant for drafts, so a published post does not have anything to analyze here.',
        helper: 'Open the editor to check draft quality before you publish.',
      }
    : {
        title: 'Content Score',
        text: 'Start writing a draft to see score signals.',
        helper: 'Open a post editor to surface score checks.',
      };
  return buildLightNote(copy.title, copy.text, copy.helper);
}

function getScoreDecision(score) {
  if (score >= 80) {
    return {
      key: 'ready',
      label: 'Ready to post',
      headline: 'Your draft is already strong',
      summary: 'You likely only need light polish before publishing.',
    };
  }

  if (score >= 65) {
    return {
      key: 'close',
      label: 'Close, improve first',
      headline: 'Promising draft, but a few fixes will help',
      summary: 'Tighten the weak spots before you publish.',
    };
  }

  return {
    key: 'rework',
    label: 'Needs rework',
    headline: 'This draft is likely underprepared',
    summary: 'Fix the major gaps first so the post has a better chance.',
  };
}

function buildContentChecks(title, body) {
  const titleLength = title.trim().length;
  const bodyLength = body.trim().length;
  const lowerText = `${title} ${body}`.toLowerCase();
  const hasHook = /\?$/.test(title.trim()) || /\?$/.test(body.trim()) || /(what do you think|thoughts\??|anyone else|have you|do you)/i.test(lowerText);
  const hasParagraphs = bodyLength > 0 && (body.includes('\n') || bodyLength < 260);

  const titleState = titleLength >= 40 && titleLength <= 90
    ? 'positive'
    : titleLength >= 20 && titleLength <= 140
      ? 'warn'
      : 'bad';

  const bodyState = bodyLength >= 220
    ? 'positive'
    : bodyLength >= 80
      ? 'warn'
      : 'bad';

  return [
    {
      label: 'Title length',
      value: `${titleLength} chars`,
      state: titleState,
      help: titleState === 'positive' ? 'Strong headline range' : 'Aim for roughly 40–90 characters',
    },
    {
      label: 'Body depth',
      value: bodyLength ? `${bodyLength} chars` : 'No body',
      state: bodyState,
      help: bodyState === 'positive' ? 'Enough context to invite replies' : 'Add more context or examples',
    },
    {
      label: 'Discussion hook',
      value: hasHook ? 'Present' : 'Missing',
      state: hasHook ? 'positive' : 'bad',
      help: hasHook ? 'Gives readers a reason to respond' : 'End with a question or opinion prompt',
    },
    {
      label: 'Readability',
      value: hasParagraphs ? 'Easy to scan' : 'Dense block',
      state: hasParagraphs ? 'positive' : 'warn',
      help: hasParagraphs ? 'Readable structure' : 'Break long text into shorter paragraphs',
    },
  ];
}

function buildScoreWins(title, body, checks) {
  const wins = [];

  if (checks[0] && checks[0].state === 'positive') {
    wins.push('The title is already within a strong readability range.');
  }
  if (checks[1] && checks[1].state === 'positive') {
    wins.push('The post body has enough depth to give readers context.');
  }
  if (checks[2] && checks[2].state === 'positive') {
    wins.push('The draft includes a discussion hook that can invite comments.');
  }
  if (checks[3] && checks[3].state === 'positive') {
    wins.push('The structure is easy to scan quickly on Reddit.');
  }

  if (!wins.length && title.trim()) {
    wins.push('You already have a concrete starting draft instead of a blank post.');
  }
  if (wins.length < 2 && body.trim().length > 0) {
    wins.push('There is enough material here to improve quickly with a few edits.');
  }
  if (wins.length < 3) {
    wins.push('A couple focused changes could move this draft up fast.');
  }

  return wins.slice(0, 3);
}

function buildSubredditPane(pageType) {
  // Enable on the Reddit surfaces where we can still use the surrounding
  // subreddit context. 'user' and 'other' stay unsupported.
  const enabled = (pageType === 'subreddit' || pageType === 'home' || pageType === 'post' || pageType === 'submit');
  const sidebarNote = pageType === 'submit'
    ? 'Use this tab to review the surrounding subreddit before you publish.'
    : 'Scan the feed to surface the patterns, topics, and tone that work here.';
  const ctaLabel = pageType === 'submit' || pageType === 'post'
    ? 'Analyze This Page'
    : 'Analyze This Feed';
  let hintMsg = '';
  if (!enabled) {
    if (pageType === 'user') {
      hintMsg = 'Navigate to a subreddit feed to use this tool.';
    } else {
      hintMsg = 'Navigate to a subreddit or the Reddit home feed to use this tool.';
    }
  }
  return `
    <div class="rgc-subreddit-sidebar">
      <div class="rgc-subreddit-sidebar-title">Subreddit Insights</div>
      <div class="rgc-subreddit-sidebar-note">${sidebarNote}</div>
      <button class="rgc-btn rgc-btn-primary rgc-subreddit-cta" id="rgc-analyze-sub-btn"
        ${enabled ? '' : 'disabled'}>
        ${ctaLabel}
      </button>
      ${!enabled ? `<div class="rgc-subreddit-disabled">${hintMsg}</div>` : ''}
      <div id="rgc-sub-result"></div>
    </div>
  `;
}

function buildLightNote(title, text, helper) {
  const safeTitle = safeText(title);
  const safeBody = safeText(text);
  const safeHelper = safeText(helper);
  return `
    <div class="rgc-light-note" role="note" aria-label="${escapeAttr(safeTitle)}">
      ${safeTitle ? `<div class="rgc-light-note-title">${escapeHtml(safeTitle)}</div>` : ''}
      ${safeBody ? `<div class="rgc-light-note-text">${escapeHtml(safeBody)}</div>` : ''}
      ${safeHelper ? `<div class="rgc-light-note-helper">${escapeHtml(safeHelper)}</div>` : ''}
    </div>
  `;
}

function getTabStateForPageType(pageType) {
  const isSubmit = pageType === 'submit';
  const isPost = pageType === 'post';
  const isFeed = pageType === 'subreddit' || pageType === 'home';

  return {
    titles: {
      muted: !isSubmit,
    },
    score: {
      muted: !(isSubmit || isPost),
    },
    subreddit: {
      muted: !(isSubmit || isPost || isFeed),
    },
  };
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// INJECT / REMOVE PANEL
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function injectPanel() {
  // Guard: do not inject twice
  if (document.getElementById(PANEL_ID)) return;

  const panel = buildPanel();
  document.body.appendChild(panel);

  attachPanelEvents(panel);
  makeDraggable(panel, document.getElementById('rgc-drag-handle'));
}

function removePanel() {
  removeOnboardingCard();
  const existing = document.getElementById(PANEL_ID);
  if (existing) existing.remove();
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// PANEL VISIBILITY
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function showPanel() {
  const p = document.getElementById(PANEL_ID);
  if (!p) return;
  p.classList.remove('rgc-hidden');
  p.classList.remove('rgc-collapsed');
  syncCollapseButton(false);
  try { chrome.storage.local.set({ panelVisible: true }); } catch (e) {}
}

function hidePanel(source) {
  const p = document.getElementById(PANEL_ID);
  if (!p) return;
  clearOnboardingAutoOpenTimer();
  if (onboardingRunning) finishOnboarding('panel_hidden');
  p.classList.add('rgc-hidden');
  try { chrome.storage.local.set({ panelVisible: false }); } catch (e) {}
  void trackContentEvent('panel_visibility_changed', {
    visible: false,
    trigger_source: source || 'content_panel',
  });
}

function showPanelWithTracking(source) {
  const p = document.getElementById(PANEL_ID);
  if (!p) return;
  const wasHidden = p.classList.contains('rgc-hidden');
  showPanel();
  if (wasHidden) {
    void trackContentEvent('panel_visibility_changed', {
      visible: true,
      trigger_source: source || 'content_panel',
    });
  }
}

function collapsePanel(source) {
  const p   = document.getElementById(PANEL_ID);
  if (!p) return;
  const isCollapsed = p.classList.toggle('rgc-collapsed');
  syncCollapseButton(isCollapsed);
  if (isCollapsed && onboardingRunning) finishOnboarding('panel_collapsed');
  void trackContentEvent('panel_collapse_changed', {
    collapsed: isCollapsed,
    trigger_source: source || 'content_panel',
  });
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// TAB SWITCHING
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function switchTab(tabName) {
  const activeTab = document.querySelector('.rgc-tab.rgc-active');
  const previousTab = activeTab ? activeTab.getAttribute('data-tab') : 'unknown';
  document.querySelectorAll('.rgc-tab').forEach(t => {
    const isActive = t.getAttribute('data-tab') === tabName;
    t.classList.toggle('rgc-active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.rgc-tab-pane').forEach(p => {
    p.classList.toggle('rgc-active', p.id === `rgc-pane-${tabName}`);
  });
  if (tabName !== previousTab) {
    void trackContentEvent('panel_tab_switched', {
      tab_name: tabName,
      previous_tab: previousTab,
    });
  }
}

function getTitleSuggestionStrategy(style) {
  const key = String(style || '').toLowerCase();
  if (key.includes('question')) {
    return {
      kicker: 'Conversation-first',
      why: 'Best when you want more replies and opinions instead of passive views.',
    };
  }
  if (key.includes('story')) {
    return {
      kicker: 'Personal angle',
      why: 'Best when experience and relatability will make the post feel more human.',
    };
  }
  return {
    kicker: 'Specificity boost',
    why: 'Best when you want the title to feel more concrete and credible at a glance.',
  };
}

function buildSubredditPlaybook(patterns, avgLen) {
  const dominantPattern = patterns?.dominantPattern || 'other';
  return [
    {
      title: 'Top post type',
      text: dominantPattern === 'personal'
        ? 'Personal / Discussion'
        : dominantPattern === 'data'
          ? 'Data / Question'
          : 'Question / Discussion',
    },
    {
      title: 'Best length',
      text: '80–140 characters',
    },
    {
      title: 'Tone',
      text: 'Helpful, honest, practical',
    },
    {
      title: 'Avoid',
      text: 'Self-promo, vague claims',
    },
  ];
}

function buildTitleTemplates(patterns, avgLen) {
  const dominantPattern = patterns?.dominantPattern || 'other';
  const isQuestionHeavy = dominantPattern === 'question';
  const isPersonal = dominantPattern === 'personal';
  const isDataLed = dominantPattern === 'data';
  const concise = avgLen <= 60;

  const templates = [
    isQuestionHeavy
      ? 'How do you handle [specific problem] without [bad outcome]?'
      : 'How do you handle [specific problem] in [your context]?',
    isPersonal
      ? 'I built [thing] because [pain] - would this be useful?'
      : isDataLed
        ? 'I tested [thing] and got [result] - would this help anyone else?'
        : 'I tried [thing] because [pain] - did it work for anyone else?',
    concise
      ? 'Struggling with [problem]. What actually worked for you?'
      : 'Struggling with [problem] in [context]. What actually worked for you?',
  ];

  return templates.slice(0, 3);
}

function buildSubredditAnalysisHtml(summaryLines, topics, patterns, evidenceLine) {
  const summaryTitle = safeText(summaryLines?.[0], 'Clear, practical posts tend to work best here.');
  const summaryBody = safeText(summaryLines?.[1], 'Scan recent posts to understand what this community responds to.');
  const summaryEvidence = safeText(summaryLines?.[2], evidenceLine);
  const topicPills = (Array.isArray(topics) ? topics : [])
    .map((topic) => safeText(topic))
    .filter(Boolean)
    .slice(0, 6);
  const patternRows = (Array.isArray(patterns) ? patterns : [])
    .map((item) => {
      const label = safeText(item?.label ?? item?.title);
      const value = safeText(item?.value ?? item?.text);
      if (!label || !value) return null;
      return { label, value };
    })
    .filter(Boolean);

  return `
    <div class="rgc-subreddit-analysis">
      <section class="rgc-subreddit-analysis-card rgc-subreddit-analysis-card--summary">
        <div class="rgc-subreddit-analysis-title">Summary</div>
        <div class="rgc-subreddit-analysis-main">${escapeHtml(summaryTitle)}</div>
        <div class="rgc-subreddit-analysis-muted">${escapeHtml(summaryBody)}</div>
        ${summaryEvidence ? `<div class="rgc-subreddit-analysis-muted">${escapeHtml(summaryEvidence)}</div>` : ''}
      </section>

      <section class="rgc-subreddit-analysis-card">
        <div class="rgc-subreddit-analysis-title">Topics that work</div>
        ${
          topicPills.length
            ? `<div class="rgc-subreddit-pill-row">${topicPills.map((topic) => `<span class="rgc-subreddit-pill">${escapeHtml(topic)}</span>`).join('')}</div>`
            : `<div class="rgc-subreddit-analysis-muted">Analyze this page to detect topics.</div>`
        }
      </section>

      <section class="rgc-subreddit-analysis-card">
        <div class="rgc-subreddit-analysis-title">Common patterns</div>
        ${
          patternRows.length
            ? `<div class="rgc-subreddit-pattern-list">${patternRows.map((item, index) => `
                <div class="rgc-subreddit-pattern-row${index === patternRows.length - 1 ? ' rgc-subreddit-pattern-row--last' : ''}">
                  <div class="rgc-subreddit-pattern-label">${escapeHtml(item.label)}</div>
                  <div class="rgc-subreddit-pattern-value">${escapeHtml(item.value)}</div>
                </div>
              `).join('')}</div>`
            : `<div class="rgc-subreddit-analysis-muted">No pattern data yet. Analyze this page first.</div>`
        }
      </section>
    </div>
  `;
}

function safeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number' && Number.isNaN(value)) return fallback;
  const text = String(value).trim();
  const lowered = text.toLowerCase();
  if (!text || lowered === 'undefined' || lowered === 'null' || lowered === 'nan') return fallback;
  return text;
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// FEATURE 2: TITLE SUGGESTIONS
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function renderTitleSuggestions() {
  const resultEl = document.getElementById('rgc-titles-result');
  if (!resultEl) return;

  const { text: title, found: titleFound } = getRedditTitle();
  void trackContentEvent('title_optimize_requested', {
    title_found: titleFound,
    title_length_bucket: bucketCount(title.length),
  });

  // Distinguish "editor not in DOM" from "editor exists but user typed nothing"
  if (!titleFound) {
    void trackContentEvent('title_optimize_unavailable', {
      reason: 'editor_not_found',
    });
    resultEl.innerHTML = `
      <div class="rgc-alert-card">
        Title field not found. Click inside the title box and try again.
      </div>`;
    return;
  }

  if (!title) {
    void trackContentEvent('title_optimize_unavailable', {
      reason: 'empty_title',
    });
    resultEl.innerHTML = `
      <div class="rgc-alert-card">
        ⚠️ Title field is empty.<br>
        <span style="font-size:11px;">Type your post title in the Reddit editor first, then click Optimize Title.</span>
      </div>`;
    return;
  }

  resultEl.innerHTML = `
    <div class="rgc-card">
      <div class="rgc-loading"><div class="rgc-spinner"></div> Generating suggestions...</div>
    </div>`;

  // Simulated async delay.
  setTimeout(() => {
    const suggestions = generateTitleSuggestions(title);

    if (!suggestions || suggestions.length === 0) {
      void trackContentEvent('title_optimize_unavailable', {
        reason: 'no_suggestions',
      });
      resultEl.innerHTML = `<div class="rgc-alert-card">Could not generate suggestions - try a title with at least 5 words.</div>`;
      return;
    }

    const safeSuggestions = (Array.isArray(suggestions) ? suggestions : [])
      .map((item) => ({
        icon: safeText(item?.icon),
        style: safeText(item?.style),
        text: safeText(item?.text),
      }))
      .filter((item) => item.style && item.text);
    const titleWords = title.trim().split(/\s+/).filter(Boolean).length;
    let html = `
      <div class="rgc-card rgc-title-hero-card">
        <div class="rgc-title-hero-top">
          <div>
            <div class="rgc-card-title">Rewrite directions</div>
            <div class="rgc-title-hero-title">Three stronger ways to package this post</div>
            <div class="rgc-title-hero-sub">Pick the angle that best matches your goal: more curiosity, more relatability, or more specificity.</div>
          </div>
          <div class="rgc-title-hero-badge">${safeText(`${safeSuggestions.length} options`, '0 options')}</div>
        </div>
        <div class="rgc-title-hero-meta">
          <div class="rgc-title-hero-metric">
            <div class="rgc-title-hero-metric-value">${safeText(String(title.length), '0')}</div>
            <div class="rgc-title-hero-metric-label">Chars</div>
          </div>
          <div class="rgc-title-hero-metric">
            <div class="rgc-title-hero-metric-value">${safeText(String(titleWords), '0')}</div>
            <div class="rgc-title-hero-metric-label">Words</div>
          </div>
          <div class="rgc-title-hero-original">
            <div class="rgc-title-hero-original-label">Current title</div>
            <div class="rgc-original-title">"${escapeHtml(title)}"</div>
          </div>
        </div>
      </div>
      <div class="rgc-section-title">Suggested variants</div>
    `;

    safeSuggestions.forEach((s, i) => {
      const strategy = getTitleSuggestionStrategy(s.style);
      const strategyKicker = safeText(strategy.kicker);
      const strategyWhy = safeText(strategy.why);
      const wordCount = s.text.trim().split(/\s+/).filter(Boolean).length;
      html += `
        <div class="rgc-suggestion-item rgc-suggestion-item--enhanced">
          <div class="rgc-suggestion-header">
            <div class="rgc-suggestion-heading">
              <span class="rgc-suggestion-style">${s.icon ? `${escapeHtml(s.icon)} ` : ''}${escapeHtml(s.style)}</span>
              ${strategyKicker ? `<span class="rgc-suggestion-kicker">${escapeHtml(strategyKicker)}</span>` : ''}
            </div>
            <div class="rgc-suggestion-actions">
              <button class="rgc-apply-btn" data-text="${escapeAttr(s.text)}" data-style="${escapeAttr(s.style)}" data-index="${i + 1}">Apply</button>
              <button class="rgc-copy-btn" data-text="${escapeAttr(s.text)}" data-style="${escapeAttr(s.style)}" data-index="${i + 1}">Copy</button>
            </div>
          </div>
          <div class="rgc-suggestion-text">${escapeHtml(s.text)}</div>
          ${strategyWhy ? `<div class="rgc-suggestion-why">${escapeHtml(strategyWhy)}</div>` : ''}
          <div class="rgc-suggestion-footer">
            <span class="rgc-suggestion-stat">${wordCount} words</span>
            <span class="rgc-suggestion-stat">${s.text.length} chars</span>
            <span class="rgc-suggestion-stat">Option 0${i + 1}</span>
          </div>
        </div>`;
    });

    resultEl.innerHTML = html;

    // Attach copy buttons
    resultEl.querySelectorAll('.rgc-copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-text');
        if (!text) return;
        const style = btn.getAttribute('data-style') || 'unknown';
        const index = Number(btn.getAttribute('data-index') || '0');
        const ok   = await copyToClipboard(text);
        if (ok) {
          void trackContentEvent('title_suggestion_copied', {
            suggestion_style: style,
            suggestion_index: index,
          });
          btn.textContent = '✓ Copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1800);
        }
      });
    });

    resultEl.querySelectorAll('.rgc-template-copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const text = btn.getAttribute('data-template') || '';
        const index = Number(btn.getAttribute('data-index') || '0');
        const ok = await copyToClipboard(text);
        if (ok) {
          btn.textContent = 'Copied';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 1500);
          void trackContentEvent('subreddit_template_copied', {
            template_index: index,
          });
        }
      });
    });

    resultEl.querySelectorAll('.rgc-apply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text') || '';
        const style = btn.getAttribute('data-style') || 'unknown';
        const index = Number(btn.getAttribute('data-index') || '0');
        const ok = applySuggestedTitle(text);
        if (ok) {
          void trackContentEvent('title_suggestion_applied', {
            suggestion_style: style,
            suggestion_index: index,
          });
          btn.textContent = 'Applied';
          btn.classList.add('applied');
          setTimeout(() => {
            btn.textContent = 'Apply';
            btn.classList.remove('applied');
          }, 1800);
        } else {
          resultEl.innerHTML = `
            <div class="rgc-alert-card">
              Title field not found. Click inside the title box and try again.
            </div>`;
        }
      });
    });

    // Persist compact summary so popup can display it
    saveLastAnalysis({
      type:  'titles',
      title: title.slice(0, 80),
      count: suggestions.length,
    });

    void trackContentEvent('title_optimize_completed', {
      suggestion_count: suggestions.length,
      title_length_bucket: bucketCount(title.length),
    });
  }, 320);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// FEATURE 3: CONTENT SCORE
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function renderContentScore() {
  const resultEl = document.getElementById('rgc-score-result');
  if (!resultEl) return;

  const { text: title, found: titleFound } = getRedditTitle();
  const { text: body,  found: bodyFound  } = getRedditBody();
  void trackContentEvent('content_score_requested', {
    title_found: titleFound,
    body_found: bodyFound,
    title_length_bucket: bucketCount(title.length),
    body_length_bucket: bucketCount(body.length),
  });

  // Editor elements not in DOM at all 鈥?likely SPA not finished rendering
  if (!titleFound && !bodyFound) {
    void trackContentEvent('content_score_unavailable', {
      reason: 'editor_not_found',
    });
    resultEl.innerHTML = `
      <div class="rgc-alert-card">
        ⚠️ Post editor not detected.<br>
        <span style="font-size:11px;">
          The Reddit post editor isn't visible yet. Try clicking inside the title or body field,
          then click Analyze Post again.
          <br>Open the browser console (F12) and look for <code>[RGC]</code> lines to see what was found.
        </span>
      </div>`;
    return;
  }

  if (!title && !body) {
    void trackContentEvent('content_score_unavailable', {
      reason: 'empty_post',
    });
    resultEl.innerHTML = `
      <div class="rgc-alert-card">
        ⚠️ Nothing to score yet.<br>
        <span style="font-size:11px;">Add a title (and optionally body text) in the Reddit post editor, then click Analyze Post.</span>
      </div>`;
    return;
  }

  resultEl.innerHTML = `
    <div class="rgc-card">
      <div class="rgc-loading"><div class="rgc-spinner"></div> Analyzing content...</div>
    </div>`;

  setTimeout(() => {
    // NOTE: Mock implementation 鈥?future: replace with real AI API call
    // See scorePostContent() in utils.js for the replacement point.
    const result   = scorePostContent(title, body);
    const { score, issues, suggestions } = result;
    const color    = scoreColor(score);
    const label    = scoreLabel(score);
    const decision = getScoreDecision(score);
    const checks   = buildContentChecks(title, body);
    const wins     = buildScoreWins(title, body, checks);
    const safeIssues = (Array.isArray(issues) ? issues : []).map((item) => safeText(item)).filter(Boolean);
    const safeFixes = (Array.isArray(suggestions) ? suggestions : []).map((item) => safeText(item)).filter(Boolean);
    const decisionHeadline = safeText(decision.headline, 'Draft readiness');
    const decisionSummary = safeText(decision.summary, 'Review the draft for improvements.');
    const decisionLabel = safeText(decision.label, 'Review');
    const labelText = safeText(label, 'Unknown');

    // SVG ring: circumference math for stroke-dasharray
    // viewBox is 96脳96, radius=38 leaves stroke-width:7 room on each side (96/2 - 10 = 38)
    const radius = 38;
    const circ   = +(2 * Math.PI * radius).toFixed(2);
    const dash   = +((score / 100) * circ).toFixed(2);
    const metrics = [
      { label: 'Title', value: safeText(`${title.trim().length} chars`, 'Not enough data') },
      { label: 'Body', value: safeText(body.trim().length ? `${body.trim().length} chars` : 'Empty', 'Not enough data') },
      { label: 'Issues', value: safeText(String(safeIssues.length), '0') },
      { label: 'Fixes', value: safeText(String(safeFixes.length), '0') },
    ];

    const checkItems = checks.map((item) => `
      <div class="rgc-score-check-item rgc-score-check-item--${item.state}">
        <div class="rgc-score-check-top">
          <span class="rgc-score-check-label">${escapeHtml(safeText(item.label))}</span>
          <span class="rgc-score-check-value">${escapeHtml(safeText(item.value, 'Not enough data'))}</span>
        </div>
        <div class="rgc-score-check-help">${escapeHtml(safeText(item.help))}</div>
      </div>`).join('');

    const winItems = wins.map(item => `
      <li class="rgc-score-win-item">
        <span>${escapeHtml(safeText(item))}</span>
      </li>`).join('');

    const issueItems = safeIssues.map((i, index) => `
      <li class="rgc-score-priority-item">
        <span class="rgc-score-priority-index">0${index + 1}</span>
        <span>${escapeHtml(i)}</span>
      </li>`).join('');

    const suggItems = safeFixes.map((s, index) => `
      <li class="rgc-score-step-item">
        <span class="rgc-score-step-index">${index + 1}</span>
        <span>${escapeHtml(s)}</span>
      </li>`).join('');
    const metricItems = metrics.map(item => `
      <div class="rgc-score-metric">
        <div class="rgc-score-metric-value">${escapeHtml(safeText(item.value, 'Not enough data'))}</div>
        <div class="rgc-score-metric-label">${escapeHtml(safeText(item.label))}</div>
      </div>`).join('');

    resultEl.innerHTML = `
      <div class="rgc-card rgc-score-hero-card">
        <div class="rgc-score-hero-top">
          <div class="rgc-score-hero-copy">
            <div class="rgc-card-title">Draft readiness</div>
            <div class="rgc-score-hero-title">${escapeHtml(decisionHeadline)}</div>
            <div class="rgc-score-hero-sub">${escapeHtml(decisionSummary)}</div>
          </div>
          <div class="rgc-score-chip rgc-score-chip--${decision.key}">${escapeHtml(decisionLabel)}</div>
        </div>
        <div class="rgc-score-hero-main">
          <div class="rgc-score-ring-wrap">
            <div class="rgc-score-ring" role="img" aria-label="Score ${score} out of 100 - ${label}">
              <svg viewBox="0 0 96 96" aria-hidden="true">
                <circle class="ring-bg" cx="48" cy="48" r="${radius}"/>
                <circle class="ring-fill" cx="48" cy="48" r="${radius}"
                  stroke="${color}"
                  stroke-dasharray="${dash} ${circ}"
                />
              </svg>
              <div class="rgc-score-label">
                <span class="rgc-score-num" style="color:${color}">${score}</span>
                <span class="rgc-score-word">${escapeHtml(labelText)}</span>
              </div>
            </div>
          </div>
          <div class="rgc-score-metrics">${metricItems}</div>
        </div>
      </div>

      <div class="rgc-score-grid">
        <div class="rgc-card rgc-score-section-card">
          <div class="rgc-list-label">What looks good</div>
          <ul class="rgc-score-win-list">${winItems}</ul>
        </div>

        <div class="rgc-card rgc-score-section-card">
          <div class="rgc-list-label">Quick checks</div>
          <div class="rgc-score-checks">${checkItems}</div>
        </div>
      </div>

      <div class="rgc-card rgc-score-section-card">
        <div class="rgc-list-label">Fix first</div>
        <ul class="rgc-score-priority-list">${issueItems}</ul>
      </div>

      <div class="rgc-card rgc-score-section-card">
        <div class="rgc-list-label">Next best moves</div>
        <ul class="rgc-score-step-list">${suggItems}</ul>
      </div>

    `;

    // Persist compact summary so popup can display it
    saveLastAnalysis({
      type:  'score',
      score: score,
      label: label,
      color: color,
      title: title.slice(0, 80),
    });

    void trackContentEvent('content_score_completed', {
      score: score,
      score_label: label.toLowerCase(),
      issue_count: issues.length,
      suggestion_count: suggestions.length,
      title_length_bucket: bucketCount(title.length),
      body_length_bucket: bucketCount(body.length),
    });
  }, 280);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// FEATURE 4: SUBREDDIT ANALYSIS (DOM scraping 鈥?no Reddit API used)
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function scrapePostTitles() {
  const allTitles = [];

  // Strategy 1: Standard CSS selectors (new Reddit + old Reddit)
  const elements = safeQueryAll(SELECTORS.postFeedItems);
  elements.forEach(el => {
    const text = (el.innerText || el.textContent || '').trim();
    if (text && text.length > 3) allTitles.push(text);
  });

  // Strategy 2: Shadow DOM 鈥?new Reddit uses <shreddit-post> Web Components
  if (allTitles.length === 0) {
    try {
      document.querySelectorAll('shreddit-post').forEach(post => {
        // Try shadow root first
        const shadow = post.shadowRoot;
        if (shadow) {
          const slot = shadow.querySelector('[slot="title"], h1, h2, h3');
          if (slot) {
            const text = (slot.innerText || slot.textContent || '').trim();
            if (text && text.length > 3) allTitles.push(text);
            return;
          }
        }
        // Fallback: post-title attribute (shreddit sets this)
        const attr = post.getAttribute('post-title') || post.getAttribute('aria-label');
        if (attr && attr.length > 3) allTitles.push(attr.trim());
      });
    } catch (e) {
      // Shadow DOM access may fail in some security contexts 鈥?safe to ignore
    }
  }

  // Strategy 3: Broad anchor fallback for any Reddit feed layout
  if (allTitles.length === 0) {
    try {
      document.querySelectorAll('a[data-click-id="body"]').forEach(a => {
        const text = (a.innerText || '').trim().split('\n')[0];
        if (text && text.length > 10) allTitles.push(text);
      });
    } catch (e) {
      // Safe to ignore
    }
  }

  // De-duplicate and cap at 10
  return [...new Set(allTitles)].slice(0, 10);
}

function classifyTitlePattern(title) {
  const t = String(title || '').trim();
  const lower = t.toLowerCase();
  if (!t) return 'other';
  if (/\?$/.test(t) || /^(how|why|what|when|where|who|is|are|can|should|does|do)\b/i.test(lower)) return 'question';
  if (/\b\d+([.,]\d+)?(%|x)?\b/.test(lower)) return 'data';
  if (/^(i|my|we|our|after|when i)\b/i.test(t)) return 'personal';
  if (/(thoughts|opinions|anyone else|discussion|debate|experience)/i.test(lower)) return 'discussion';
  return 'other';
}

function commonOpeners(titles) {
  const counts = {};
  titles.forEach((title) => {
    const cleaned = String(title || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 2);
    if (!words.length) return;
    const key = words.join(' ');
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
}

function analyzeTitlePatterns(titles) {
  const counts = {
    question: 0,
    data: 0,
    personal: 0,
    discussion: 0,
    other: 0,
  };

  let totalWords = 0;
  let withNumbers = 0;
  let withQuestion = 0;

  titles.forEach((title) => {
    const pattern = classifyTitlePattern(title);
    counts[pattern] += 1;

    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    totalWords += words.length;
    if (/\b\d+([.,]\d+)?(%|x)?\b/.test(title)) withNumbers += 1;
    if (/\?$/.test(title)) withQuestion += 1;
  });

  const dominantPattern = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  return {
    counts,
    dominantPattern,
    avgWords: Math.round(totalWords / Math.max(titles.length, 1)),
    questionRate: Math.round((withQuestion / Math.max(titles.length, 1)) * 100),
    numberRate: Math.round((withNumbers / Math.max(titles.length, 1)) * 100),
    openers: commonOpeners(titles),
  };
}

function generateFeedInsight(patterns, avgLen) {
  if (!patterns) return 'Clear, concise titles tend to work best here.';

  const isShortFeed = avgLen <= 60;
  switch (patterns.dominantPattern) {
    case 'question':
      return isShortFeed
        ? 'Short, question-led posts dominate this feed.'
        : 'Question-style titles perform best here.';
    case 'personal':
      return 'Personal, first-hand titles fit this subreddit best.';
    case 'discussion':
      return 'Direct discussion posts tend to work best here.';
    case 'data':
      return 'Specific, data-led titles stand out here.';
    default:
      return isShortFeed
        ? 'Short, direct titles tend to work best here.'
        : 'Clear, concise titles tend to work best here.';
  }
}

function renderSubredditAnalysis() {
  const resultEl = document.getElementById('rgc-sub-result');
  if (!resultEl) return;

  void trackContentEvent('subreddit_scan_requested', {
    page_type: detectPageType(),
  });

  resultEl.innerHTML = `
    <div class="rgc-card">
      <div class="rgc-loading"><div class="rgc-spinner"></div> Scanning page titles...</div>
    </div>`;

  setTimeout(() => {
    // NOTE: Pure DOM scraping 鈥?no Reddit API is used
    const titles = scrapePostTitles();

    if (titles.length === 0) {
      void trackContentEvent('subreddit_scan_empty', {
        reason: 'no_titles_found',
      });
      resultEl.innerHTML = `
        <div class="rgc-alert-card">
          <strong>No post titles found on this page.</strong><br>
          <span style="font-size:11px;">
            This can happen on new Reddit or shreddit if posts haven't loaded yet.
            Try scrolling down to load more posts, then click Analyze again.
            If you're on a user profile or search page, try a subreddit feed instead.
          </span>
        </div>`;
      return;
    }

    const lengths = titles.map(t => t.length);
    const avgLen  = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const maxLen  = Math.max(...lengths);
    const minLen  = Math.min(...lengths);
    const patterns = analyzeTitlePatterns(titles);
    const insight = generateFeedInsight(patterns, avgLen);
    const summaryTitle = safeText(insight, 'Clear, practical posts tend to work best here.');
    const summaryBody = safeText(
      patterns.dominantPattern === 'personal'
        ? 'Personal, first-hand posts fit this subreddit best.'
        : 'Keep titles specific, practical, and easy to scan.',
      'Scan recent posts to understand what this community responds to.'
    );
    const topics = ['SaaS', 'Startups', 'Marketing', 'Productivity', 'Growth'];
    const commonPatterns = buildSubredditPlaybook(patterns, avgLen);

    // Subreddit name 鈥?best effort
    const subEl   = safeQuery(SELECTORS.subredditName);
    const subName = subEl ? (subEl.innerText || subEl.textContent || '').trim().split('\n')[0] : 'This Page';
    const evidenceLine = `${patterns.questionRate}% questions · Avg length ${avgLen} chars · ${titles.length} posts sampled`;
    const analysisHtml = buildSubredditAnalysisHtml([summaryTitle, summaryBody, evidenceLine], topics, commonPatterns, evidenceLine);

    resultEl.replaceChildren();
    resultEl.innerHTML = analysisHtml;

    // Persist compact summary so popup can display it
    saveLastAnalysis({
      type:  'subreddit',
      count: titles.length,
      name:  subName !== 'This Page' ? subName.slice(0, 60) : undefined,
    });

    void trackContentEvent('subreddit_scan_completed', {
      posts_found: titles.length,
      avg_title_len: avgLen,
      avg_title_words: patterns.avgWords,
      min_title_len: minLen,
      max_title_len: maxLen,
      dominant_pattern: patterns.dominantPattern,
    });
  }, 200);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// DRAG TO REPOSITION
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function makeDraggable(panel, handle) {
  if (!handle) return;
  let dragging = false;
  let startX, startY, origLeft, origTop;

  handle.addEventListener('mousedown', (e) => {
    // Don't start drag when clicking icon buttons in the header
    if (e.target.classList.contains('rgc-icon-btn')) return;
    dragging = true;
    startX   = e.clientX;
    startY   = e.clientY;
    const rect = panel.getBoundingClientRect();
    origLeft = rect.left;
    origTop  = rect.top;
    panel.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const newLeft = Math.max(4, Math.min(origLeft + (e.clientX - startX), window.innerWidth  - panel.offsetWidth  - 4));
    const newTop  = Math.max(4, Math.min(origTop  + (e.clientY - startY), window.innerHeight - panel.offsetHeight - 4));
    panel.style.right = 'auto';
    panel.style.left  = newLeft + 'px';
    panel.style.top   = newTop  + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      panel.style.transition = '';
    }
  });
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// ATTACH ALL PANEL EVENTS
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function attachPanelEvents(panel) {
  // Header controls
  const closeBtn    = panel.querySelector('#rgc-close-btn');
  const collapseBtn = panel.querySelector('#rgc-collapse-btn');
  if (closeBtn)    closeBtn.addEventListener('click', () => hidePanel('panel_header'));
  if (collapseBtn) collapseBtn.addEventListener('click', () => collapsePanel('panel_header'));

  // Tab bar
  panel.querySelectorAll('.rgc-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
  });

  // Feature buttons
  const genTitlesBtn   = panel.querySelector('#rgc-gen-titles-btn');
  const scoreBtn       = panel.querySelector('#rgc-score-btn');
  const analyzeSubBtn  = panel.querySelector('#rgc-analyze-sub-btn');

  if (genTitlesBtn)  genTitlesBtn.addEventListener('click', renderTitleSuggestions);
  if (scoreBtn)      scoreBtn.addEventListener('click', renderContentScore);
  if (analyzeSubBtn) analyzeSubBtn.addEventListener('click', renderSubredditAnalysis);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// SPA NAVIGATION 鈥?Reddit is a Single-Page App
// URL changes don't reload the page. We intercept the History API and watch
// the <title> element for mutations. No polling is used.
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

let lastUrl = location.href;
let navTimer = null;

function onUrlChange() {
  // Guard: skip if the URL hasn't actually changed.
  // Title mutations fire for vote count/badge updates too 鈥?not just navigation.
  // Hash-only changes (#...) don't constitute a page change on Reddit.
  const current = location.href;
  const currentNoHash = current.split('#')[0];
  const lastNoHash    = lastUrl.split('#')[0];
  if (currentNoHash === lastNoHash) return;
  lastUrl = current;

  // Debounce rapid successive calls (pushState + title mutation can both fire)
  clearTimeout(navTimer);
  navTimer = setTimeout(() => {
    removePanel();
    init();
  }, 600);
}

function getDefaultTabForPageType(pageType) {
  if (pageType === 'submit') return 'titles';
  if (pageType === 'post') return 'score';
  if (pageType === 'subreddit' || pageType === 'home') return 'subreddit';
  return 'titles';
}

// Intercept history.pushState / replaceState
(function patchHistory() {
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = function (...a) { _push(...a);    onUrlChange(); };
  history.replaceState = function (...a) { _replace(...a); onUrlChange(); };
})();

window.addEventListener('popstate', onUrlChange);

// Watch <title> mutations 鈥?Reddit updates document.title on every SPA nav.
// Combined with the History API patch this catches 100% of navigation events
// without any polling interval.
(function attachTitleObserver() {
  function observe(el) {
    new MutationObserver(onUrlChange).observe(el, {
      childList: true, characterData: true, subtree: true,
    });
  }

  const titleEl = document.querySelector('head > title');
  if (titleEl) {
    observe(titleEl);
    return;
  }

  // <title> not yet in DOM (very rare at document_idle) 鈥?watch <head> once.
  const headEl = document.querySelector('head');
  if (!headEl) return;
  const headObserver = new MutationObserver(() => {
    const el = document.querySelector('head > title');
    if (el) {
      headObserver.disconnect();
      observe(el);
    }
  });
  headObserver.observe(headEl, { childList: true });
})();

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// MESSAGES FROM POPUP
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

try {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'RGC_TOGGLE_PANEL') {
      if (msg.visible) showPanelWithTracking(msg.source || 'popup');
      else             hidePanel(msg.source || 'popup');
      sendResponse?.({ ok: true });
      return;
    }

    if (msg && msg.type === 'RGC_SHOW_TUTORIAL') {
      showPanel();
      void requestOnboarding(msg.source || 'popup_tutorial', { force: true })
        .then(() => sendResponse?.({ ok: true }))
        .catch(() => sendResponse?.({ ok: false }));
      return true;
    }

    if (msg && msg.type === 'RGC_RESET_ONBOARDING') {
      void resetOnboardingState()
        .then(() => sendResponse?.({ ok: true }))
        .catch(() => sendResponse?.({ ok: false }));
      return true;
    }
  });
} catch (e) {
  // May fail if extension context is invalidated after update 鈥?safe to ignore
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// WAIT FOR EDITOR  (submit pages only)
//
// Reddit's post editor is rendered asynchronously by React/Shreddit long after
// the URL changes. This function watches the DOM until either the title OR body
// selector resolves, then re-stamps the panel's button states.
//
// Strategy: MutationObserver on <body> with a 10-second timeout fallback.
// We do NOT block panel injection 鈥?the panel shows immediately so the user
// sees it. We only update the "editor ready" indicator inside the panes.
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function waitForEditor(onReady) {
  // Already present 鈥?resolve immediately
  if (findRedditTitleField()) {
    onReady();
    return;
  }

  const TIMEOUT_MS = 10000;
  let done = false;

  function finish() {
    if (done) return;
    done = true;
    observer.disconnect();
    void trackContentEvent('editor_ready', {
      page_type: detectPageType(),
    });
    onReady();
  }

  const observer = new MutationObserver(() => {
    if (findRedditTitleField()) finish();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Timeout safety net 鈥?stop observing after 10s whether we found it or not
  setTimeout(() => {
    if (!done) {
      done = true;
      observer.disconnect();
    }
  }, TIMEOUT_MS);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// INIT
// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function init() {
  // Read saved panel visibility preference
  let panelVisible = true;
  try {
    const stored = await chrome.storage.local.get('panelVisible');
    if (stored.panelVisible === false) panelVisible = false;
  } catch (e) {
    // chrome.storage may not be available in all contexts
  }

  injectPanel();
  switchTab(getDefaultTabForPageType(detectPageType()));

  void trackContentEvent('reddit_page_viewed', {
    page_type: detectPageType(),
    panel_visible_pref: panelVisible,
  });

  if (!panelVisible) {
    const p = document.getElementById(PANEL_ID);
    if (p) p.classList.add('rgc-hidden');
  } else {
    void requestOnboarding('initial_auto_open', { auto: true });
  }

  // On submit pages, the post editor loads asynchronously after React hydrates.
  // Log when the editor becomes available so users can verify it in DevTools.
  if (detectPageType() === 'submit') {
    waitForEditor(() => {
      const { found: tf } = getRedditTitle();
      const { found: bf } = getRedditBody();
    });
  }
}

// Kick off
init();



