"use strict";

(() => {
  const CONFIG = {
    timing: {
      opLastReply: [
        { max: 30, score: 40, label: "Fresh" },
        { max: 120, score: 30, label: "Fresh" },
        { max: 240, score: 20, label: "Alive" },
        { max: 1440, score: 10, label: "Late" },
        { max: Infinity, score: -20, label: "Dead" },
      ],
      threadAge: [
        { max: 30, score: 30 },
        { max: 120, score: 25 },
        { max: 360, score: 15 },
        { max: 1440, score: 5 },
        { max: Infinity, score: -20 },
      ],
      recentVelocity: [
        { min: 10, score: 20, label: "Hot" },
        { min: 3, score: 15, label: "Alive" },
        { min: 1, score: 5, label: "Slow" },
        { min: 0, score: -10, label: "Dead" },
      ],
      crowding: [
        { min: 101, score: -25 },
        { min: 50, score: -15 },
        { min: 20, score: -5 },
        { min: 0, score: 0 },
      ],
      labels: {
        fresh: 75,
        alive: 50,
        late: 30,
      },
    },
    conversion: {
      opStatus: {
        active: 35,
        inactive: -25,
        unknown: 0,
      },
      opIntent: {
        exploring: 35,
        confirming: 20,
        done: -50,
        unknown: 0,
      },
      engagement: {
        followUp: 20,
        onlyThanks: -15,
        multiReply: 10,
      },
      visibility: [
        { max: 19, score: 10 },
        { max: 50, score: 5 },
        { max: 100, score: 0 },
        { max: Infinity, score: -15 },
      ],
      labels: {
        high: 70,
        medium: 40,
      },
    },
    demand: {
      painBuckets: [
        {
          key: "friction",
          score: 10,
          keywords: [
            "stuck",
            "annoying",
            "frustrating",
            "struggling",
            "painful",
            "broken",
            "waste time",
          ],
        },
        {
          key: "problem",
          score: 10,
          keywords: [
            "problem",
            "issue",
            "hate",
          ],
        },
        {
          key: "help",
          score: 10,
          keywords: [
            "need help",
            "alternative",
            "automate",
            "manually",
          ],
        },
      ],
      askForToolPatterns: [
        "is there a tool",
        "any app",
        "software",
        "extension",
        "plugin",
        "service",
        "platform",
        "workaround",
        "any tool",
      ],
      repeatedDemand: [
        "same",
        "me too",
        "also need",
        "looking for this",
      ],
      labels: {
        strong: 70,
        medium: 40,
      },
    },
    fakeActiveRisk: {
      labels: {
        high: "High",
        medium: "Medium",
        low: "Low",
      },
    },
    recommendation: {
      replyNow: 75,
      considerMin: 50,
    },
    guardrail: {
      aliveSignalsThreshold: 2,
      aliveSignals: {
        opReplyCount: 1,
        opLastReplyMinutes: 180,
        recent1hComments: 3,
        totalCommentsMin: 10,
        totalCommentsMax: 80,
        threadAgeMinutes: 360,
      },
      lateButNotDead: {
        timingLabel: "Dead",
        recent1hComments: 2,
        threadAgeMinutes: 480,
        timingScoreBoost: 15,
        timingAdjustedLabel: "Late",
        timingAdjustedReason: "recent_activity_not_dead",
      },
      opUnknownFix: {
        opStatus: "unknown",
        minOpReplyCount: 1,
        activeStatus: "active",
      },
      fakeActiveRefine: {
        maxOpLastReplyMinutes: 180,
        minOpReplyCount: 1,
        forceRisk: "Low",
        fakeActiveAdjustedReason: "recent_op_activity",
      },
      conversionDowngrade: {
        intent: "confirming",
        scorePenalty: 15,
        minScore: 0,
        acceptedPatterns: [
          "thanks",
          "thank you",
          "dm",
          "pm",
          "accepted",
          "worked",
          "fixed",
          "solved",
          "got it",
        ],
      },
      recommendationOverride: {
        minAdjustedScore: 55,
        adjustedRecommendation: "Consider",
        originalRecommendation: "Skip",
        guardrailReason: "alive_thread_override",
      },
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function countOccurrences(text, keyword) {
    if (!keyword) return 0;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    return (text.match(regex) || []).length;
  }

  function labelForScore(score, labels) {
    if (score >= labels.high) return "High";
    if (score >= labels.medium) return "Medium";
    return "Low";
  }

  function timingLabel(score) {
    if (score >= CONFIG.timing.labels.fresh) return "Fresh";
    if (score >= CONFIG.timing.labels.alive) return "Alive";
    if (score >= CONFIG.timing.labels.late) return "Late";
    return "Dead";
  }

  function conversionLabel(score) {
    if (score >= CONFIG.conversion.labels.high) return "High";
    if (score >= CONFIG.conversion.labels.medium) return "Medium";
    return "Low";
  }

  function demandLabel(score) {
    if (score >= CONFIG.demand.labels.strong) return "Strong";
    if (score >= CONFIG.demand.labels.medium) return "Medium";
    return "Weak";
  }

  function formatAge(minutes) {
    if (minutes == null || Number.isNaN(minutes)) return "unknown";
    if (minutes < 60) return `${Math.max(0, Math.round(minutes))}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(minutes / 1440);
    return `${days}d`;
  }

  function chooseBucket(value, buckets) {
    const num = value == null || Number.isNaN(value) ? null : value;
    if (num == null) return 0;
    for (const bucket of buckets) {
      if (bucket.min != null && num >= bucket.min) return bucket.score;
      if (bucket.max != null && num <= bucket.max) return bucket.score;
    }
    return 0;
  }

  function bucketLabel(value, ranges, fallback = "unknown") {
    if (value == null || Number.isNaN(value)) return fallback;
    for (const range of ranges) {
      if (range.max != null && value <= range.max) return range.label;
      if (range.min != null && value >= range.min) return range.label;
    }
    return fallback;
  }

  function buildTimingScore(signals) {
    const opLastReply = signals.opLastReplyMinutes;
    const threadAge = signals.threadAgeMinutes;
    const recent1h = signals.recentCommentCount1h ?? 0;
    const totalComments = signals.commentCount;

    let score = 0;

    score += chooseBucket(opLastReply, CONFIG.timing.opLastReply);
    score += chooseBucket(threadAge, CONFIG.timing.threadAge);

    const velocityBucket = CONFIG.timing.recentVelocity.find((bucket) => recent1h >= bucket.min) || CONFIG.timing.recentVelocity.at(-1);
    score += velocityBucket?.score || 0;

    const crowdingBucket = CONFIG.timing.crowding.find((bucket) => totalComments >= bucket.min) || CONFIG.timing.crowding.at(-1);
    score += crowdingBucket?.score || 0;

    score = clamp(score, 0, 100);
    return {
      timingScore: score,
      timingLabel: timingLabel(score),
    };
  }

  function buildConversionScore(signals) {
    const statusScore = CONFIG.conversion.opStatus[signals.opStatus] ?? 0;
    const intentScore = CONFIG.conversion.opIntent[signals.opIntent] ?? 0;
    const visibilityScore = chooseBucket(signals.commentCount, CONFIG.conversion.visibility);

    let score = 0;
    score += statusScore;
    score += intentScore;
    score += visibilityScore;

    if (signals.opFollowUpCount > 0) score += CONFIG.conversion.engagement.followUp;
    if (signals.opOnlyThanks) score += CONFIG.conversion.engagement.onlyThanks;
    if (signals.opReplyCount >= 3) score += CONFIG.conversion.engagement.multiReply;

    score = clamp(score, 0, 100);

    return {
      conversionScore: score,
      conversionLabel: conversionLabel(score),
    };
  }

  function getUniqueCommenters(signals) {
    const commenters = signals.commentAuthors || signals.commenterNames || [];
    const unique = new Set(
      commenters
        .map((value) => normalizeUsername(value))
        .filter(Boolean)
    );
    return unique.size;
  }

  function getReplyDepthScore(signals) {
    const depth = signals.replyDepth ?? signals.maxCommentDepth ?? 0;
    return depth >= 2 ? 10 : 0;
  }

  function buildEngagementScore(signals) {
    const totalComments = signals.commentCount ?? 0;
    const uniqueCommenters = signals.uniqueCommenters ?? getUniqueCommenters(signals);
    const recent1hComments = signals.recentCommentCount1h ?? 0;
    const recent2hComments = signals.recentCommentCount2h ?? 0;
    const commentVelocity = signals.commentVelocity ?? 0;
    const replyDepthScore = getReplyDepthScore(signals);

    let score = 0;

    if (totalComments === 0) score += 0;
    else if (totalComments <= 3) score += 15;
    else if (totalComments <= 10) score += 30;
    else if (totalComments <= 30) score += 25;
    else if (totalComments <= 80) score += 15;
    else score += 5;

    if (uniqueCommenters <= 2) score += 10;
    else if (uniqueCommenters <= 8) score += 25;
    else if (uniqueCommenters <= 20) score += 20;
    else score += 10;

    if (recent1hComments >= 5) score += 25;
    else if (recent1hComments >= 2) score += 15;
    else if (recent1hComments >= 1) score += 5;
    else score -= 10;

    if (commentVelocity >= 8) score += 15;
    else if (commentVelocity >= 4) score += 10;
    else if (commentVelocity >= 1) score += 5;
    else if (recent2hComments > 0 && recent1hComments === 0) score -= 5;

    if (recent2hComments > recent1hComments) score += 5;
    score += replyDepthScore;

    score = clamp(score, 0, 100);

    let engagementLabel = "Low";
    if (score >= 75) engagementLabel = "High";
    else if (score >= 45) engagementLabel = "Medium";

    return {
      engagementScore: score,
      engagementLabel,
      uniqueCommenters,
      replyDepth: signals.replyDepth ?? signals.maxCommentDepth ?? 0,
      commentVelocity,
      recent2hComments,
    };
  }

  function normalizeOpStatus(signals) {
    const opStatusBeforeNormalize = signals.opStatus || "unknown";
    let opStatusAfterNormalize = opStatusBeforeNormalize;
    let opStatusNormalizedReason = "";

    if (opStatusBeforeNormalize === "unknown" && (signals.opReplyCount ?? 0) >= 1) {
      opStatusAfterNormalize = "active";
      opStatusNormalizedReason = "op_reply_count_detected";
    }

    return {
      ...signals,
      opStatusBeforeNormalize,
      opStatusAfterNormalize,
      opStatusNormalizedReason,
      opStatus: opStatusAfterNormalize,
    };
  }

  function buildAliveSignals(signals) {
    const aliveConfig = CONFIG.guardrail.aliveSignals;
    const aliveSignalReasons = [];

    if ((signals.opReplyCount ?? 0) >= aliveConfig.opReplyCount) {
      aliveSignalReasons.push("op_reply_count_detected");
    }
    if ((signals.opLastReplyMinutes ?? Infinity) <= aliveConfig.opLastReplyMinutes) {
      aliveSignalReasons.push("op_last_reply_recent");
    }
    if ((signals.recentCommentCount1h ?? 0) >= aliveConfig.recent1hComments) {
      aliveSignalReasons.push("recent_comments_still_growing");
    }
    if ((signals.commentCount ?? 0) >= aliveConfig.totalCommentsMin && (signals.commentCount ?? 0) <= aliveConfig.totalCommentsMax) {
      aliveSignalReasons.push("comment_count_in_alive_range");
    }
    if ((signals.threadAgeMinutes ?? Infinity) <= aliveConfig.threadAgeMinutes) {
      aliveSignalReasons.push("thread_age_recent");
    }

    const aliveSignals = aliveSignalReasons.length;
    const isAliveThread = aliveSignals >= CONFIG.guardrail.aliveSignalsThreshold;

    return {
      aliveSignals,
      isAliveThread,
      aliveSignalReasons,
    };
  }

  function countPainBuckets(text) {
    const matches = [];
    for (const bucket of CONFIG.demand.painBuckets) {
      let found = 0;
      for (const keyword of bucket.keywords) {
        if (text.includes(keyword)) {
          found = 1;
          break;
        }
      }
      if (found) matches.push(bucket);
    }
    const score = matches.reduce((sum, bucket) => sum + bucket.score, 0);
    return {
      score,
      buckets: matches.map((bucket) => bucket.key),
    };
  }

  function buildDemandScore(signals) {
    const textSources = [
      signals.title,
      ...(signals.commentTexts || []),
      ...(signals.opReplyTexts || []),
    ];
    const fullText = normalizeText(textSources.join(" "));

    const pain = countPainBuckets(fullText);
    let score = pain.score;

    const askForToolHit = CONFIG.demand.askForToolPatterns.some((phrase) => fullText.includes(phrase));
    if (askForToolHit) score += 25;

    const repeatedPain = (signals.repeatedDemandCount ?? 0) >= 2;
    if (repeatedPain) score += 25;

    const repeatedDemandPhraseHit = CONFIG.demand.repeatedDemand.some((phrase) => fullText.includes(phrase));
    if (repeatedDemandPhraseHit) score += 20;

    if (signals.opIntent !== "done") {
      if (signals.commentCount != null && signals.commentCount >= 10 && signals.commentCount <= 50) score += 10;
      else if (signals.commentCount != null && signals.commentCount > 50) score += 15;
    }

    score = clamp(score, 0, 100);

    return {
      demandScore: score,
      demandLabel: demandLabel(score),
      painBuckets: pain.buckets,
      askForToolHit,
      repeatedDemand: repeatedPain || repeatedDemandPhraseHit,
    };
  }

  function buildFakeActiveRisk(signals) {
    const totalComments = signals.commentCount ?? 0;
    const recentComments = signals.recentCommentCount1h ?? 0;
    const inactive = signals.opStatus === "inactive" || (signals.opLastReplyMinutes != null && signals.opLastReplyMinutes > 1440);
    const high = recentComments > 0 && inactive && totalComments > 50 && (signals.opIntent === "done" || signals.opIntent === "unknown");
    if (high) return "High";
    const medium = recentComments > 0 && signals.opLastReplyMinutes != null && signals.opLastReplyMinutes >= 240 && signals.opLastReplyMinutes <= 1440 && totalComments > 30;
    if (medium) return "Medium";
    const low = signals.opStatus === "active" && (signals.opIntent === "exploring" || signals.opIntent === "confirming") && recentComments > 0;
    if (low) return "Low";
    return "Low";
  }

  function buildWhy(signals, timingLabelValue, engagementLabelValue, matchLabelValue, conversionLabelValue, demandLabelValue, fakeActiveRisk) {
    const positives = [];
    const risks = [];

    if (signals.opStatus === "active") positives.push("OP is still active in the thread.");
    if (signals.opReplyCount > 0) positives.push(`OP replied ${signals.opReplyCount} time${signals.opReplyCount === 1 ? "" : "s"}.`);
    if (signals.opIntent === "exploring") positives.push("OP still looks like they are looking for answers.");
    if (signals.opIntent === "confirming") positives.push("OP is comparing options and looking for validation.");
    if (matchLabelValue === "High match") positives.push("The thread matches your usual browsing topics.");
    if (engagementLabelValue === "High") positives.push("The thread already has strong comment activity.");
    if (engagementLabelValue === "Medium") positives.push("The thread has enough activity to be worth joining.");
    if (signals.recentCommentCount1h > 0) positives.push("Recent comments are still arriving.");
    if (signals.recentCommentGrowth === true) positives.push("Comment activity is still growing.");
    if (demandLabelValue === "Strong") positives.push("Demand signals are strong.");
    if (timingLabelValue === "Fresh") positives.push("Thread is still in a usable time window.");

    if (signals.commentCount > 100) risks.push("Thread is crowded, so a new reply can get buried.");
    else if (signals.commentCount > 50) risks.push("Thread is getting crowded.");
    if (signals.opStatus === "inactive") risks.push("OP looks inactive right now.");
    if (signals.opIntent === "done") risks.push("OP appears done with the discussion.");
    if (engagementLabelValue === "Low") risks.push("Comment activity is thin, so the thread may not be worth joining.");
    if (matchLabelValue === "Low match") risks.push("This thread is outside your usual interest pattern.");
    if (timingLabelValue === "Dead") risks.push("Timing is weak for a new reply.");
    if (demandLabelValue === "Weak") risks.push("The thread does not show a strong pain signal.");
    if (fakeActiveRisk === "High") risks.push("Thread looks lively but conversion odds are poor.");

    return {
      positives: positives.slice(0, 4),
      risks: risks.slice(0, 4),
    };
  }

  function buildSuggestion(signals, recommendationKey) {
    if (recommendationKey === "skip") {
      if (signals.opIntent === "done") return "Skip this thread. OP looks finished and the discussion is likely closed.";
      if (signals.fakeActiveRisk === "High") return "Skip for now. The thread looks active, but the reply window is poor.";
      return "Skip unless you have a very specific, high-value angle.";
    }
    if (recommendationKey === "consider") {
      if (signals.opIntent === "exploring") return "Reply with one concrete answer and one quick example.";
      if (signals.opIntent === "confirming") return "Add a concise confirmation with a trade-off or edge case.";
      return "Reply if you can add something specific that is not already in the thread.";
    }
    if (signals.opIntent === "exploring") return "Answer directly and give one practical next step.";
    if (signals.opIntent === "confirming") return "Confirm the best option, then add one nuance.";
    return "Lead with a concrete answer and keep it short enough to stay visible.";
  }

  function buildSuggestedReplyAngle(signals, recommendationKey) {
    if (recommendationKey === "skip") return null;

    if (signals.opIntent === "exploring") {
      return "Answer the open question directly, then ask one specific follow-up.";
    }

    if (signals.opIntent === "confirming") {
      return "Validate their direction, then mention one tradeoff they may not have considered.";
    }

    if (signals.demandLabel === "Strong") {
      return "Start by naming the pain clearly before mentioning any tool or solution.";
    }

    if (signals.fakeActiveRisk === "Medium") {
      return "Keep it short. The thread may still be active, but attention is fading.";
    }

    return "Share a similar experience, then ask one specific follow-up question.";
  }

  function buildRecommendationSummary(signals, recommendationKey) {
    const baseMap = {
      reply_now: "High chance OP will respond",
      consider: "Worth checking, but timing or intent is uncertain",
      skip: "Low chance your reply gets noticed",
    };

    let text = baseMap[recommendationKey] || baseMap.skip;

    if (recommendationKey === "reply_now" && signals.demandLabel === "Strong") {
      text = `${text} · strong pain signal`;
    } else if (recommendationKey === "consider" && signals.fakeActiveRisk === "Medium") {
      text = "Looks active, but reply value is uncertain";
    } else if (recommendationKey === "skip" && signals.fakeActiveRisk === "High") {
      text = "Looks active, but OP is probably gone";
    } else if (recommendationKey === "skip" && signals.opIntent === "done") {
      text = "OP seems to have already made a decision";
    }

    return text.length <= 90 ? text : text.slice(0, 87).trimEnd() + "...";
  }

  function normalizeRecommendationLabel(value) {
    const text = String(value || "").trim().toLowerCase();
    if (text === "reply now" || text === "reply_now" || text === "replynow" || text === "high") return "reply_now";
    if (text === "consider" || text === "medium") return "consider";
    return "skip";
  }

  function recommendationForKey(key) {
    const recommendationMap = {
      reply_now: {
        key: "reply_now",
        label: "Reply now",
        emoji: "🟢",
        headline: "Worth replying right now",
      },
      consider: {
        key: "consider",
        label: "Consider",
        emoji: "🟡",
        headline: "Maybe reply if you have a sharp angle",
      },
      skip: {
        key: "skip",
        label: "Skip",
        emoji: "🔴",
        headline: "Not a good reply window",
      },
    };
    return recommendationMap[key] || recommendationMap.skip;
  }

  function logPipelineError(stage, error) {
    if (globalThis.rgc_dev_mode === true) {
      console.error(`[RGC] ${stage} failed`, error);
    }
  }

  function safeCompute(stage, fallback, compute) {
    try {
      return compute();
    } catch (error) {
      logPipelineError(stage, error);
      return fallback;
    }
  }

  function buildReplyStrategyLabel({ recommendation, opIntent, demandLabel, fakeActiveRisk, isGuardrailAdjusted }) {
    const recommendationKey = normalizeRecommendationLabel(
      recommendation?.key || recommendation?.label || recommendation
    );

    if (recommendationKey === "skip") {
      return {
        replyStrategyLabel: "skip",
        replyStrategyReason: "recommendation_skip",
      };
    }

    if (fakeActiveRisk === "Medium" || isGuardrailAdjusted === true) {
      return {
        replyStrategyLabel: "quick_ping",
        replyStrategyReason: isGuardrailAdjusted === true ? "guardrail_adjusted" : "fake_active_risk_medium",
      };
    }

    if (opIntent === "exploring") {
      return {
        replyStrategyLabel: "answer_and_ask",
        replyStrategyReason: "op_intent_exploring",
      };
    }

    if (opIntent === "confirming") {
      return {
        replyStrategyLabel: "validate_and_add",
        replyStrategyReason: "op_intent_confirming",
      };
    }

    if (demandLabel === "Strong") {
      return {
        replyStrategyLabel: "empathize_pain",
        replyStrategyReason: "demand_strong",
      };
    }

    return {
      replyStrategyLabel: "answer_and_ask",
      replyStrategyReason: "default_non_skip",
    };
  }

  function getReplyAngleText(label) {
    const angleMap = {
      answer_and_ask: "Answer their question, then ask one specific follow-up.",
      validate_and_add: "Validate their direction, then add one overlooked detail.",
      empathize_pain: "Name the pain clearly before suggesting anything.",
      quick_ping: "Keep it short and re-engage the OP with a simple question.",
    };
    return angleMap[label] || "";
  }

  function getQuickReply(label) {
    const replyMap = {
      answer_and_ask: {
        A: "I ran into something similar — what are you using right now?",
        B: "Curious what you've tried so far — anything that almost worked?",
      },
      validate_and_add: {
        A: "That direction makes sense — one thing to watch out for is edge cases.",
        B: "That approach can work — I'd double-check how it handles edge cases.",
      },
      empathize_pain: {
        A: "Yeah this is pretty frustrating, I had to deal with the same issue before.",
        B: "I get why that's annoying — I ran into the same kind of problem too.",
      },
      quick_ping: {
        A: "Curious if you ended up finding something that works?",
        B: "Did you ever land on a decent fix for this?",
      },
    };
    const variants = replyMap[label];
    if (!variants) return { text: "", variant: "" };
    const variant = Math.random() < 0.5 ? "A" : "B";
    return {
      text: variants[variant],
      variant,
    };
  }

  function applyGuardrail(result) {
    try {
      const guardrailConfig = CONFIG.guardrail;
      const baseRecommendationKey = normalizeRecommendationLabel(
        result.recommendation?.key || result.recommendation?.label || result.level || result.recommendation
      );
      const baseRecommendation = recommendationForKey(baseRecommendationKey);
      const signals = result.signals || {};
      const originalRecommendationKey = normalizeRecommendationLabel(
        result.originalRecommendation?.key || result.originalRecommendation?.label || result.originalRecommendation || baseRecommendationKey
      );
      const originalRecommendation = recommendationForKey(originalRecommendationKey);

      let timingScore = result.timingScore ?? 0;
      const originalTimingLabel = result.originalTimingLabel || result.timingLabel || "unknown";
      let timingLabelValue = result.timingLabel || "unknown";
      let timingAdjustedReason = "";
      let conversionScore = result.conversionScore ?? 0;
      let fakeActiveRisk = result.fakeActiveRisk || "Low";
      let fakeActiveAdjustedReason = "";
      let opStatus = result.opStatus || "unknown";
      let guardrailReason = "";
      const reasonParts = [];

      if (opStatus === guardrailConfig.opUnknownFix.opStatus && (signals.opReplyCount ?? result.opReplyCount ?? 0) >= guardrailConfig.opUnknownFix.minOpReplyCount) {
        opStatus = guardrailConfig.opUnknownFix.activeStatus;
        reasonParts.push("op_status_unknown_fixed");
      }

      if (
        timingLabelValue === guardrailConfig.lateButNotDead.timingLabel &&
        (signals.recentCommentCount1h ?? result.recentCommentCount1h ?? 0) >= guardrailConfig.lateButNotDead.recent1hComments &&
        (signals.threadAgeMinutes ?? result.threadAgeMinutes ?? 0) <= guardrailConfig.lateButNotDead.threadAgeMinutes
      ) {
        timingLabelValue = guardrailConfig.lateButNotDead.timingAdjustedLabel;
        timingScore = clamp(timingScore + guardrailConfig.lateButNotDead.timingScoreBoost, 0, 100);
        timingAdjustedReason = guardrailConfig.lateButNotDead.timingAdjustedReason;
        reasonParts.push(timingAdjustedReason);
      }

      if ((signals.opReplyCount ?? result.opReplyCount ?? 0) >= guardrailConfig.fakeActiveRefine.minOpReplyCount &&
          (signals.opLastReplyMinutes ?? result.opLastReplyMinutes ?? Infinity) <= guardrailConfig.fakeActiveRefine.maxOpLastReplyMinutes) {
        fakeActiveRisk = guardrailConfig.fakeActiveRefine.forceRisk;
        fakeActiveAdjustedReason = guardrailConfig.fakeActiveRefine.fakeActiveAdjustedReason;
        reasonParts.push(fakeActiveAdjustedReason);
      }

      const hasAcceptedSignal = Boolean(
        signals.hasAcceptedSignal ||
        signals.hasDmSignal ||
        signals.opOnlyThanks ||
        guardrailConfig.conversionDowngrade.acceptedPatterns.some((pattern) => {
          const text = `${signals.title || ""} ${(signals.opReplyTexts || []).join(" ")} ${(signals.commentTexts || []).join(" ")}`.toLowerCase();
          return text.includes(pattern);
        })
      );
      if (result.opIntent === guardrailConfig.conversionDowngrade.intent || hasAcceptedSignal) {
        conversionScore = clamp(conversionScore - guardrailConfig.conversionDowngrade.scorePenalty, guardrailConfig.conversionDowngrade.minScore, 100);
        reasonParts.push("late_phase_conversion_downgrade");
      }

      const aliveSignals = [
        (signals.opReplyCount ?? result.opReplyCount ?? 0) >= guardrailConfig.aliveSignals.opReplyCount,
        (signals.opLastReplyMinutes ?? result.opLastReplyMinutes ?? Infinity) <= guardrailConfig.aliveSignals.opLastReplyMinutes,
        (signals.recentCommentCount1h ?? result.recentCommentCount1h ?? 0) >= guardrailConfig.aliveSignals.recent1hComments,
        (signals.commentCount ?? result.totalComments ?? 0) >= guardrailConfig.aliveSignals.totalCommentsMin &&
          (signals.commentCount ?? result.totalComments ?? 0) <= guardrailConfig.aliveSignals.totalCommentsMax,
        (signals.threadAgeMinutes ?? result.threadAgeMinutes ?? Infinity) <= guardrailConfig.aliveSignals.threadAgeMinutes,
      ].filter(Boolean).length;
      const isAliveThread = aliveSignals >= guardrailConfig.aliveSignalsThreshold;

      const originalScore = result.opportunityScore ?? result.score ?? 0;
      let adjustedOpportunityScore = Math.round(
        (0.35 * timingScore) +
        (0.45 * conversionScore) +
        (0.20 * (result.demandScore ?? 0))
      );
      adjustedOpportunityScore = clamp(adjustedOpportunityScore, 0, 100);

      let adjustedRecommendation = baseRecommendation;
      let guardrailTriggered = false;

      if (
        originalRecommendation.label === guardrailConfig.recommendationOverride.originalRecommendation &&
        isAliveThread &&
        (result.opIntent || "unknown") !== "done" &&
        (result.fakeActiveRisk || fakeActiveRisk) !== "High"
      ) {
        guardrailTriggered = true;
        adjustedRecommendation = recommendationForKey("consider");
        adjustedOpportunityScore = Math.max(originalScore, guardrailConfig.recommendationOverride.minAdjustedScore);
        guardrailReason = guardrailConfig.recommendationOverride.guardrailReason;
        reasonParts.push(guardrailReason);
      }

      if (!guardrailReason && reasonParts.length > 0) {
        guardrailReason = reasonParts.join("|");
      }

      const isGuardrailAdjusted = guardrailTriggered === true;
      const adjustedTimingLabel = isGuardrailAdjusted && timingLabelValue === "Dead"
        ? "Late"
        : timingLabelValue;
      const { replyStrategyLabel, replyStrategyReason } = buildReplyStrategyLabel({
        recommendation: adjustedRecommendation,
        opIntent: result.opIntent,
        demandLabel: result.demandLabel,
        fakeActiveRisk,
        isGuardrailAdjusted,
      });
      const replyAngleText = getReplyAngleText(replyStrategyLabel);
      const quickReply = getQuickReply(replyStrategyLabel);

      return {
        ...result,
        adjustedOpportunityScore,
        adjustedRecommendation,
        adjustedRecommendationKey: adjustedRecommendation.key,
        originalOpportunityScore: originalScore,
        originalRecommendation,
        opportunityScore: adjustedOpportunityScore,
        recommendation: adjustedRecommendation,
        timingScore,
        originalTimingLabel,
        timingLabel: timingLabelValue,
        adjustedTimingLabel,
        timingAdjustedReason,
        conversionScore,
        fakeActiveRisk,
        fakeActiveAdjustedReason,
        opStatus,
        aliveSignals,
        isAliveThread,
        guardrailTriggered,
        isGuardrailAdjusted,
        guardrailReason: guardrailReason || "",
        guardrailNotes: reasonParts,
        replyStrategyLabel,
        replyStrategyReason,
        replyAngleText,
        quickReplyText: quickReply.text,
        quickReplyVariant: quickReply.variant,
      };
    } catch (error) {
      logPipelineError("applyGuardrail", error);
      return result || {
        recommendation: recommendationForKey("skip"),
        opportunityScore: 0,
        timingScore: 0,
        timingLabel: "Unknown",
        engagementScore: 0,
        engagementLabel: "Low",
        matchScore: 0,
        matchLabel: "Low match",
        conversionScore: 0,
        conversionLabel: "Low",
        demandScore: 0,
        demandLabel: "Low",
        fakeActiveRisk: "Low",
        opStatus: "unknown",
        opLastReplyAgo: "unknown",
        opReplyCount: 0,
        opIntent: "unknown",
        opIntentConfidence: "low",
        threadAgeMinutes: null,
        threadAgeAgo: "unknown",
        recentCommentCount30m: 0,
        recentCommentCount1h: 0,
        recentCommentCount2h: 0,
        uniqueCommenters: 0,
        replyDepth: 0,
        commentVelocity: 0,
        matchedKeywords: [],
        interestMatchSignals: {
          subreddit: null,
          titleKeywords: [],
          topicKeywords: [],
          painKeywords: [],
          productKeywords: [],
          keywords: [],
        },
        recentCommentGrowth: "unknown",
        opUsername: "unknown",
        aliveSignals: 0,
        isAliveThread: false,
        aliveSignalReasons: [],
        why: { positives: [], risks: [] },
        suggestedReplyAngle: null,
        suggestedReplyAngleShort: null,
        recommendationSummary: "Low opportunity right now",
        summary: "Low opportunity right now",
        level: "LOW",
        shouldReply: false,
        reasons: [],
        risks: [],
        suggestedAction: "Monitor the thread \u2014 not an ideal time to reply yet",
        signals: result?.signals || {},
      };
    }
  }

  function labelConfidence(signals) {
    let score = 100;
    const unknownFields = [
      signals.opStatus,
      signals.opIntent,
      signals.opLastReplyMinutes,
      signals.threadAgeMinutes,
      signals.commentCount,
    ].filter((value) => value == null || value === "unknown").length;

    score -= unknownFields * 12;
    if (signals.opLastReplyMinutes != null && signals.opLastReplyMinutes > 1440) score -= 18;
    if (signals.opReplyCount === 0) score -= 8;
    score = clamp(score, 0, 100);
    if (score >= 75) return "High";
    if (score >= 45) return "Medium";
    return "Low";
  }

  function scoreReplyOpportunity(signals) {
    const normalizedSignals = safeCompute("normalizeOpStatus", { ...(signals || {}) }, () => normalizeOpStatus(signals));
    const aliveSignalsState = safeCompute("buildAliveSignals", {
      aliveSignals: 0,
      isAliveThread: false,
      aliveSignalReasons: [],
    }, () => buildAliveSignals(normalizedSignals));
    const timing = safeCompute("buildTimingScore", {
      timingScore: 0,
      timingLabel: "Unknown",
    }, () => buildTimingScore(normalizedSignals));
    const engagement = safeCompute("buildEngagementScore", {
      engagementScore: 0,
      engagementLabel: "Low",
      uniqueCommenters: 0,
      replyDepth: 0,
      commentVelocity: 0,
      recent2hComments: 0,
    }, () => buildEngagementScore(normalizedSignals));
    const matchFallback = {
      matchScore: 0,
      matchLabel: "Low match",
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
      profileUpdatedAt: null,
    };
    const interestMatch = safeCompute("calculateMatchScore", matchFallback, () => {
      if (typeof globalThis.calculateMatchScore !== "function") return matchFallback;
      return { ...matchFallback, ...globalThis.calculateMatchScore(normalizedSignals) };
    });
    const conversion = safeCompute("buildConversionScore", {
      conversionScore: 0,
      conversionLabel: "Low",
    }, () => buildConversionScore(normalizedSignals));
    const demand = safeCompute("buildDemandScore", {
      demandScore: 0,
      demandLabel: "Low",
      painBuckets: [],
      askForToolHit: false,
      repeatedDemand: false,
    }, () => buildDemandScore(normalizedSignals));
    const fakeActiveRisk = safeCompute("buildFakeActiveRisk", "Low", () => buildFakeActiveRisk(normalizedSignals));

    const opportunityScore = safeCompute("scoreReplyOpportunity", 0, () => {
      let score = Math.round(
        (0.22 * (timing.timingScore ?? 0)) +
        (0.30 * (engagement.engagementScore ?? 0)) +
        (0.23 * (conversion.conversionScore ?? 0)) +
        (0.15 * (demand.demandScore ?? 0)) +
        (0.10 * (interestMatch.matchScore ?? 0))
      );

      if (fakeActiveRisk === "High") score -= 20;
      if (normalizedSignals.opIntent === "done") score -= 30;
      if (timing.timingLabel === "Dead") score -= 12;
      if (demand.demandLabel === "Weak") score -= 10;

      return clamp(score, 0, 100);
    });

    const recommendationMap = {
      reply_now: {
        key: "reply_now",
        label: "Reply now",
        emoji: "🟢",
        headline: "Worth replying right now",
      },
      consider: {
        key: "consider",
        label: "Consider",
        emoji: "🟡",
        headline: "Maybe reply if you have a sharp angle",
      },
      skip: {
        key: "skip",
        label: "Skip",
        emoji: "🔴",
        headline: "Not a good reply window",
      },
    };

    const recommendationKey = safeCompute("recommendationKey", "skip", () => {
      if (opportunityScore >= CONFIG.recommendation.replyNow && fakeActiveRisk !== "High" && normalizedSignals.opIntent !== "done") {
        return "reply_now";
      }
      if (opportunityScore >= CONFIG.recommendation.considerMin && fakeActiveRisk !== "High" && normalizedSignals.opIntent !== "done") {
        return "consider";
      }
      return "skip";
    });

    const recommendation = recommendationMap[recommendationKey] || recommendationMap.skip;
    const confidence = safeCompute("labelConfidence", "Low", () => labelConfidence(normalizedSignals));
    const why = safeCompute("buildWhy", { positives: [], risks: [] }, () => buildWhy(
      normalizedSignals,
      timing.timingLabel,
      engagement.engagementLabel,
      interestMatch.matchLabel,
      conversion.conversionLabel,
      demand.demandLabel,
      fakeActiveRisk
    ));
    const suggestedReplyAngle = safeCompute("buildSuggestion", null, () => buildSuggestion(normalizedSignals, recommendationKey));
    const suggestedReplyAngleShort = safeCompute("buildSuggestedReplyAngle", null, () => buildSuggestedReplyAngle(
      {
        ...normalizedSignals,
        demandLabel: demand.demandLabel,
        fakeActiveRisk,
      },
      recommendationKey
    ));
    const recommendationSummary = safeCompute("buildRecommendationSummary", "Low opportunity right now", () => buildRecommendationSummary(
      {
        ...normalizedSignals,
        demandLabel: demand.demandLabel,
        fakeActiveRisk,
      },
      recommendationKey
    ));
    const opLastReplyAgo = safeCompute("formatAge", "unknown", () => formatAge(normalizedSignals.opLastReplyMinutes));

    const summaryParts = [
      `${interestMatch.matchLabel || "Low match"}`,
      `${engagement.engagementLabel || "Low"} engagement`,
      `${demand.demandLabel || "Low"} demand`,
      `OP ${normalizedSignals.opIntent || "unknown"}`,
      `Timing ${timing.timingLabel || "Unknown"}`,
    ];

    const legacyLevel = recommendationKey === "reply_now" ? "HIGH" : recommendationKey === "consider" ? "MEDIUM" : "LOW";

    return {
      recommendation,
      opportunityScore,
      timingScore: timing.timingScore ?? 0,
      timingLabel: timing.timingLabel || "Unknown",
      engagementScore: engagement.engagementScore ?? 0,
      engagementLabel: engagement.engagementLabel || "Low",
      matchScore: interestMatch.matchScore ?? 0,
      matchLabel: interestMatch.matchLabel || "Low match",
      matchedSubreddits: interestMatch.matchedSubreddits || [],
      matchComponents: interestMatch.matchComponents || {
        subredditScore: 0,
        keywordScore: 0,
        painScore: 0,
        recentBoost: 0,
      },
      matchedKeywords: interestMatch.matchedKeywords || [],
      conversionScore: conversion.conversionScore ?? 0,
      conversionLabel: conversion.conversionLabel || "Low",
      demandScore: demand.demandScore ?? 0,
      demandLabel: demand.demandLabel || "Low",
      fakeActiveRisk,
      opStatus: normalizedSignals.opStatus || "unknown",
      opLastReplyAgo,
      opReplyCount: normalizedSignals.opReplyCount ?? 0,
      opIntent: normalizedSignals.opIntent || "unknown",
      opIntentConfidence: normalizedSignals.opIntentConfidence || confidence,
      threadAgeMinutes: normalizedSignals.threadAgeMinutes ?? null,
      threadAgeAgo: safeCompute("threadAgeAgo", "unknown", () => formatAge(normalizedSignals.threadAgeMinutes)),
      recentCommentCount30m: normalizedSignals.recentCommentCount30m ?? 0,
      recentCommentCount1h: normalizedSignals.recentCommentCount1h ?? 0,
      recentCommentCount2h: normalizedSignals.recentCommentCount2h ?? 0,
      uniqueCommenters: engagement.uniqueCommenters ?? 0,
      replyDepth: engagement.replyDepth ?? 0,
      commentVelocity: engagement.commentVelocity ?? 0,
      interestMatchSignals: interestMatch.matchSignals || {
        subreddit: null,
        titleKeywords: [],
        topicKeywords: [],
        painKeywords: [],
        productKeywords: [],
        keywords: [],
      },
      recentCommentGrowth: normalizedSignals.recentCommentGrowth ?? "unknown",
      opUsername: normalizedSignals.opUsername || "unknown",
      aliveSignals: aliveSignalsState.aliveSignals ?? 0,
      isAliveThread: aliveSignalsState.isAliveThread === true,
      aliveSignalReasons: aliveSignalsState.aliveSignalReasons || [],
      why,
      suggestedReplyAngle,
      suggestedReplyAngleShort,
      recommendationSummary,
      summary: safeCompute("summary", "Low opportunity right now", () => summaryParts.join(" · ")),
      level: legacyLevel,
      shouldReply: recommendationKey === "reply_now",
      reasons: Array.isArray(why.positives) ? why.positives : [],
      risks: Array.isArray(why.risks) ? why.risks : [],
      suggestedAction: suggestedReplyAngle,
      signals: normalizedSignals,
    };
  }

  globalThis.RGCReplyOpportunityConfig = CONFIG;
  globalThis.RGCReplyOpportunity = {
    scoreReplyOpportunity,
    applyGuardrail,
    getReplyAngleText,
    getQuickReply,
    formatAge,
    labelConfidence,
  };
})();
