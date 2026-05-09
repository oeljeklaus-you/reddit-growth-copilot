"use strict";

(() => {
  const STORAGE_KEY = "rgcReplyOpportunityFeedbackRecords";
  const BAD_CASES_KEY = "rgc_bad_cases";
  const MAX_RECORDS = 200;
  const MAX_BAD_CASES = 100;

  function normalizeIdentity(value) {
    return String(value || "").trim();
  }

  function getRecordIdentity(record) {
    const postId = normalizeIdentity(record?.postId);
    if (postId) return `id:${postId}`;
    const postUrl = normalizeIdentity(record?.postUrl);
    if (postUrl) return `url:${postUrl}`;
    return "";
  }

  async function readRecords() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const records = stored[STORAGE_KEY];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  async function writeRecords(records) {
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: records.slice(0, MAX_RECORDS) });
      return true;
    } catch {
      return false;
    }
  }

  async function saveFeedback(record) {
    return writeDedupedRecord(STORAGE_KEY, MAX_RECORDS, record);
  }

  async function saveBadCase(record) {
    return writeDedupedRecord(BAD_CASES_KEY, MAX_BAD_CASES, record);
  }

  async function writeDedupedRecord(key, maxRecords, record) {
    const identity = getRecordIdentity(record);
    if (!identity) return false;

    const records = await readKeyRecords(key);
    const existing = records.find((item) => getRecordIdentity(item) === identity) || null;
    const nextRecord = {
      ...record,
      createdAt: existing?.createdAt || record.createdAt || Date.now(),
    };
    const updated = records.filter((item) => getRecordIdentity(item) !== identity);
    updated.unshift(nextRecord);
    await writeKeyRecords(key, maxRecords, updated);
    return true;
  }

  async function getFeedback(postId, postUrl) {
    const id = normalizeIdentity(postId);
    const url = normalizeIdentity(postUrl);
    if (!id && !url) return null;

    const records = await readRecords();
    return records.find((record) => {
      if (id && normalizeIdentity(record?.postId) === id) return true;
      if (url && normalizeIdentity(record?.postUrl) === url) return true;
      return false;
    }) || null;
  }

  async function readKeyRecords(key) {
    try {
      const stored = await chrome.storage.local.get(key);
      const records = stored[key];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }

  async function writeKeyRecords(key, maxRecords, records) {
    try {
      await chrome.storage.local.set({ [key]: records.slice(0, maxRecords) });
      return true;
    } catch {
      return false;
    }
  }

  globalThis.RGCReplyOpportunityFeedback = {
    saveFeedback,
    saveBadCase,
    getFeedback,
    getRecordIdentity,
    STORAGE_KEY,
    BAD_CASES_KEY,
    MAX_RECORDS,
  };
})();
