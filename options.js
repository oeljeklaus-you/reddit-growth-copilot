'use strict';

const SETTINGS_KEY = 'rgcSettings';
const ONBOARDING_STORAGE_KEY = 'rgc_tutorial_seen';
const LEGACY_ONBOARDING_STORAGE_KEY = 'rgcPanelOnboardingSeen';
const DEFAULT_SETTINGS = Object.freeze({
  ui: {
    showFeedScores: true,
    showFeedScoresOnHome: true,
    showFeedScoresOnSubreddit: true,
    feedScoreFilter: 'all',
  },
  personalization: {
    enableHistoryPersonalization: true,
  },
});

function mergeSettings(stored) {
  return {
    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...(stored && stored.ui ? stored.ui : {}),
    },
    personalization: {
      ...DEFAULT_SETTINGS.personalization,
      ...(stored && stored.personalization ? stored.personalization : {}),
    },
  };
}

function setStatus(message, isError) {
  const status = document.getElementById('status');
  status.textContent = message || '';
  status.style.color = isError ? '#b91c1c' : '#15803d';
}

function readForm() {
  return {
    ui: {
      ...DEFAULT_SETTINGS.ui,
      showFeedScores: document.getElementById('showFeedScores').checked,
      showFeedScoresOnHome: document.getElementById('showFeedScoresOnHome').checked,
      showFeedScoresOnSubreddit: document.getElementById('showFeedScoresOnSubreddit').checked,
      feedScoreFilter: document.getElementById('feedScoreFilterHighOnly').checked ? 'high_only' : 'all',
    },
    personalization: {
      ...DEFAULT_SETTINGS.personalization,
      enableHistoryPersonalization: document.getElementById('enableHistoryPersonalization').checked,
    },
  };
}

function fillForm(settings) {
  document.getElementById('showFeedScores').checked = settings.ui.showFeedScores !== false;
  document.getElementById('showFeedScoresOnHome').checked = settings.ui.showFeedScoresOnHome !== false;
  document.getElementById('showFeedScoresOnSubreddit').checked = settings.ui.showFeedScoresOnSubreddit !== false;
  document.getElementById('feedScoreFilterHighOnly').checked = settings.ui.feedScoreFilter === 'high_only';
  document.getElementById('enableHistoryPersonalization').checked = settings.personalization.enableHistoryPersonalization !== false;
}

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    fillForm(mergeSettings(stored[SETTINGS_KEY]));
  } catch (e) {
    setStatus('Failed to load settings', true);
  }
}

async function saveSettings() {
  const settings = readForm();

  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    setStatus('Settings saved');
  } catch (e) {
    setStatus('Failed to save settings', true);
  }
}

async function resetDefaults() {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    fillForm(DEFAULT_SETTINGS);
    setStatus('Reset to defaults');
  } catch (e) {
    setStatus('Failed to reset settings', true);
  }
}

async function resetOnboarding() {
  try {
    await chrome.storage.local.remove([ONBOARDING_STORAGE_KEY, LEGACY_ONBOARDING_STORAGE_KEY]);
    const tabs = await chrome.tabs.query({ url: ['*://*.reddit.com/*'] });
    await Promise.allSettled(
      tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'RGC_RESET_ONBOARDING' }))
    );
    setStatus('Onboarding reset');
  } catch (e) {
    setStatus('Failed to reset onboarding', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void loadSettings();

  document.getElementById('saveBtn').addEventListener('click', () => {
    void saveSettings();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    void resetDefaults();
  });

  document.getElementById('resetOnboardingBtn').addEventListener('click', () => {
    void resetOnboarding();
  });
});
