'use strict';

(() => {
  const MESSAGE_TYPE = 'RGC_ANALYTICS_EVENT';

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

  function track(eventName, params) {
    const safeName = sanitizeName(eventName);
    if (!safeName) return Promise.resolve(false);

    try {
      const result = chrome.runtime.sendMessage({
        type: MESSAGE_TYPE,
        eventName: safeName,
        params: sanitizeParams(params),
        occurredAt: Date.now(),
      });

      if (result && typeof result.then === 'function') {
        return result.then(() => true).catch(() => false);
      }
    } catch (e) {
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  globalThis.RGCAnalytics = Object.freeze({
    messageType: MESSAGE_TYPE,
    track,
  });
})();
