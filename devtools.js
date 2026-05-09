'use strict';

const SNAPSHOT_KEYS = [
  'rgcLastAnalysis',
  'rgc_tutorial_seen',
  'panelVisible',
  'rgcSettings',
  'rgc_is_pro_user',
  'rgcAnalyticsClientId',
  'rgcAnalyticsSession',
];

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

async function loadSnapshot() {
  const stateEl = document.getElementById('state');
  if (!stateEl) return;

  try {
    const stored = await chrome.storage.local.get(SNAPSHOT_KEYS);
    stateEl.textContent = prettyJson(stored);
  } catch (e) {
    stateEl.textContent = 'Failed to load storage snapshot.';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const refreshBtn = document.getElementById('refreshBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const openPopupBtn = document.getElementById('openPopupBtn');

  await loadSnapshot();

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      void loadSnapshot();
    });
  }

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', async () => {
      try {
        await chrome.runtime.openOptionsPage();
      } catch (e) {
        // ignore
      }
    });
  }

  if (openPopupBtn) {
    openPopupBtn.addEventListener('click', async () => {
      try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
      } catch (e) {
        // ignore
      }
    });
  }
});
