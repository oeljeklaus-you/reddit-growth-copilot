"use strict";

(() => {
  const FEEDBACK_KEY = "rgcReplyOpportunityFeedbackRecords";
  const BAD_CASES_KEY = "rgc_bad_cases";

  async function readKey(key) {
    try {
      const stored = await chrome.storage.local.get(key);
      const value = stored[key];
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  async function getCalibrationSnapshot() {
    const [feedbackRecords, badCases] = await Promise.all([
      readKey(FEEDBACK_KEY),
      readKey(BAD_CASES_KEY),
    ]);

    const yesCount = feedbackRecords.filter((item) => item?.userFeedback === "yes").length;
    const noCount = feedbackRecords.filter((item) => item?.userFeedback === "no").length;
    const totalCount = feedbackRecords.length;
    const accuracyRate = totalCount > 0 ? yesCount / totalCount : null;

    return {
      feedbackRecords,
      badCases,
      summary: {
        totalCount,
        yesCount,
        noCount,
        accuracyRate,
      },
    };
  }

  async function clearBadCases() {
    try {
      await chrome.storage.local.remove(BAD_CASES_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function buildCalibrationExport(snapshot) {
    return {
      exportedAt: new Date().toISOString(),
      rgc_feedback: snapshot.feedbackRecords || [],
      rgc_bad_cases: snapshot.badCases || [],
    };
  }

  async function downloadJson(data, filename) {
    const json = JSON.stringify(data, null, 2);
    try {
      if (chrome.downloads?.download) {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        try {
          await chrome.downloads.download({
            url,
            filename,
            saveAs: true,
          });
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return true;
        } catch {
          URL.revokeObjectURL(url);
        }
      }
    } catch {
    }

    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        anchor.remove();
      }, 1000);
      return true;
    } catch {
      return false;
    }
  }

  globalThis.RGCCalibration = {
    getCalibrationSnapshot,
    clearBadCases,
    buildCalibrationExport,
    downloadJson,
  };
})();
