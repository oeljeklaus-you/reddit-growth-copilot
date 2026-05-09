"use strict";
(() => {
  let rgc_dev_mode = false;
  let isDevMode = false;

  async function loadDevMode() {
    try {
      const { rgc_dev_mode: storedDevMode } = await chrome.storage.local.get("rgc_dev_mode");
      rgc_dev_mode = storedDevMode === true;
    } catch {
      rgc_dev_mode = false;
    }
    isDevMode = !!rgc_dev_mode;
    globalThis.rgc_dev_mode = isDevMode;
    return isDevMode;
  }
  // src/engine/classifyPostType.ts
  var QUESTION_WORDS = [
    "how",
    "why",
    "what",
    "is",
    "are",
    "does",
    "do",
    "should",
    "can",
    "where",
    "when"
  ];
  var QUESTION_PHRASES = [
    "any advice",
    "how do",
    "what do you think",
    "can someone",
    "should i"
  ];
  var DISCUSSION_WORDS = [
    "thoughts",
    "discussion",
    "opinions",
    "debate",
    "experience",
    "anyone else"
  ];
  var SHOWCASE_WORDS = [
    "i built",
    "launched",
    "showcase",
    "my project",
    "demo",
    "release"
  ];
  var LINK_WORDS = ["article", "blog", "read this", "link"];
  function classifyPostType(params) {
    const { hasExternalLink = false, hasImage = false, hasVideo = false } = params;
    const t = (params.title ?? "").toLowerCase().trim();
    const firstWord = t.split(/\s+/)[0] ?? "";
    if (hasVideo) return "video";
    if (hasImage) return "image";
    if (hasExternalLink) return "link";
    if (LINK_WORDS.some((w) => t.includes(w))) return "link";
    if (t.includes("?") || QUESTION_WORDS.includes(firstWord) || QUESTION_PHRASES.some((p) => t.includes(p))) return "question";
    if (DISCUSSION_WORDS.some((w) => t.includes(w))) return "discussion";
    if (SHOWCASE_WORDS.some((w) => t.includes(w))) return "showcase";
    return "unknown";
  }
  function titleHasQuestionMark(title) {
    return title.includes("?");
  }
  function titleStartsWithQuestionWord(title) {
    const first = title.toLowerCase().trim().split(/\s+/)[0] ?? "";
    return QUESTION_WORDS.includes(first);
  }

  // src/content/extractPostSignals.ts
  var TITLE_SELECTORS = [
    'h1[slot="title"]',
    // shreddit <shreddit-post>
    'div[data-testid="post-container"] h1',
    // new Reddit
    'div[data-click-id="text"] h1',
    // new Reddit alt
    ".Post h1",
    // new Reddit fallback
    'h1[class*="title"]',
    ".thing .title a.title",
    // old Reddit
    "h1"
    // last resort
  ];
  var UPVOTE_SELECTORS = [
    "shreddit-post[score]",
    // attribute on web component
    'div[data-testid="post-container"] [aria-label*="upvote" i]',
    "div[data-score]",
    ".score.unvoted",
    ".score.likes",
    '[data-testid="vote-count"]',
    "faceplate-number[pretty]"
  ];
  var COMMENT_SELECTORS = [
    "shreddit-post[comment-count]",
    // attribute on web component
    '[data-testid="post-container"] a[data-click-id="comments"]',
    '[data-click-id="comments"]',
    'a[aria-label*="comments" i]',
    ".comments-page-link",
    'a[data-click-id="comments"] span',
    ".num-comments",
    '[aria-label*="comments" i]'
  ];
  var TIME_SELECTORS = [
    "time[datetime]",
    // ISO timestamp attribute
    'span[data-testid="post-timestamp"]',
    "faceplate-timeago[ts]",
    // shreddit timeago
    "shreddit-post[created-timestamp]",
    // new Reddit
    ".tagline time",
    // old Reddit
    'a[data-testid="post_timestamp"]'
  ];
  var LOCKED_SELECTORS = [
    '[data-testid="post-container"] [data-locked="true"]',
    'div[data-testid="post-container"] [aria-label*="locked" i]',
    ".icon-lock",
    "shreddit-post[locked]"
  ];
  var ARCHIVED_SELECTORS = [
    "shreddit-post[archived]",
    '[data-archived="true"]',
    ".archived-notice"
  ];
  var NSFW_SELECTORS = [
    "shreddit-post[nsfw]",
    '[data-nsfw="true"]',
    ".icon-nsfw",
    ".nsfw-stamp",
    '[aria-label*="nsfw" i]'
  ];
  var SUBREDDIT_SELECTORS = [
    "shreddit-post[subreddit-prefixed-name]",
    'a[data-testid="subreddit-link"]',
    'a[href*="/r/"][data-click-id="subreddit"]',
    ".subreddit"
  ];
  var AUTHOR_SELECTORS = [
    "shreddit-post[author]",
    'a[data-testid="post_author_link"]',
    'a[href*="/user/"]',
    'a[href*="/u/"]',
    ".author"
  ];
  function q(selectors) {
    for (const sel of selectors) {
      try {
        const el3 = document.querySelector(sel);
        if (el3) return el3;
      } catch {
      }
    }
    return null;
  }
  function qText(selectors, pattern, root = document) {
    for (const sel of selectors) {
      try {
        const nodes = Array.from(root.querySelectorAll(sel));
        const match = nodes.find((node) => pattern.test((node.textContent || node.innerText || "").trim()));
        if (match) return match;
      } catch {
      }
    }
    return null;
  }
  function extractTitle() {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      const t = ogTitle.content?.trim() ?? "";
      if (t && t !== "reddit") return t;
    }
    const el3 = q(TITLE_SELECTORS);
    return el3 ? (el3.textContent ?? "").trim() : document.title.trim();
  }
  var BODY_SELECTORS = [
    'div[data-testid="post-container"] [data-click-id="text"]',
    'div[data-testid="post-container"] [data-testid="post-content"]',
    'div[data-testid="post-container"] .RichTextJSON-root',
    'div[data-testid="post-container"] .md',
    'shreddit-post [slot="text-body"]',
    'shreddit-post [data-testid="post-content"]',
    'shreddit-post .RichTextJSON-root',
    'shreddit-post .md'
  ];
  function extractBodyText() {
    const bodyEl = q(BODY_SELECTORS);
    if (!bodyEl) return "";
    return (bodyEl.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  function extractUpvotes() {
    const shredditPost = document.querySelector("shreddit-post");
    if (shredditPost) {
      const score = shredditPost.getAttribute("score");
      if (score !== null) {
        const n = parseInt(score, 10);
        if (!isNaN(n)) return n;
      }
    }
    const el3 = q(UPVOTE_SELECTORS);
    if (!el3) return null;
    const ds = el3.dataset?.score;
    if (ds !== void 0) {
      const n = parseInt(ds, 10);
      if (!isNaN(n)) return n;
    }
    const label = el3.getAttribute("aria-label") ?? "";
    const match = label.match(/([\d,.]+)k?\s*upvote/i);
    if (match) {
      const raw = parseFloat(match[1].replace(/,/g, ""));
      return label.toLowerCase().includes("k") ? Math.round(raw * 1e3) : Math.round(raw);
    }
    const pretty = el3.getAttribute("pretty") ?? el3.textContent ?? "";
    return parseShortNumber(pretty);
  }
  function extractCommentCount() {
    const shredditPost = document.querySelector("shreddit-post");
    if (shredditPost) {
      const cc = shredditPost.getAttribute("comment-count");
      if (cc !== null) {
        const n = parseInt(cc, 10);
        if (!isNaN(n)) return n;
      }
    }
    const el3 = q(COMMENT_SELECTORS);
    if (!el3) return null;
    const text = (el3.textContent ?? "").trim();
    const match = text.match(/([\d,]+)/);
    if (match) {
      const n = parseInt(match[1].replace(/,/g, ""), 10);
      if (!isNaN(n)) return n;
    }
    const ariaLabel = el3.getAttribute("aria-label") || "";
    const ariaMatch = ariaLabel.match(/([\d,.]+)\s*(k|m)?\s*comments?/i);
    if (ariaMatch) {
      const parsed = parseShortNumber(`${ariaMatch[1]}${ariaMatch[2] || ""}`);
      if (parsed != null) return parsed;
    }
    return null;
  }
  function extractAgeMinutes() {
    const shredditPost = document.querySelector("shreddit-post");
    if (shredditPost) {
      const ts = shredditPost.getAttribute("created-timestamp");
      if (ts) return isoToAgeMinutes(ts);
    }
    const timeEl = q(TIME_SELECTORS);
    if (!timeEl) return null;
    const dt = timeEl.getAttribute("datetime") || timeEl.getAttribute("ts");
    if (dt) return isoToAgeMinutes(dt);
    const postTimestamp = q(['span[data-testid="post-timestamp"]', 'time[datetime]']);
    if (postTimestamp) {
      const postTimestampValue = postTimestamp.getAttribute("datetime")
        || postTimestamp.getAttribute("ts")
        || postTimestamp.getAttribute("title")
        || postTimestamp.textContent
        || "";
      if (postTimestampValue) {
        const age = isoToAgeMinutes(postTimestampValue) ?? parseRelativeTime(postTimestampValue);
        if (age != null) return age;
      }
    }
    const title = timeEl.getAttribute("title") ?? "";
    return parseRelativeTime(title);
  }
  function isoToAgeMinutes(iso) {
    const ts = Date.parse(iso);
    if (isNaN(ts)) return null;
    return Math.max(0, Math.round((Date.now() - ts) / 6e4));
  }
  function parseRelativeTime(text) {
    const lower = text.toLowerCase();
    const match = lower.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
      minute: 1,
      hour: 60,
      day: 1440,
      week: 10080,
      month: 43200,
      year: 525600
    };
    return n * (multipliers[unit] ?? 1);
  }
  function parseShortNumber(text) {
    const t = text.trim().toLowerCase().replace(/,/g, "");
    if (!t) return null;
    const match = t.match(/^([\d.]+)(k|m)?$/);
    if (!match) return null;
    const n = parseFloat(match[1]);
    if (match[2] === "k") return Math.round(n * 1e3);
    if (match[2] === "m") return Math.round(n * 1e6);
    return Math.round(n);
  }
  function extractBoolAttr(selectors, attrName) {
    for (const sel of selectors) {
      try {
        const el3 = document.querySelector(sel);
        if (!el3) continue;
        if (attrName) {
          const val = el3.getAttribute(attrName);
          if (val !== null && val !== "false") return true;
        } else {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  function extractIsLocked() {
    const sp = document.querySelector("shreddit-post");
    if (sp?.hasAttribute("locked")) return true;
    const body = document.body.textContent ?? "";
    if (/comments?\s+(?:are\s+)?locked/i.test(body)) {
      const notice = document.querySelector(
        '[data-testid="locked-banner"], .locked-notification, .lock-icon, [aria-label*="locked" i]'
      );
      if (notice) return true;
    }
    return extractBoolAttr(LOCKED_SELECTORS.slice(1));
  }
  function extractIsArchived() {
    const sp = document.querySelector("shreddit-post");
    if (sp?.hasAttribute("archived")) return true;
    return extractBoolAttr(ARCHIVED_SELECTORS.slice(1));
  }
  function extractIsNSFW() {
    const sp = document.querySelector("shreddit-post");
    if (sp?.hasAttribute("nsfw")) return true;
    return extractBoolAttr(NSFW_SELECTORS.slice(1));
  }
  function extractHasMedia() {
    const sp = document.querySelector("shreddit-post");
    const postTypeAttr = sp?.getAttribute("post-type") ?? "";
    const hasVideo = postTypeAttr === "video" || !!document.querySelector('video[src], shreddit-player, [data-testid="post-video"]');
    const hasImage = postTypeAttr === "image" || !hasVideo && !!document.querySelector(
      '[data-testid="post-container"] img.media-element, figure img[src*="redd.it"], shreddit-post-media-body img'
    );
    return { hasImage, hasVideo };
  }
  function extractHasExternalLink() {
    const sp = document.querySelector("shreddit-post");
    const postTypeAttr = sp?.getAttribute("post-type") ?? "";
    if (postTypeAttr === "link") return true;
    const anchor = document.querySelector(
      '[data-testid="post-container"] a[data-click-id="body"][href]:not([href*="reddit.com"])'
    );
    return !!anchor;
  }
  function extractSubreddit() {
    const sp = document.querySelector("shreddit-post");
    if (sp) {
      const name = sp.getAttribute("subreddit-prefixed-name") ?? sp.getAttribute("subreddit-name");
      if (name) return name.replace(/^r\//, "");
    }
    const el3 = q(SUBREDDIT_SELECTORS.slice(1));
    if (!el3) return null;
    const href = el3.href ?? "";
    const match = href.match(/\/r\/([^/]+)/);
    return match ? match[1] : (el3.textContent ?? "").replace(/^r\//, "").trim() || null;
  }
  function extractAuthor() {
    const sp = document.querySelector("shreddit-post");
    if (sp) {
      const author = sp.getAttribute("author");
      if (author) return author;
    }
    const el3 = q(AUTHOR_SELECTORS.slice(1));
    if (el3) {
      const text = (el3.textContent ?? "").replace(/^u\//, "").trim();
      if (text) return text;
    }
    const postRoot = document.querySelector('shreddit-post, [data-testid="post-container"], .Post, .thing.link') || document.body;
    const opLabel = qText(['a, span, div, p'], /\bOP\b/i, postRoot);
    if (opLabel) {
      const authorLink = Array.from(postRoot.querySelectorAll([
        'a[data-testid="post_author_link"]',
        'a[href*="/user/"]',
        'a[href*="/u/"]',
        '.author'
      ].join(', '))).find(Boolean);
      if (authorLink) {
        const authorText = (authorLink.textContent ?? "").replace(/^u\//i, "").trim();
        if (authorText) return authorText;
      }
      const hrefMatch = Array.from((postRoot || document).querySelectorAll('a[href]'))
        .find((node) => /\/(?:user|u)\//i.test(node.getAttribute("href") || ""));
      if (hrefMatch) {
        const href = hrefMatch.getAttribute("href") || "";
        const match = href.match(/\/(?:user|u)\/([^/?#]+)/i);
        if (match?.[1]) return match[1];
      }
    }
    return null;
  }
  function extractPostUrl() {
    return location.href.split("#")[0];
  }
  function extractPostId() {
    const url = extractPostUrl();
    try {
      const path = new URL(url).pathname;
      const match = path.match(/\/comments\/([^/]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
  function extractPostSignals() {
    const title = extractTitle();
    const { hasImage, hasVideo } = extractHasMedia();
    const hasExternalLink = extractHasExternalLink();
    const postType = classifyPostType({ title, hasExternalLink, hasImage, hasVideo });
    const bodyText = extractBodyText();
    return {
      postId: extractPostId(),
      postUrl: extractPostUrl(),
      title,
      bodyText,
      upvotes: extractUpvotes(),
      commentCount: extractCommentCount(),
      ageMinutes: extractAgeMinutes(),
      subreddit: extractSubreddit(),
      author: extractAuthor(),
      postType,
      isNSFW: extractIsNSFW(),
      isLocked: extractIsLocked(),
      isArchived: extractIsArchived(),
      hasExternalLink,
      titleLength: title.length,
      titleHasQuestionMark: titleHasQuestionMark(title),
      titleStartsWithQuestionWord: titleStartsWithQuestionWord(title)
    };
  }

  // src/content/extractReplyOpportunitySignals.ts
  var COMMENT_ROOT_SELECTORS = [
    "shreddit-comment",
    "[data-testid=\"comment\"]",
    "[data-testid^=\"comment-\"]",
    ".Comment",
    ".thing.comment",
    ".comment"
  ];
  var COMMENT_AUTHOR_SELECTORS = [
    "a[data-testid=\"comment_author_link\"]",
    "a[href*=\"/user/\"]",
    "a[href*=\"/u/\"]",
    ".author",
    "[slot=\"author\"]"
  ];
  var COMMENT_TIME_SELECTORS = [
    "faceplate-timeago[ts]",
    "time[datetime]",
    "[created-timestamp]"
  ];
  var OP_INTENT_EXPLORE_PHRASES = [
    "how",
    "why",
    "what about",
    "any advice",
    "still trying",
    "looking for",
    "not sure",
    "confused",
    "stuck"
  ];
  var OP_INTENT_CONFIRM_PHRASES = [
    "i might try",
    "considering",
    "leaning toward",
    "makes sense",
    "good point",
    "i'll check",
    "ill check",
    "i'll look into",
    "ill look into"
  ];
  var OP_INTENT_DONE_PHRASES = [
    "thanks everyone",
    "solved",
    "fixed",
    "got it",
    "figured it out",
    "went with",
    "decided to",
    "no longer needed"
  ];
  var THANKS_ONLY_PATTERNS = [
    /^thanks(?: everyone)?[.!]?\s*$/i,
    /^thank you(?: everyone)?[.!]?\s*$/i,
    /^got it[.!]?\s*$/i,
    /^thanks!\s*$/i
  ];
  function normalizeUsername(value) {
    return String(value || "").trim().replace(/^@/, "").replace(/^u\//i, "").replace(/^\/?u\//i, "").toLowerCase();
  }
  function normalizeCommentText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function parseTimeLike(text) {
    const lower = String(text || "").toLowerCase();
    const match = lower.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
      minute: 1,
      hour: 60,
      day: 1440,
      week: 10080,
      month: 43200,
      year: 525600
    };
    return n * (multipliers[unit] || 1);
  }
  function isoToAgeMinutesSafe(value) {
    const ts = Date.parse(value);
    if (isNaN(ts)) return null;
    return Math.max(0, Math.round((Date.now() - ts) / 6e4));
  }
  function formatAgeMinutes(value) {
    if (value == null || isNaN(value)) return "unknown";
    if (value < 60) return `${Math.max(0, Math.round(value))}m`;
    if (value < 1440) return `${Math.max(1, Math.round(value / 60))}h`;
    return `${Math.max(1, Math.round(value / 1440))}d`;
  }
  function queryFirst(root, selectors) {
    for (const sel of selectors) {
      try {
        const el3 = root.querySelector(sel);
        if (el3) return el3;
      } catch {
      }
    }
    return null;
  }
  function queryCommentRoots() {
    const seen = new Set();
    const roots = [];
    for (const sel of COMMENT_ROOT_SELECTORS) {
      try {
        document.querySelectorAll(sel).forEach((el3) => {
          if (seen.has(el3)) return;
          seen.add(el3);
          const text = normalizeCommentText(el3.innerText || el3.textContent || "");
          if (text.length < 12) return;
          roots.push(el3);
        });
      } catch {
      }
    }
    return roots.slice(0, 300);
  }
  function extractCommentAuthor(root) {
    try {
      const direct = root.getAttribute("author") || root.getAttribute("data-author");
      if (direct) return normalizeUsername(direct);
    } catch {
    }
    const authorEl = queryFirst(root, COMMENT_AUTHOR_SELECTORS);
    if (authorEl) {
      const href = authorEl.getAttribute("href") || "";
      const text = normalizeCommentText(authorEl.textContent || authorEl.innerText || "");
      const fromHref = href.match(/\/(?:user|u)\/([^/?#]+)/i);
      if (fromHref) return normalizeUsername(fromHref[1]);
      if (text) return normalizeUsername(text);
    }
    return null;
  }
  function extractCommentAgeMinutes(root) {
    try {
      const tsAttr = root.getAttribute("created-timestamp");
      if (tsAttr) return isoToAgeMinutesSafe(tsAttr);
    } catch {
    }
    const timeEl = queryFirst(root, COMMENT_TIME_SELECTORS);
    if (!timeEl) return null;
    const ts = timeEl.getAttribute("datetime") || timeEl.getAttribute("ts") || timeEl.getAttribute("created-timestamp");
    if (ts) return isoToAgeMinutesSafe(ts);
    const title = timeEl.getAttribute("title") || timeEl.textContent || "";
    return parseTimeLike(title);
  }
  function extractCommentText(root) {
    return normalizeCommentText(root.innerText || root.textContent || "");
  }
  function classifyOpIntent(text, opReplyCount, opLastReplyMinutes) {
    const lower = normalizeCommentText(text).toLowerCase();
    if (!opReplyCount) return { intent: "unknown", confidence: "low" };

    const done = OP_INTENT_DONE_PHRASES.some((phrase) => lower.includes(phrase));
    const exploring = /\?/.test(lower) || OP_INTENT_EXPLORE_PHRASES.some((phrase) => lower.includes(phrase));
    const confirming = OP_INTENT_CONFIRM_PHRASES.some((phrase) => lower.includes(phrase));

    let intent = "unknown";
    if (done) intent = "done";
    else if (exploring) intent = "exploring";
    else if (confirming) intent = "confirming";

    let confidence = "medium";
    if (opLastReplyMinutes != null && opLastReplyMinutes > 1440) confidence = "low";
    if (opReplyCount === 1 && intent !== "done") confidence = "low";
    if (intent === "unknown") confidence = "low";
    return { intent, confidence };
  }
  function collectReplyOpportunitySignals(baseSignals) {
    const commentRoots = queryCommentRoots();
    const baseAuthor = normalizeUsername(baseSignals.author || "");
    const allComments = [];
    const commentAuthors = [];
    const opReplies = [];
    let maxReplyDepth = 0;
    let recent30m = 0;
    let recent1h = 0;
    let recent2h = 0;
    let latestCommentMinutes = null;
    let latestOpReplyMinutes = null;
    let opReplyFollowUps = 0;
    let opOnlyThanks = false;
    let repeatedDemandCount = 0;
    const demandSeen = [];

    for (const root of commentRoots) {
      const author = extractCommentAuthor(root);
      const ageMinutes = extractCommentAgeMinutes(root);
      const text = extractCommentText(root);
      if (!text) continue;

      allComments.push(text);
      if (author) commentAuthors.push(author);
      if (ageMinutes != null) {
        if (latestCommentMinutes == null || ageMinutes < latestCommentMinutes) latestCommentMinutes = ageMinutes;
        if (ageMinutes <= 30) recent30m += 1;
        if (ageMinutes <= 60) recent1h += 1;
        if (ageMinutes <= 120) recent2h += 1;
      }

      const lower = text.toLowerCase();
      const painHit = /stuck|annoying|frustrating|problem|issue|struggling|hate|painful|broken|need help|any tool|alternative|automate|manually|waste time/.test(lower);
      const toolHit = /is there a tool|any app|software|extension|plugin|service|platform|workaround/.test(lower);
      if (painHit || toolHit) demandSeen.push(lower);

      if (!baseAuthor || !author || author !== baseAuthor) continue;

      opReplies.push({ text, ageMinutes });
      if (ageMinutes != null) {
        if (latestOpReplyMinutes == null || ageMinutes < latestOpReplyMinutes) latestOpReplyMinutes = ageMinutes;
      }
      if (/\?/.test(lower) || /how|why|what about|any advice|still trying|looking for|not sure|confused|stuck/.test(lower)) {
        opReplyFollowUps += 1;
      }
      if (THANKS_ONLY_PATTERNS.some((pattern) => pattern.test(text))) {
        opOnlyThanks = true;
      }
      if (getNestedCommentRoots(root).length > 0) {
        maxReplyDepth = Math.max(maxReplyDepth, 2);
      }
    }

    const intentText = opReplies.map((item) => item.text).join(" ");
    const intent = classifyOpIntent(intentText, opReplies.length, latestOpReplyMinutes);
    const opStatus =
      !baseAuthor ? "unknown" :
      opReplies.length === 0 ? "unknown" :
      latestOpReplyMinutes != null && latestOpReplyMinutes > 1440 ? "inactive" :
      "active";

    const recentCommentGrowth =
      recent30m > 0 ? true :
      recent1h > recent30m ? true :
      recent2h > 0 ? false :
      "unknown";

    const commentCount = baseSignals.commentCount != null ? baseSignals.commentCount : commentRoots.length || null;

    return {
      ...baseSignals,
      threadAgeMinutes: baseSignals.ageMinutes ?? null,
      commentCount,
      recentCommentCount30m: recent30m,
      recentCommentCount1h: recent1h,
      recentCommentCount2h: recent2h,
      recentCommentGrowth,
      latestCommentMinutes,
      opUsername: baseAuthor || "unknown",
      opReplyCount: opReplies.length,
      opLastReplyMinutes: latestOpReplyMinutes,
      opLastReplyAgo: formatAgeMinutes(latestOpReplyMinutes),
      opStatus,
      opIntent: intent.intent,
      opIntentConfidence: intent.confidence,
      opFollowUpCount: opReplyFollowUps,
      opOnlyThanks,
      commentTexts: allComments,
      opReplyTexts: opReplies.map((item) => item.text),
      commentAuthors: commentAuthors,
      uniqueCommenters: new Set(commentAuthors.filter(Boolean)).size,
      replyDepth: maxReplyDepth,
      commentVelocity: Math.max(0, (recent1h * 2) - recent2h),
      repeatedDemandCount: demandSeen.length,
      rawCommentRootsCount: commentRoots.length
    };
  }
  function extractReplyOpportunitySignals() {
    const base = extractPostSignals();
    return collectReplyOpportunitySignals(base);
  }

  // src/content/extractFeedPosts.ts
  var FEED_ROOT_SELECTOR = 'shreddit-post, [data-testid="post-container"], .Post, .thing.link';
  var TITLE_SELECTORS2 = [
    '[slot="title"]',
    "h3",
    "h2",
    ".thing .title",
    ".title"
  ];
  var COMMENT_SELECTORS2 = [
    'a[data-click-id="comments"]',
    '[data-click-id="comments"]',
    'a[aria-label*="comments" i]',
    '[aria-label*="comments" i]',
    'a[href*="/comments/"]',
    ".num-comments"
  ];
  var TIME_SELECTORS2 = [
    "time[datetime]",
    'span[data-testid="post-timestamp"]',
    "faceplate-timeago[ts]",
    "[created-timestamp]",
    ".tagline time"
  ];
  var UPVOTE_SELECTORS2 = [
    "faceplate-number[pretty]",
    '[data-testid="vote-count"]',
    '[aria-label*="upvote" i]',
    "[data-score]",
    ".score"
  ];
  function q2(root, selectors) {
    for (const sel of selectors) {
      try {
        const el3 = root.querySelector(sel);
        if (el3) return el3;
      } catch {
      }
    }
    return null;
  }
  function queryFeedRoots() {
    return Array.from(document.querySelectorAll(FEED_ROOT_SELECTOR)).filter((el3) => {
      const text = (el3.textContent || "").trim();
      return text.length > 20;
    }).slice(0, 12);
  }
  function parseShortNumber2(text) {
    const t = text.trim().toLowerCase().replace(/,/g, "");
    if (!t) return null;
    const match = t.match(/^([\d.]+)(k|m)?$/);
    if (!match) return null;
    const n = parseFloat(match[1]);
    if (Number.isNaN(n)) return null;
    if (match[2] === "k") return Math.round(n * 1e3);
    if (match[2] === "m") return Math.round(n * 1e6);
    return Math.round(n);
  }
  function isoToAgeMinutes2(iso) {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return null;
    return Math.max(0, Math.round((Date.now() - ts) / 6e4));
  }
  function parseRelativeTime2(text) {
    const lower = text.toLowerCase();
    const match = lower.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
      minute: 1,
      hour: 60,
      day: 1440,
      week: 10080,
      month: 43200,
      year: 525600
    };
    return n * (multipliers[unit] ?? 1);
  }
  function extractTitle2(root) {
    const attrTitle = root.getAttribute("post-title") || root.getAttribute("aria-label");
    if (attrTitle && attrTitle.trim().length > 3) return attrTitle.trim();
    const titleEl = q2(root, TITLE_SELECTORS2);
    return titleEl ? (titleEl.textContent || "").trim() : "";
  }
  function extractPermalink(root) {
    const commentsLink = q2(root, COMMENT_SELECTORS2);
    if (commentsLink && commentsLink.href) return commentsLink.href;
    const bodyLink = root.querySelector('a[data-click-id="body"][href], a[href*="/comments/"]');
    return bodyLink?.href || null;
  }
  function extractCommentCount2(root) {
    const attr = root.getAttribute("comment-count");
    if (attr) {
      const parsed = parseInt(attr, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const el3 = q2(root, COMMENT_SELECTORS2);
    if (!el3) return null;
    const text = (el3.textContent || "").trim();
    const match = text.match(/([\d,.]+)\s*(k|m)?/i);
    if (match) {
      const parsed = parseShortNumber2(`${match[1]}${match[2] || ""}`);
      if (parsed != null) return parsed;
    }
    const ariaMatch = (el3.getAttribute("aria-label") || "").match(/([\d,.]+)\s*(k|m)?\s*comments?/i);
    if (ariaMatch) return parseShortNumber2(`${ariaMatch[1]}${ariaMatch[2] || ""}`);
    return null;
  }
  function extractUpvotes2(root) {
    const attr = root.getAttribute("score");
    if (attr) {
      const parsed = parseInt(attr, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const el3 = q2(root, UPVOTE_SELECTORS2);
    if (!el3) return null;
    const ds = el3.dataset?.score;
    if (ds) {
      const parsed = parseInt(ds, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const pretty = el3.getAttribute("pretty") || el3.textContent || "";
    const parsedPretty = parseShortNumber2(pretty);
    if (parsedPretty != null) return parsedPretty;
    const label = el3.getAttribute("aria-label") || "";
    const match = label.match(/([\d,.]+)\s*(k|m)?\s*upvote/i);
    if (!match) return null;
    return parseShortNumber2(`${match[1]}${match[2] || ""}`);
  }
  function extractAgeMinutes2(root) {
    const attr = root.getAttribute("created-timestamp");
    if (attr) return isoToAgeMinutes2(attr);
    const el3 = q2(root, TIME_SELECTORS2);
    if (!el3) return null;
    const ts = el3.getAttribute("ts") || el3.getAttribute("datetime");
    if (ts) return isoToAgeMinutes2(ts);
    const postTimestamp = q2(root, ['span[data-testid="post-timestamp"]', 'time[datetime]']);
    if (postTimestamp) {
      const value = postTimestamp.getAttribute("datetime")
        || postTimestamp.getAttribute("ts")
        || postTimestamp.getAttribute("title")
        || postTimestamp.textContent
        || "";
      const age = isoToAgeMinutes2(value) ?? parseRelativeTime2(value);
      if (age != null) return age;
    }
    return parseRelativeTime2(el3.getAttribute("title") || el3.textContent || "");
  }
  function extractBool(root, selector) {
    try {
      return Boolean(root.matches(selector) || root.querySelector(selector));
    } catch {
      return false;
    }
  }
  function extractFeedSignals(root) {
    const title = extractTitle2(root);
    if (!title) return null;
    const hasExternalLink = Boolean(root.querySelector('a[href^="http"]:not([href*="reddit.com"])'));
    const hasImage = Boolean(root.querySelector('img[src], [post-type="image"]'));
    const hasVideo = Boolean(root.querySelector('video, shreddit-player, [post-type="video"]'));
    const postType = classifyPostType({ title, hasExternalLink, hasImage, hasVideo });
    return {
      title,
      upvotes: extractUpvotes2(root),
      commentCount: extractCommentCount2(root),
      ageMinutes: extractAgeMinutes2(root),
      postType,
      hasExternalLink,
      isLocked: extractBool(root, '[data-locked="true"], [aria-label*="locked" i], [locked], .icon-lock'),
      isArchived: extractBool(root, '[data-archived="true"], [archived], .archived-notice'),
      titleLength: title.length,
      titleHasQuestionMark: titleHasQuestionMark(title),
      titleStartsWithQuestionWord: titleStartsWithQuestionWord(title)
    };
  }
  function extractFeedPostCandidates() {
    const seen = /* @__PURE__ */ new Set();
    return queryFeedRoots().map((root) => {
      const signals = extractFeedSignals(root);
      if (!signals) return null;
      const permalink = extractPermalink(root);
      const dedupeKey = permalink || signals.title;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        root,
        permalink,
        signals
      };
    }).filter((item) => Boolean(item));
  }

  // src/engine/commentDraftScoring.ts
  var PROMO_PATTERNS = [
    /https?:\/\//i,
    /\b(buy|sale|discount|promo|subscribe|signup|sign up|follow me)\b/i
  ];
  var HOSTILE_PATTERNS = [
    /\b(stupid|idiot|dumb|trash|shut up|worst take)\b/i
  ];
  var SPECIFICITY_PATTERNS = [
    /\b(because|for example|for instance|in my experience|i tried|i found|personally)\b/i,
    /\b\d+\b/
  ];
  function scoreCommentDraft(text) {
    const draft = String(text || "").trim();
    const lower = draft.toLowerCase();
    const charCount = draft.length;
    const wordCount = draft ? draft.split(/\s+/).filter(Boolean).length : 0;
    let score = 50;
    const issues = [];
    const suggestions = [];
    if (charCount < 20) {
      score -= 30;
      issues.push("Too short to add much value");
      suggestions.push("Add one concrete point, example, or reason.");
    } else if (charCount < 45) {
      score -= 14;
      issues.push("Reply feels brief");
      suggestions.push("Expand it with a little more context.");
    } else if (charCount <= 280) {
      score += 18;
    } else if (charCount > 550) {
      score -= 18;
      issues.push("Reply is getting long");
      suggestions.push("Trim it to the strongest 2\u20133 points.");
    }
    if (wordCount <= 8) {
      score -= 16;
      if (!issues.includes("Too short to add much value")) {
        issues.push("Very short replies are easy to ignore");
      }
    }
    if (SPECIFICITY_PATTERNS.some((pattern) => pattern.test(lower))) {
      score += 10;
    } else if (charCount >= 45) {
      issues.push("Lacks a concrete example or reason");
      suggestions.push("Use \u201Cbecause\u2026\u201D, \u201Cfor example\u2026\u201D, or share a quick experience.");
    }
    if (/\?/.test(draft)) {
      score += 6;
    }
    if (/[.!]/.test(draft)) {
      score += 4;
    } else if (charCount >= 35) {
      score -= 6;
      issues.push("Missing clear sentence structure");
      suggestions.push("Add punctuation so the reply is easier to read.");
    }
    if (/\n/.test(draft) && charCount > 180) {
      score += 6;
    }
    if (PROMO_PATTERNS.some((pattern) => pattern.test(draft))) {
      score -= 28;
      issues.push("Looks promotional or link-heavy");
      suggestions.push("Remove links or self-promo and focus on helping first.");
    }
    if (HOSTILE_PATTERNS.some((pattern) => pattern.test(lower))) {
      score -= 22;
      issues.push("Tone may come across as hostile");
      suggestions.push("Use a calmer, more constructive tone.");
    }
    const uppercaseLetters = (draft.match(/[A-Z]/g) || []).length;
    const letterCount = (draft.match(/[A-Za-z]/g) || []).length;
    if (letterCount > 8 && uppercaseLetters / letterCount > 0.35) {
      score -= 12;
      issues.push("Too much ALL CAPS emphasis");
      suggestions.push("Use normal casing for a more trustworthy tone.");
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    const level = score >= 76 ? "STRONG" : score >= 52 ? "OKAY" : "WEAK";
    const summary = level === "STRONG" ? "Strong reply draft" : level === "OKAY" ? "Decent draft, but could be tighter" : "Weak draft right now";
    return {
      score,
      level,
      summary,
      issues: issues.slice(0, 3),
      suggestions: suggestions.slice(0, 3),
      charCount,
      wordCount
    };
  }

  // src/engine/scoringEngine.ts
  var W = {
    freshness: 22,
    competition: 20,
    velocity: 15,
    engagementGap: 13,
    replyability: 18,
    timingFit: 12
  };
  function calculateFreshnessScore(ageMinutes) {
    if (ageMinutes == null) return 50;
    if (ageMinutes <= 30) return 100;
    if (ageMinutes <= 90) return 88;
    if (ageMinutes <= 240) return 72;
    if (ageMinutes <= 720) return 50;
    if (ageMinutes <= 1440) return 30;
    if (ageMinutes <= 4320) return 15;
    return 5;
  }
  function calculateCompetitionScore(commentCount) {
    if (commentCount == null) return 55;
    if (commentCount <= 2) return 100;
    if (commentCount <= 8) return 85;
    if (commentCount <= 20) return 68;
    if (commentCount <= 50) return 45;
    if (commentCount <= 100) return 25;
    return 10;
  }
  function calculateVelocityScore(commentCount, ageMinutes) {
    if (commentCount == null || ageMinutes == null || ageMinutes <= 0) return 50;
    const ageHours = ageMinutes / 60;
    const rate = commentCount / ageHours;
    if (rate < 0.2) return 35;
    if (rate < 1) return 60;
    if (rate < 4) return 90;
    if (rate < 10) return 75;
    if (rate < 20) return 45;
    return 20;
  }
  function calculateEngagementGapScore(upvotes, commentCount) {
    if (upvotes == null || commentCount == null) return 50;
    if (upvotes <= 0) return 40;
    const ratio = commentCount / upvotes;
    if (ratio < 0.05) return 95;
    if (ratio < 0.15) return 80;
    if (ratio < 0.4) return 60;
    if (ratio < 1) return 40;
    return 25;
  }
  var HIGH_REPLY_WORDS = [
    "how",
    "why",
    "what",
    "should",
    "anyone",
    "help",
    "advice",
    "thoughts",
    "opinion",
    "experience",
    "recommend",
    "suggest",
    "vs",
    "versus",
    "better",
    "worse",
    "problem",
    "issue",
    "stuck",
    "confused",
    "not sure",
    "wondering"
  ];
  var LOW_REPLY_WORDS = [
    "rip",
    "lol",
    "lmao",
    "\u{1F602}",
    "\u{1F525}",
    "based",
    "cope",
    "ratio"
  ];
  function calculateReplyabilityScore(title, postType, titleHasQuestionMark2, titleStartsWithQuestionWord2) {
    const t = title.toLowerCase();
    let score = 50;
    if (postType === "question") score += 25;
    else if (postType === "discussion") score += 15;
    else if (postType === "link") score -= 10;
    else if (postType === "image") score -= 15;
    else if (postType === "video") score -= 15;
    else if (postType === "showcase") score -= 5;
    if (titleHasQuestionMark2) score += 12;
    if (titleStartsWithQuestionWord2) score += 10;
    const highMatches = HIGH_REPLY_WORDS.filter((w) => t.includes(w)).length;
    const lowMatches = LOW_REPLY_WORDS.filter((w) => t.includes(w)).length;
    score += highMatches * 6;
    score -= lowMatches * 8;
    if (title.length < 10) score -= 10;
    else if (title.length > 20) score += 5;
    return Math.max(0, Math.min(100, score));
  }
  function calculateTimingFitScore(ageMinutes, commentCount, upvotes) {
    const age = ageMinutes ?? Infinity;
    const com = commentCount ?? 0;
    const ups = upvotes ?? 0;
    if (age <= 90 && com <= 10 && ups >= 5) return 95;
    if (age <= 90 && com <= 5) return 80;
    if (age > 1440 && com <= 5) return 35;
    if (age > 720 && com > 50) return 15;
    if (ups >= 50 && com <= 20) return 85;
    return 55;
  }
  function weightedScore(dimensions) {
    return Math.round(
      Object.entries(W).reduce((sum, [key, weight]) => {
        return sum + dimensions[key] / 100 * weight;
      }, 0)
    );
  }
  function logOpportunityPipelineError(stage, error) {
    if (globalThis.rgc_dev_mode === true) {
      console.error(`[RGC] ${stage} failed`, error);
    }
  }
  function safeOpportunityCompute(stage, fallback, compute) {
    try {
      return compute();
    } catch (error) {
      logOpportunityPipelineError(stage, error);
      return fallback;
    }
  }
  function buildReasons(signals, dim) {
    const reasons = [];
    const age = signals.ageMinutes ?? null;
    const com = signals.commentCount ?? null;
    const ups = signals.upvotes ?? null;
    if (dim.freshness >= 85) reasons.push("Posted just minutes ago \u2014 be one of the first to reply");
    else if (dim.freshness >= 65) reasons.push("Post is still fresh \u2014 good window to join in");
    else if (dim.freshness < 30) reasons.push("Post is aging \u2014 most people have moved on");
    if (dim.competition >= 80) reasons.push("Very few replies so far \u2014 plenty of room to stand out");
    else if (dim.competition >= 60) reasons.push("Low reply count \u2014 your comment will be visible");
    else if (dim.competition < 35) reasons.push("Already crowded \u2014 hard to get noticed");
    if (dim.velocity >= 80) reasons.push("Thread is picking up momentum at a good pace");
    else if (dim.velocity < 40) reasons.push("Thread is quiet \u2014 may not gain much traction");
    if (dim.engagementGap >= 75 && ups != null && ups > 10)
      reasons.push(`${ups} upvotes but only ${com ?? "?"} comments \u2014 lots of readers, few replies`);
    if (ups != null && com != null && ups >= 10 && ups <= 80 && com <= 20)
      reasons.push("Already showing traction without being crowded yet");
    if (dim.replyability >= 75) reasons.push("Question-style post \u2014 people are looking for answers");
    else if (dim.replyability >= 55) reasons.push("Post has clear discussion potential");
    if (dim.timingFit >= 85) reasons.push("Good chance to be seen early \u2014 act now");
    if (reasons.length < 2) reasons.push("Moderate opportunity based on current signals");
    return reasons.slice(0, 4);
  }
  function buildRisks(signals, dim, score) {
    if (score >= 80) return [];
    const risks = [];
    if (dim.velocity > 75 && (signals.commentCount ?? 0) > 30)
      risks.push("Thread growing fast \u2014 your reply may get buried");
    if (dim.freshness < 30)
      risks.push("Post is old \u2014 engagement may already have peaked");
    if (dim.replyability < 40)
      risks.push("Thread may not be seeking replies");
    if ((signals.upvotes ?? 0) > 200)
      risks.push("Viral post \u2014 standing out will be harder");
    return risks.slice(0, 2);
  }
  function buildSuggestedAction(level, dim, signals) {
    if (signals.isLocked || signals.isArchived) return "No action \u2014 thread is closed";
    if (level === "HIGH") {
      if (dim.replyability >= 75) return "Reply now with a specific, experience-based answer";
      if (dim.engagementGap >= 75) return "Reply now \u2014 add insight before competition grows";
      return "Reply early to maximise visibility";
    }
    if (level === "MEDIUM") {
      if (dim.freshness < 40) return "Reply if you have a unique perspective \u2014 thread is slowing";
      return "Reply with a concise, value-adding comment";
    }
    return "Monitor the thread \u2014 not an ideal time to reply yet";
  }
  function scorePost(signals) {
    try {
      if (signals.isLocked) {
        return hardBlock(signals, "Post is locked", "No action \u2014 thread is closed");
      }
      if (signals.isArchived) {
        return hardBlock(signals, "Post is archived", "No action \u2014 thread is closed");
      }
      const dim = {
        freshness: safeOpportunityCompute("calculateFreshnessScore", 0, () => calculateFreshnessScore(signals.ageMinutes)),
        competition: safeOpportunityCompute("calculateCompetitionScore", 0, () => calculateCompetitionScore(signals.commentCount)),
        velocity: safeOpportunityCompute("calculateVelocityScore", 0, () => calculateVelocityScore(signals.commentCount, signals.ageMinutes)),
        engagementGap: safeOpportunityCompute("calculateEngagementGapScore", 0, () => calculateEngagementGapScore(signals.upvotes, signals.commentCount)),
        replyability: safeOpportunityCompute(
          "calculateReplyabilityScore",
          0,
          () => calculateReplyabilityScore(
            signals.title,
            signals.postType,
            signals.titleHasQuestionMark,
            signals.titleStartsWithQuestionWord
          )
        ),
        timingFit: safeOpportunityCompute("calculateTimingFitScore", 0, () => calculateTimingFitScore(signals.ageMinutes, signals.commentCount, signals.upvotes))
      };
      const score = safeOpportunityCompute("weightedScore", 0, () => Math.max(0, Math.min(100, weightedScore(dim))));
      const level = score >= 72 ? "HIGH" : score >= 48 ? "MEDIUM" : "LOW";
      const shouldReply = score >= 58;
      const reasons = safeOpportunityCompute("buildReasons", [], () => buildReasons(signals, dim));
      const risks = safeOpportunityCompute("buildRisks", [], () => buildRisks(signals, dim, score));
      const suggestedAction = safeOpportunityCompute("buildSuggestedAction", "Monitor the thread \u2014 not an ideal time to reply yet", () => buildSuggestedAction(level, dim, signals));
      const summary = level === "HIGH" ? "Good time to reply" : level === "MEDIUM" ? "Moderate opportunity" : "Low opportunity right now";
      return {
        score,
        level,
        shouldReply,
        summary,
        reasons,
        risks,
        suggestedAction,
        signals: {
          ageMinutes: signals.ageMinutes,
          commentCount: signals.commentCount,
          upvotes: signals.upvotes,
          postType: signals.postType,
          isLocked: signals.isLocked,
          isArchived: signals.isArchived
        }
      };
    } catch (error) {
      logOpportunityPipelineError("scorePost", error);
      return hardBlock(signals, "Analysis failed", "No action \u2014 thread is closed");
    }
  }
  function hardBlock(signals, reason, action) {
    return {
      score: 0,
      level: "LOW",
      shouldReply: false,
      summary: "Thread is closed",
      reasons: [reason],
      risks: [],
      suggestedAction: action,
      signals: {
        ageMinutes: signals.ageMinutes,
        commentCount: signals.commentCount,
        upvotes: signals.upvotes,
        postType: signals.postType,
        isLocked: signals.isLocked,
        isArchived: signals.isArchived
      }
    };
  }

  // src/content/components/OpportunityPanel.ts
  var PANEL_ID = "rgc-opp-panel";
  var DISMISSED_KEY = "rgc-opp-dismissed";
  var COMMENT_DRAFT_SECTION_ID = "rgc-opp-comment-draft";
  var POST_BODY_SELECTORS = [
    "shreddit-post",
    '[data-testid="post-container"]',
    ".Post",
    ".thing.link"
  ];
  var COMMENT_SECTION_SELECTORS = [
    "shreddit-comment-tree",
    '[data-testid="comments-page-container"]',
    ".commentarea"
  ];
  function trackOpportunityUiEvent(eventName, params = {}) {
    try {
      const analytics = globalThis.RGCAnalytics;
      if (analytics?.track) {
        void analytics.track(eventName, {
          surface: "opportunity_panel",
          page_type: "post",
          ...params
        });
      }
    } catch {
    }
  }
  function renderLoadingPanel() {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    removeOpportunityPanel();
    const panel = makeShell();
    const bar = el("div", "rgc-opp-bar rgc-opp-bar--loading");
    const txt = el("span", "rgc-opp-loading-text");
    txt.textContent = "Analyzing reply opportunity...";
    bar.appendChild(txt);
    panel.appendChild(bar);
    tryInsertElement(panel);
  }
  function renderOpportunityPanel(result) {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    removeOpportunityPanel();
    const panel = buildPanel(result);
    tryInsertElement(panel);
  }
  function renderErrorPanel() {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    removeOpportunityPanel();
    const panel = makeShell();
    const bar = el("div", "rgc-opp-bar rgc-opp-bar--error");
    const txt = el("span", "rgc-opp-loading-text");
    txt.textContent = "Unable to analyze this post";
    bar.appendChild(txt);
    addDismiss(bar, panel);
    panel.appendChild(bar);
    tryInsertElement(panel);
  }
  function cleanupInjectedPanels() {
    document.querySelectorAll(".rgc-opportunity-panel").forEach((el3) => el3.remove());
    document.getElementById(PANEL_ID)?.remove();
  }
  function removeOpportunityPanel() {
    cleanupInjectedPanels();
  }
  function renderCommentDraftPlaceholder(message) {
    const section = document.getElementById(COMMENT_DRAFT_SECTION_ID);
    if (!section) return;
    renderCommentDraftPlaceholderInto(section, message);
  }
  function renderCommentDraftAnalysis(result) {
    const section = document.getElementById(COMMENT_DRAFT_SECTION_ID);
    if (!section) return;
    section.dataset.state = "analysis";
    section.dataset.message = "";
    const issuesList = (Array.isArray(result.issues) ? result.issues : []).map((item) => safeText(item)).filter(Boolean);
    const suggestionsList = (Array.isArray(result.suggestions) ? result.suggestions : []).map((item) => safeText(item)).filter(Boolean);
    const issues = issuesList.length ? `<ul class="rgc-opp-comment-list">${issuesList.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<div class="rgc-opp-comment-good">No major issues found.</div>';
    const suggestions = suggestionsList.length ? `<ul class="rgc-opp-comment-list rgc-opp-comment-list--good">${suggestionsList.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
    section.innerHTML = `
    <div class="rgc-opp-comment-head">
      <div>
        <div class="rgc-opp-comment-kicker">Reply Draft Score</div>
        <div class="rgc-opp-comment-summary">${escapeHtml(safeText(result.summary, "Not enough data"))}</div>
      </div>
      <div class="rgc-opp-comment-score rgc-opp-comment-score--${safeText(result.level, "low").toLowerCase()}">
        ${safeText(result.score, "0")}
      </div>
    </div>
    <div class="rgc-opp-comment-meta">${safeText(result.wordCount, "0")} words \xB7 ${safeText(result.charCount, "0")} chars</div>
    ${issues}
    ${suggestions}
  `;
  }
  function tryInsertElement(panel) {
    if (insertElement(panel)) return;
    let done = false;
    const observer = new MutationObserver(() => {
      if (document.getElementById(PANEL_ID)) {
        done = true;
        observer.disconnect();
        return;
      }
      if (insertElement(panel)) {
        done = true;
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      if (!done) observer.disconnect();
    }, 15e3);
  }
  function insertElement(panel) {
    for (const sel of POST_BODY_SELECTORS) {
      try {
        const el3 = document.querySelector(sel);
        if (el3?.parentElement) {
          el3.parentElement.insertBefore(panel, el3.nextSibling);
          return true;
        }
      } catch {
      }
    }
    for (const sel of COMMENT_SECTION_SELECTORS) {
      try {
        const el3 = document.querySelector(sel);
        if (el3?.parentElement) {
          el3.parentElement.insertBefore(panel, el3);
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  function getRecommendationCopy(result, recommendation, recommendationSummary) {
    const recommendationKey = safeText(recommendation?.key);
    const recommendationLabel = safeText(recommendation?.label);
    const isConsider = recommendationKey === "consider" || recommendationLabel === "Consider";

    if (isConsider && result.isGuardrailAdjusted === true) {
      return {
        title: "Worth a quick reply",
        subtitle: "Thread is still active, but attention is fading",
      };
    }

    return {
      title: safeText(recommendation?.headline, "Thread analysis"),
      subtitle: safeText(recommendationSummary, "No clear reply signal yet."),
    };
  }
  function formatReplyAngleText(value) {
    const text = safeText(value);
    return text.length <= 80 ? text : text.slice(0, 77).trimEnd() + "...";
  }
  function getStrategyDisplayName(label) {
    const displayMap = {
      answer_and_ask: "asking a follow-up question",
      validate_and_add: "validating first, then adding one detail",
      empathize_pain: "naming the pain clearly",
      quick_ping: "keeping it short with a quick question",
    };
    return displayMap[label] || "";
  }
  function getBetterStrategyHint(currentStrategy, successRateByStrategy) {
    const currentRate = successRateByStrategy?.[currentStrategy];
    if (typeof currentRate !== "number" || currentRate >= 0.3) {
      return { text: "", betterStrategy: null, improvementDelta: null };
    }

    const betterEntry = Object.entries(successRateByStrategy || {})
      .filter(([strategy, rate]) => {
        if (strategy === currentStrategy || typeof rate !== "number") return false;
        return Number((rate - currentRate).toFixed(4)) > 0.15;
      })
      .sort((a, b) => b[1] - a[1])[0];
    const betterStrategy = betterEntry?.[0] || null;
    const betterRate = betterEntry?.[1] ?? null;
    const displayName = getStrategyDisplayName(betterStrategy);
    return {
      text: displayName ? `Better results seen with: ${displayName}` : "",
      betterStrategy: displayName ? betterStrategy : null,
      improvementDelta: typeof betterRate === "number" ? Number((betterRate - currentRate).toFixed(4)) : null,
    };
  }
  function getSuccessRateSummary(successRateByStrategy, replyStrategyLabel) {
    const rate = successRateByStrategy?.[replyStrategyLabel];
    if (typeof rate !== "number") return null;
    if (rate >= 0.5) return "High response rate (~50%+)";
    if (rate >= 0.3) return "Moderate response rate (~30–50%)";
    return "Low response rate (~<30%)";
  }
  function getSuccessRateBadge(summary) {
    if (!summary) return null;
    if (summary.startsWith("High")) return { label: "High response rate", level: "high" };
    if (summary.startsWith("Moderate")) return { label: "Moderate response rate", level: "moderate" };
    if (summary.startsWith("Low")) return { label: "Low response rate", level: "low" };
    return null;
  }
  function getSuccessRateSubtitlePhrase(summary) {
    if (!summary) return "";
    if (summary.startsWith("High")) return "often get responses";
    if (summary.startsWith("Moderate")) return "can still get responses";
    if (summary.startsWith("Low")) return "less likely to get responses";
    return "";
  }
  function enhanceRecommendationSubtitle(subtitle, successRateSummary, recommendationKey) {
    const cleanSubtitle = safeText(subtitle);
    if (recommendationKey === "skip") return cleanSubtitle;
    const phrase = getSuccessRateSubtitlePhrase(successRateSummary);
    if (!phrase) return cleanSubtitle;
    if (!cleanSubtitle) return `Replies like this ${phrase}`;
    const subject = phrase.startsWith("less likely") ? "replies like this are" : "replies like this";
    return `${cleanSubtitle} — ${subject} ${phrase}`;
  }
  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  function buildPanel(result) {
    const proGate = globalThis.RGCProGating;
    const isProUser = proGate?.isProUserCached?.() === true;
    const recommendation = result.recommendation || {
      key: result.level === "HIGH" ? "reply_now" : result.level === "MEDIUM" ? "consider" : "skip",
      label: result.level === "HIGH" ? "Reply now" : result.level === "MEDIUM" ? "Consider" : "Skip",
      emoji: result.level === "HIGH" ? "🟢" : result.level === "MEDIUM" ? "🟡" : "🔴",
      headline: result.summary || "Thread analysis",
    };
    const recommendationKey = safeText(recommendation.key, "skip") || "skip";
    const score = result.opportunityScore != null ? result.opportunityScore : result.score;
    const positives = ((result.why && result.why.positives) || result.reasons || []).map((item) => safeText(item)).filter(Boolean);
    const risks = ((result.why && result.why.risks) || result.risks || []).map((item) => safeText(item)).filter(Boolean);
    const recommendationSummary = safeText(result.recommendationSummary || result.summary, "No clear reply signal yet.");
    const recommendationCopy = getRecommendationCopy(result, recommendation, recommendationSummary);
    recommendationCopy.subtitle = enhanceRecommendationSubtitle(
      recommendationCopy.subtitle,
      result.successRateSummary,
      recommendationKey
    );
    const replyAngleText = recommendationKey !== "skip" ? formatReplyAngleText(result.replyAngleText) : "";
    const betterStrategyHint = replyAngleText ? safeText(result.betterStrategyHint) : "";
    const quickReplyText = recommendationKey !== "skip" ? safeText(result.quickReplyText).trim() : "";
    const successRateBadge = SHOW_SUCCESS_RATE_BADGE && recommendationKey !== "skip"
      ? getSuccessRateBadge(result.successRateSummary)
      : null;
    const timingDisplayLabel = safeText(result.adjustedTimingLabel || result.timingLabel, "unknown");
    const matchLabel = safeText(result.matchLabel, "unknown");
    const matchSentence = result.matchScore > 0 && matchLabel && matchLabel !== "Low match"
      ? "Matches topics you often engage with."
      : "";
    if (matchSentence) {
      recommendationCopy.subtitle = `${recommendationCopy.subtitle} · ${matchSentence}`;
    }
    const panel = makeShell();
    const bar = el("div", "rgc-opp-bar");
    const left = el("div", "rgc-opp-bar-left");
    const badge = el("span", `rgc-opp-badge rgc-opp-${recommendationKey}`);
    badge.textContent = safeText(recommendation.label, "Skip");
    const scoreSpan = el("span", "rgc-opp-bar-score");
    scoreSpan.textContent = `Opportunity ${safeText(score, "0")}`;
    left.append(badge, scoreSpan);
    bar.appendChild(left);
    const sub = el("span", "rgc-opp-bar-sub");
    const subText = safeText(recommendationCopy.subtitle);
    if (subText) {
      sub.textContent = subText;
      bar.appendChild(sub);
    }
    const cta = el("span", `rgc-opp-bar-cta rgc-opp-bar-cta--${recommendationKey}`);
    cta.textContent = safeText(recommendation.label, "Skip");
    bar.appendChild(cta);
    addDismiss(bar, panel);
    bar.addEventListener("click", () => {
      const expanded = panel.classList.toggle("rgc-opp-expanded");
      trackOpportunityUiEvent("opportunity_panel_toggled", {
        expanded
      });
    });
    panel.appendChild(bar);
    const detail = el("div", "rgc-opp-detail");
    const hero = el("div", "rgc-opp-hero");
    const heroScore = el("div", "rgc-opp-hero-score");
    heroScore.textContent = `${safeText(recommendation.emoji, "•")} ${safeText(score, "0")}`;
    const heroMeta = el("div", "rgc-opp-hero-meta");
    const heroDecision = el("div", `rgc-opp-decision-chip rgc-opp-decision-chip--${recommendationKey}`);
    heroDecision.textContent = safeText(recommendation.label, "Skip");
    const heroTitle = el("div", "rgc-opp-hero-title");
    heroTitle.textContent = safeText(recommendationCopy.title, "Thread analysis");
    const heroSub = el("div", "rgc-opp-hero-sub");
    heroSub.textContent = safeText(recommendationCopy.subtitle, "No clear reply signal yet.");
    let replyAngle = null;
    if (replyAngleText) {
      replyAngle = el("div", "rgc-opp-reply-angle");
      const replyAngleLabel = el("span", "rgc-opp-reply-angle-label");
      replyAngleLabel.textContent = "Suggested angle:";
      const replyAngleValue = el("span", "rgc-opp-reply-angle-text");
      replyAngleValue.textContent = safeText(replyAngleText);
      replyAngle.append(replyAngleLabel, replyAngleValue);
      if (betterStrategyHint) {
        const replyAngleHint = el("div", "rgc-opp-reply-angle-hint");
        replyAngleHint.textContent = safeText(betterStrategyHint);
        replyAngle.appendChild(replyAngleHint);
      }
      if (successRateBadge) {
        const rateBadge = el("span", `rgc-opp-success-rate-badge rgc-opp-success-rate-badge--${successRateBadge.level}`);
        rateBadge.textContent = safeText(successRateBadge.label, "Response rate");
        rateBadge.title = "Based on your recent replies";
        replyAngle.appendChild(rateBadge);
      }
    }
    let quickReply = null;
    if (quickReplyText) {
      quickReply = el("div", "rgc-opp-quick-reply");
      const quickReplyLabel = el("div", "rgc-opp-quick-reply-label");
      quickReplyLabel.textContent = "Suggested reply:";
      const quickReplyTextNode = el("div", "rgc-opp-quick-reply-text");
      quickReplyTextNode.textContent = safeText(quickReplyText);
      const quickReplyCopy = el("button", "rgc-opp-quick-reply-copy");
      quickReplyCopy.type = "button";
      quickReplyCopy.dataset.proGate = "quick_reply_copy";
      quickReplyCopy.textContent = "Copy";
      quickReplyCopy.addEventListener("click", async (event) => {
        event.stopPropagation();
        try {
          await copyTextToClipboard(quickReplyText);
          quickReplyCopy.textContent = "Copied";
          setTimeout(() => {
            quickReplyCopy.textContent = "Copy";
          }, 1600);
        } catch {
          quickReplyCopy.textContent = "Copy";
        }
      });
      quickReply.append(quickReplyLabel, quickReplyTextNode, quickReplyCopy);
    }
    const heroMetaLine = el("div", "rgc-opp-hero-meta-line");
    heroMeta.append(heroDecision, heroTitle, heroSub);
    if (isProUser && replyAngle) heroMeta.appendChild(replyAngle);
    if (isProUser && quickReply) heroMeta.appendChild(quickReply);
    const heroMetaParts = [];
    if (safeText(timingDisplayLabel)) {
      heroMetaParts.push(`Timing: ${timingDisplayLabel}`);
    }
    const opStatusText = safeText(result.opStatus, "unknown");
    if (opStatusText) {
      heroMetaParts.push(`OP: ${opStatusText}`);
    }
    if (heroMetaParts.length) {
      heroMetaLine.textContent = heroMetaParts.join(" · ");
      heroMeta.appendChild(heroMetaLine);
    }
    if (isProUser && successRateBadge) {
      const successRateRow = el("div", "rgc-opp-success-rate-row");
      const successRateLabel = el("div", "rgc-opp-success-rate-label");
      successRateLabel.textContent = "Success Rate";
      const successRateValue = el("span", `rgc-opp-success-rate-badge rgc-opp-success-rate-badge--${successRateBadge.level}`);
      successRateValue.textContent = safeText(successRateBadge.label, "Response rate");
      successRateValue.title = "Based on your recent replies";
      successRateRow.append(successRateLabel, successRateValue);
      heroMeta.appendChild(successRateRow);
    }
    hero.append(heroScore, heroMeta);
    detail.appendChild(hero);

    if (result.guardrailTriggered) {
      const guardrailHint = el("div", "rgc-opp-guardrail");
      guardrailHint.textContent = "Thread still shows activity — might be worth a quick reply.";
      detail.appendChild(guardrailHint);
    }

    const lastReplyText = safeText(result.opLastReplyAgo);
    const lastReply = lastReplyText && lastReplyText !== "unknown"
      ? `last reply ${lastReplyText} ago`
      : "last reply unknown";
    if (!isProUser) {
      const proLockSection = renderProLockSection();
      if (proLockSection) detail.appendChild(proLockSection);
    } else {
      const metrics = el("div", "rgc-opp-metric-grid");
      metrics.append(
        buildMetric("Timing", timingDisplayLabel),
        buildMetric("Engagement", safeText(result.engagementLabel, "unknown")),
        buildMetric("Match", matchLabel),
        buildMetric("Conversion", safeText(result.conversionLabel, "unknown")),
        buildMetric("Demand", safeText(result.demandLabel, "unknown")),
        buildMetric("Fake active risk", safeText(result.fakeActiveRisk, "unknown"))
      );
      detail.appendChild(metrics);

      if (matchSentence) {
        const matchNote = el("div", "rgc-opp-guardrail");
        matchNote.textContent = matchSentence;
        detail.appendChild(matchNote);
      }

      const opCard = el("div", "rgc-opp-spotlight");
      const opLabel = el("div", "rgc-opp-spotlight-label");
      opLabel.textContent = "OP";
      const opValue = el("div", "rgc-opp-spotlight-value");
      opValue.textContent = `${safeText(result.opStatus, "unknown")} · ${lastReply} · ${safeText(result.opReplyCount ?? 0, "0")} replies`;
      opCard.append(opLabel, opValue);
      detail.appendChild(opCard);

      const whyTitle = el("div", "rgc-opp-section-title");
      whyTitle.textContent = "Why this?";
      const whyGrid = el("div", "rgc-opp-why-grid");
      const positiveCard = el("div", "rgc-opp-why-card");
      const positiveTitle = el("div", "rgc-opp-why-title");
      positiveTitle.textContent = "Positive";
      const positiveList = el("ul", "rgc-opp-why-list");
      (positives.length ? positives : ["No strong positive signal found."]).slice(0, 4).forEach((item) => {
        const li = el("li", "rgc-opp-why-item rgc-opp-why-item--good");
        li.textContent = safeText(item);
        positiveList.appendChild(li);
      });
      positiveCard.append(positiveTitle, positiveList);

      const riskCard = el("div", "rgc-opp-why-card");
      const riskTitle = el("div", "rgc-opp-why-title");
      riskTitle.textContent = "Risks";
      const riskList = el("ul", "rgc-opp-why-list");
      (risks.length ? risks : ["No major risk signal found."]).slice(0, 4).forEach((item) => {
        const li = el("li", "rgc-opp-why-item rgc-opp-why-item--risk");
        li.textContent = safeText(item);
        riskList.appendChild(li);
      });
      riskCard.append(riskTitle, riskList);
      whyGrid.append(positiveCard, riskCard);
      const whySection = el("div", "rgc-opp-why-section");
      whySection.append(whyTitle, whyGrid);
      detail.appendChild(whySection);

    }

    const feedbackSection = buildFeedbackSection(result);
    detail.appendChild(feedbackSection);

    const actionRow = el("div", "rgc-opp-action");
    const actionLabel = el("div", "rgc-opp-action-label");
    actionLabel.textContent = "Recommended next step";
    const actionText = el("div", "rgc-opp-action-text");
    const actionTextValue = safeText(result.suggestedAction || result.suggestedReplyAngle, "Review the thread manually.");
    if (actionTextValue) {
      actionText.textContent = actionTextValue;
      actionText.title = actionTextValue;
      actionRow.append(actionLabel, actionText);
    } else {
      actionRow.appendChild(actionLabel);
    }
    detail.appendChild(actionRow);
    const commentSection = el("div", "rgc-opp-comment-card");
    commentSection.id = COMMENT_DRAFT_SECTION_ID;
    detail.appendChild(commentSection);
    renderCommentDraftPlaceholderInto(commentSection, "Start typing a Reddit reply to score your draft.");
    panel.appendChild(detail);
    return panel;
  }
  function buildFeedbackSection(result) {
    const section = el("div", "rgc-opp-feedback");
    const header = el("div", "rgc-opp-feedback-head");
    const labelWrap = el("div", "rgc-opp-feedback-copy");
    const title = el("div", "rgc-opp-feedback-title");
    title.textContent = "Was this recommendation accurate?";
    labelWrap.appendChild(title);
    const buttonRow = el("div", "rgc-opp-feedback-buttons");
    const yesBtn = el("button", "rgc-opp-feedback-btn");
    yesBtn.type = "button";
    yesBtn.textContent = "👍 Yes";
    yesBtn.setAttribute("aria-pressed", "false");
    const noBtn = el("button", "rgc-opp-feedback-btn");
    noBtn.type = "button";
    noBtn.textContent = "👎 No";
    noBtn.setAttribute("aria-pressed", "false");
    buttonRow.append(yesBtn, noBtn);
    header.append(labelWrap, buttonRow);

    const thanks = el("div", "rgc-opp-feedback-thanks");
    thanks.textContent = "Thanks — this helps improve future recommendations.";
    thanks.hidden = true;

    const applyState = (value) => {
      const selected = value === "yes" ? yesBtn : value === "no" ? noBtn : null;
      [yesBtn, noBtn].forEach((btn) => {
        const isSelected = btn === selected;
        btn.classList.toggle("selected", isSelected);
        btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
      });
      thanks.hidden = !selected;
    };

    const save = async (userFeedback) => {
      applyState(userFeedback);
      const helper = globalThis.RGCReplyOpportunityFeedback;
      if (!helper) return;
      const payload = {
        postId: result.signals?.postId || result.postId || null,
        postUrl: result.signals?.postUrl || result.postUrl || location.href.split("#")[0],
        subreddit: result.signals?.subreddit || result.subreddit || "unknown",
        postTitle: result.signals?.title || result.title || "unknown",
        recommendation: result.recommendation?.label || result.level || "unknown",
        opportunityScore: result.opportunityScore ?? result.score ?? null,
        timingScore: result.timingScore ?? null,
        conversionScore: result.conversionScore ?? null,
        demandScore: result.demandScore ?? null,
        fakeActiveRisk: result.fakeActiveRisk || "unknown",
        opIntent: result.opIntent || "unknown",
        opStatus: result.opStatus || "unknown",
        userFeedback,
        createdAt: Date.now(),
      };
      if (helper.saveFeedback) {
        await helper.saveFeedback(payload);
      }
      if (userFeedback === "no" && helper.saveBadCase) {
        await helper.saveBadCase({
          ...payload,
          threadAgeMinutes: result.threadAgeMinutes ?? result.signals?.threadAgeMinutes ?? result.signals?.ageMinutes ?? null,
          totalComments: result.signals?.commentCount ?? result.commentCount ?? null,
          recent30mComments: result.recentCommentCount30m ?? 0,
          recent1hComments: result.recentCommentCount1h ?? 0,
          recent2hComments: result.recentCommentCount2h ?? 0,
          opUsername: result.opUsername || result.signals?.opUsername || "unknown",
          opReplyCount: result.opReplyCount ?? 0,
          opLastReplyMinutes: result.opLastReplyMinutes ?? null,
          hasOpFollowUp: Boolean(result.signals?.opFollowUpCount || result.opFollowUpCount),
          hasThanksOnly: Boolean(result.signals?.opOnlyThanks || result.opOnlyThanks),
          isGrowing: result.recentCommentGrowth === true,
          timingLabel: result.timingLabel || "unknown",
          conversionLabel: result.conversionLabel || "unknown",
          demandLabel: result.demandLabel || "unknown",
          reasonSummary: result.summary || "",
          positiveReasons: Array.isArray(result.why?.positives) ? result.why.positives : (result.reasons || []),
          riskReasons: Array.isArray(result.why?.risks) ? result.why.risks : (result.risks || []),
          userFeedback: "no",
        });
      }
    };

    yesBtn.addEventListener("click", () => {
      void save("yes");
    });
    noBtn.addEventListener("click", () => {
      void save("no");
    });

    section.append(header, thanks);
    section._rgcApplyFeedbackState = applyState;
    section._rgcFeedbackSave = save;
    void hydrateFeedbackSection(section, result);
    return section;
  }
  async function hydrateFeedbackSection(section, result) {
    const helper = globalThis.RGCReplyOpportunityFeedback;
    if (!helper?.getFeedback) return;
    const existing = await helper.getFeedback(result.signals?.postId || result.postId || "", result.signals?.postUrl || result.postUrl || "");
    if (!existing?.userFeedback) return;
    section._rgcApplyFeedbackState?.(existing.userFeedback);
  }
  function cleanupProLockDuplicates() {
    const selectors = [
      '.rgc-opp-pro-lock',
      '.rgc-pro-gated[data-rgc-pro-feature]',
      '.rgc-pro-lock-overlay',
      '.rgc-pro-lock-btn',
      '.rgc-pro-lock-copy',
    ];
    document.querySelectorAll(selectors.join(',')).forEach((node) => {
      const text = (node.textContent || '').trim();
      const hasUpgradeCta = /upgrade to pro/i.test(text)
        || /unlock pro/i.test(text)
        || /checkout/i.test(text)
        || /paddle/i.test(text)
        || /see why this thread is worth replying to/i.test(text);
      if (node.classList.contains('rgc-opp-pro-lock') || hasUpgradeCta) {
        node.remove();
      }
    });
  }
  function renderProLockSection() {
    return null;
  }
  function safeText(value, fallback = "") {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "number" && Number.isNaN(value)) return fallback;
    const text = String(value).trim();
    const lowered = text.toLowerCase();
    if (!text || lowered === "undefined" || lowered === "null" || lowered === "nan") return fallback;
    return text;
  }
  function buildMetric(label, value) {
    const metric = el("div", "rgc-opp-metric");
    const metricValue = el("div", "rgc-opp-metric-value");
    const safeLabel = safeText(label);
    if (!safeLabel) return null;
    const rawValue = safeText(value, "Not enough data");
    if (!rawValue || rawValue.toLowerCase() === "unknown") {
      metric.classList.add("rgc-opp-metric--unknown");
      metricValue.textContent = "Not enough data";
    } else {
      metricValue.textContent = rawValue;
    }
    const metricLabel = el("div", "rgc-opp-metric-label");
    metricLabel.textContent = safeLabel;
    metric.append(metricValue, metricLabel);
    return metric;
  }
  function makeShell() {
    const panel = el("div", "rgc-opp-panel rgc-opportunity-panel");
    panel.id = PANEL_ID;
    requestAnimationFrame(() => panel.classList.add("rgc-opp-visible"));
    return panel;
  }
  function addDismiss(bar, panel) {
    const btn = el("button", "rgc-opp-dismiss");
    btn.setAttribute("aria-label", "Dismiss");
    btn.innerHTML = "&#x2715;";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      sessionStorage.setItem(DISMISSED_KEY, "1");
      panel.style.display = "none";
      trackOpportunityUiEvent("opportunity_panel_dismissed");
    });
    bar.appendChild(btn);
  }
  function appendSection(parent, title, items, itemClass) {
    const titleEl = el("div", "rgc-opp-reasons-title");
    titleEl.textContent = safeText(title);
    const list = el("ul", "rgc-opp-reasons-list");
    (Array.isArray(items) ? items : []).map((text) => safeText(text)).filter(Boolean).slice(0, 4).forEach((text) => {
      const li = el("li", itemClass);
      li.textContent = text;
      list.appendChild(li);
    });
    parent.append(titleEl, list);
  }
  function el(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }
  function renderCommentDraftPlaceholderInto(section, message) {
    const safeMessage = safeText(message);
    if (section.dataset.state === "placeholder" && section.dataset.message === safeMessage) return;
    section.dataset.state = "placeholder";
    section.dataset.message = safeMessage;
    section.innerHTML = `
    <div class="rgc-opp-comment-empty">${escapeHtml(safeMessage)}</div>
  `;
  }
  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function getDecisionState(score) {
    if (score >= 70) {
      return {
        key: "comment",
        label: "\u{1F7E0} COMMENT NOW",
        headline: "Strong chance to add a valuable comment"
      };
    }
    if (score >= 50) {
      return {
        key: "consider",
        label: "\u{1F7E1} CONSIDER COMMENTING",
        headline: "Decent opportunity if you have something specific to add"
      };
    }
    return {
      key: "skip",
      label: "\u26AA SKIP",
      headline: "Probably not worth commenting right now"
    };
  }
  function buildSuggestedApproaches(result) {
    const suggestions = /* @__PURE__ */ new Set();
    const postType = safeText(result.signals.postType, "unknown");
    const topReason = safeText(result.reasons?.[0]).toLowerCase();
    if (postType === "question") suggestions.add("Answer directly with one practical takeaway.");
    if (postType === "discussion") suggestions.add("Share a concise opinion and why you hold it.");
    if (topReason.includes("discussion")) suggestions.add("Add a personal example to make your point believable.");
    if (topReason.includes("few replies") || topReason.includes("visible")) suggestions.add("Be early and keep the first sentence punchy.");
    if (topReason.includes("upvotes but only")) suggestions.add("Add a concrete insight instead of repeating existing comments.");
    if (result.level === "HIGH") suggestions.add("Share personal experience or a strong firsthand example.");
    if (result.level === "MEDIUM") suggestions.add("Ask a follow-up question if you need a lighter entry.");
    if (result.level === "LOW") suggestions.add("Only comment if you have a genuinely unique angle.");
    const suggestedAction = safeText(result.suggestedAction);
    if (suggestedAction) suggestions.add(suggestedAction);
    return [...suggestions].map((item) => safeText(item)).filter(Boolean).slice(0, 3);
  }

  // src/content/components/OpportunityFeed.ts
  var FEED_BADGE_CLASS = "rgc-feed-score-wrap";
  function trackFeedEvent(eventName, params = {}) {
    try {
      const analytics = globalThis.RGCAnalytics;
      if (analytics?.track) {
        void analytics.track(eventName, {
          surface: "opportunity_feed",
          page_type: "feed",
          ...params
        });
      }
    } catch {
    }
  }
  function removeFeedOpportunityBadges() {
    document.querySelectorAll(`.${FEED_BADGE_CLASS}`).forEach((el3) => el3.remove());
  }
  function renderFeedOpportunityBadges(items) {
    removeFeedOpportunityBadges();
    items.forEach((item) => {
      const badge = buildFeedBadge(item);
      const parent = item.root.parentElement;
      if (!parent) return;
      if (item.root.nextSibling) parent.insertBefore(badge, item.root.nextSibling);
      else parent.appendChild(badge);
    });
  }
  function buildFeedBadge(item) {
    const { result, permalink } = item;
    const wrap = el2("div", FEED_BADGE_CLASS);
    const card = el2("div", "rgc-feed-score-card");
    const summary = document.createElement("button");
    summary.className = "rgc-feed-score-summary";
    summary.type = "button";
    const levelName = safeText(result.level, "LOW");
    const level = el2("span", `rgc-feed-score-level rgc-feed-score-level--${levelName.toLowerCase()}`);
    level.textContent = levelName;
    const score = el2("span", "rgc-feed-score-value");
    score.textContent = `${safeText(result.score, "0")}/100`;
    const text = el2("span", "rgc-feed-score-text");
    text.textContent = safeText(result.summary, "No clear signal yet.");
    const hint = el2("span", "rgc-feed-score-hint");
    hint.textContent = "Tap to expand";
    summary.append(level, score, text, hint);
    card.appendChild(summary);
    const detail = el2("div", "rgc-feed-score-detail");
    const whyTitle = el2("div", "rgc-feed-score-detail-title");
    whyTitle.textContent = "Why this score";
    detail.appendChild(whyTitle);
    const list = el2("ul", "rgc-feed-score-list");
    (Array.isArray(result.reasons) ? result.reasons : []).map((reason) => safeText(reason)).filter(Boolean).slice(0, 2).forEach((reason) => {
      const li = el2("li", "rgc-feed-score-list-item");
      li.textContent = reason;
      list.appendChild(li);
    });
    detail.appendChild(list);
    const action = el2("div", "rgc-feed-score-action");
    const actionText = safeText(result.suggestedAction);
    if (actionText) {
      action.textContent = actionText;
      detail.appendChild(action);
    }
    if (permalink) {
      const link = document.createElement("a");
      link.className = "rgc-feed-score-link";
      link.href = permalink;
      link.target = "_self";
      link.textContent = "Open post";
      detail.appendChild(link);
    }
    summary.addEventListener("click", () => {
      const expanded = card.classList.toggle("rgc-feed-score-card--expanded");
      trackFeedEvent("opportunity_feed_toggled", {
        expanded,
        level: levelName.toLowerCase(),
        score: safeText(result.score, "0")
      });
    });
    card.appendChild(detail);
    wrap.appendChild(card);
    return wrap;
  }
  function el2(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  // src/opportunity.ts
  var DISMISSED_KEY2 = "rgc-opp-dismissed";
  var SETTINGS_KEY = "rgcSettings";
  var REPLY_OUTCOMES_KEY = "rgc_reply_outcomes";
  var MAX_REPLY_OUTCOMES = 100;
  var REPLY_OUTCOME_WINDOW_MS = 24 * 60 * 60 * 1e3;
  var SHOW_SUCCESS_RATE_BADGE = true;
  var DEFAULT_SHOW_FEED_SCORES = true;
  var DEFAULT_SHOW_FEED_SCORES_ON_HOME = true;
  var DEFAULT_SHOW_FEED_SCORES_ON_SUBREDDIT = true;
  var DEFAULT_FEED_SCORE_FILTER = "all";
  var chromeApi = globalThis.chrome;
  var cleanupTimer = null;
  function trackOpportunityEvent(eventName, params = {}) {
    try {
      const analytics = globalThis.RGCAnalytics;
      if (analytics?.track) {
        void analytics.track(eventName, {
          surface: "opportunity_panel",
          page_type: "post",
          ...params
        });
      }
    } catch {
    }
  }
  function getRedditRouteContext(url = location.href) {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
      const postMatch = path.match(/^(?:\/r\/([^/]+))?\/comments\/([^/]+)(?:\/|$)/);
      return {
        pathname: path,
        postId: postMatch?.[2] || null,
        subreddit: postMatch?.[1] || null,
        isRedditPostDetailPage: Boolean(postMatch?.[2]),
      };
    } catch {
      return {
        pathname: "",
        postId: null,
        subreddit: null,
        isRedditPostDetailPage: false,
      };
    }
  }
  function isRedditPostDetailPage(url = location.href) {
    return getRedditRouteContext(url).isRedditPostDetailPage;
  }
  function buildFallbackOpportunityResult(routeContext = getRedditRouteContext(), signals = {}) {
    const postId = routeContext?.postId || signals?.postId || null;
    const subreddit = routeContext?.subreddit || signals?.subreddit || "unknown";
    return {
      recommendation: {
        key: "consider",
        label: "Consider",
        emoji: "🟡",
        headline: "Partial analysis available",
      },
      opportunityScore: 50,
      timingScore: 50,
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
        subreddit,
        titleKeywords: [],
        topicKeywords: [],
        painKeywords: [],
        productKeywords: [],
        keywords: [],
      },
      recentCommentGrowth: "unknown",
      opUsername: "unknown",
      aliveSignals: [],
      isAliveThread: false,
      aliveSignalReasons: [],
      why: {
        positives: ["Partial analysis available."],
        risks: [],
      },
      suggestedReplyAngle: null,
      suggestedReplyAngleShort: "",
      recommendationSummary: "Partial analysis available.",
      summary: "Partial analysis available.",
      level: "MEDIUM",
      shouldReply: false,
      reasons: ["Partial analysis available."],
      risks: [],
      suggestedAction: "Partial analysis available.",
      signals: {
        postId,
        postUrl: location.href.split("#")[0],
        title: signals?.title || document.title || "",
        bodyText: signals?.bodyText || "",
        upvotes: signals?.upvotes ?? null,
        commentCount: signals?.commentCount ?? null,
        ageMinutes: signals?.ageMinutes ?? null,
        subreddit,
        author: signals?.author || "unknown",
        postType: signals?.postType || "unknown",
        isNSFW: Boolean(signals?.isNSFW),
        isLocked: Boolean(signals?.isLocked),
        isArchived: Boolean(signals?.isArchived),
        hasExternalLink: Boolean(signals?.hasExternalLink),
        titleLength: (signals?.title || "").length,
        titleHasQuestionMark: Boolean(signals?.titleHasQuestionMark),
        titleStartsWithQuestionWord: Boolean(signals?.titleStartsWithQuestionWord),
      },
      postId,
      subreddit,
      reasonSummary: "Partial analysis available.",
    };
  }
  async function getFeedUiSettings() {
    try {
      const stored = await chromeApi.storage.local.get(SETTINGS_KEY);
      const settings = stored[SETTINGS_KEY];
      return {
        showFeedScores: settings?.ui?.showFeedScores !== false,
        showFeedScoresOnHome: settings?.ui?.showFeedScoresOnHome !== false,
        showFeedScoresOnSubreddit: settings?.ui?.showFeedScoresOnSubreddit !== false,
        feedScoreFilter: settings?.ui?.feedScoreFilter === "high_only" ? "high_only" : "all"
      };
    } catch {
      return {
        showFeedScores: DEFAULT_SHOW_FEED_SCORES,
        showFeedScoresOnHome: DEFAULT_SHOW_FEED_SCORES_ON_HOME,
        showFeedScoresOnSubreddit: DEFAULT_SHOW_FEED_SCORES_ON_SUBREDDIT,
        feedScoreFilter: DEFAULT_FEED_SCORE_FILTER
      };
    }
  }
  async function analyzePost() {
    const routeContext = getRedditRouteContext();
    let signals = null;
    try {
      const baseSignals = extractPostSignals();
      try {
        signals = collectReplyOpportunitySignals(baseSignals);
      } catch (error) {
        globalThis.rgcError?.("analyze failed", error);
        signals = {
          ...baseSignals,
          bodyText: baseSignals?.bodyText || "",
        };
      }
    } catch (error) {
      globalThis.rgcError?.("analyze failed", error);
      signals = {
        postId: routeContext.postId || null,
        postUrl: location.href.split("#")[0],
        title: "",
        bodyText: "",
        upvotes: null,
        commentCount: null,
        ageMinutes: null,
        subreddit: routeContext.subreddit || "unknown",
        author: "unknown",
        postType: "unknown",
        isNSFW: false,
        isLocked: false,
        isArchived: false,
        hasExternalLink: false,
        titleLength: 0,
        titleHasQuestionMark: false,
        titleStartsWithQuestionWord: false,
      };
    }

    try {
      const scoredResult = globalThis.RGCReplyOpportunity?.scoreReplyOpportunity
        ? globalThis.RGCReplyOpportunity.scoreReplyOpportunity(signals)
        : scorePost(signals);
      const result = globalThis.RGCReplyOpportunity?.applyGuardrail
        ? globalThis.RGCReplyOpportunity.applyGuardrail(scoredResult)
        : scoredResult;
      return { signals, result };
    } catch (error) {
      globalThis.rgcError?.("analyze failed", error);
      return {
        signals,
        result: buildFallbackOpportunityResult(routeContext, signals),
      };
    }
  }
  var lastRunUrl = "";
  var feedObserver = null;
  var feedRefreshTimer = null;
  var lastObservedUrl = location.href;
  var navTimer = null;
  var analysisReadyObserver = null;
  var analysisReadyTimer = null;
  var analysisReadyUrl = "";
  var draftObserver = null;
  var activeDraftInput = null;
  var draftInputHandler = null;
  var replyOutcomeObserver = null;
  var replyOutcomeScanTimer = null;
  var replyOutcomeContext = null;
  var knownCommentIds = /* @__PURE__ */ new Set();
  var trackedCommentRoots = /* @__PURE__ */ new Map();
  function stopFeedObserver() {
    feedObserver?.disconnect();
    feedObserver = null;
    if (feedRefreshTimer != null) {
      window.clearTimeout(feedRefreshTimer);
      feedRefreshTimer = null;
    }
  }
  function stopAnalysisWaiter() {
    analysisReadyObserver?.disconnect();
    analysisReadyObserver = null;
    if (analysisReadyTimer != null) {
      window.clearTimeout(analysisReadyTimer);
      analysisReadyTimer = null;
    }
  }
  function hasAnalysisTargets() {
    try {
      const hasPostContainer = Boolean(document.querySelector([
        "shreddit-post",
        '[data-testid="post-container"]',
        ".Post",
        ".thing.link",
      ].join(", ")));
      const hasCommentList = Boolean(document.querySelector([
        "shreddit-comment-tree",
        '[data-testid="comments-page-container"]',
        ".commentarea",
      ].join(", ")));
      return hasPostContainer && hasCommentList;
    } catch {
      return false;
    }
  }
  function scheduleAnalysis() {
    const currentUrl = location.href.split("#")[0];
    if (analysisReadyUrl === currentUrl && (analysisReadyObserver || analysisReadyTimer != null)) return;

    stopAnalysisWaiter();
    analysisReadyUrl = currentUrl;

    if (!isRedditPostDetailPage(currentUrl)) {
      return;
    }

    const triggerAnalysis = () => {
      stopAnalysisWaiter();
      void run();
    };

    if (hasAnalysisTargets()) {
      analysisReadyTimer = window.setTimeout(triggerAnalysis, 1500);
      return;
    }

    const observeRoot = () => {
      const root = document.body || document.documentElement;
      if (!root) {
        analysisReadyTimer = window.setTimeout(triggerAnalysis, 1500);
        return;
      }

      analysisReadyObserver = new MutationObserver(() => {
        if (hasAnalysisTargets()) {
          triggerAnalysis();
        }
      });
      analysisReadyObserver.observe(root, { childList: true, subtree: true });
      analysisReadyTimer = window.setTimeout(triggerAnalysis, 1500);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", observeRoot, { once: true });
    } else {
      observeRoot();
    }
  }
  function stopDraftObserver() {
    draftObserver?.disconnect();
    draftObserver = null;
    if (activeDraftInput && draftInputHandler) {
      activeDraftInput.removeEventListener("input", draftInputHandler);
      activeDraftInput.removeEventListener("keyup", draftInputHandler);
      activeDraftInput.removeEventListener("paste", draftInputHandler);
    }
    activeDraftInput = null;
    draftInputHandler = null;
  }
  function stopReplyOutcomeObserver() {
    replyOutcomeObserver?.disconnect();
    replyOutcomeObserver = null;
    if (replyOutcomeScanTimer != null) {
      window.clearTimeout(replyOutcomeScanTimer);
      replyOutcomeScanTimer = null;
    }
    replyOutcomeContext = null;
    knownCommentIds = /* @__PURE__ */ new Set();
    trackedCommentRoots = /* @__PURE__ */ new Map();
  }
  function isInsideOpportunityPanel(node) {
    if (!node) return false;
    if (node instanceof Element) return Boolean(node.closest("#rgc-opp-panel"));
    return Boolean(node.parentElement?.closest("#rgc-opp-panel"));
  }
  async function readReplyOutcomeRecords() {
    try {
      const stored = await chromeApi.storage.local.get(REPLY_OUTCOMES_KEY);
      const records = stored[REPLY_OUTCOMES_KEY];
      return Array.isArray(records) ? records : [];
    } catch {
      return [];
    }
  }
  async function writeReplyOutcomeRecords(records) {
    try {
      await chromeApi.storage.local.set({ [REPLY_OUTCOMES_KEY]: records.slice(0, MAX_REPLY_OUTCOMES) });
      return true;
    } catch {
      return false;
    }
  }
  async function getTrackedReplyOutcomeCount() {
    const records = await readReplyOutcomeRecords();
    return records.length;
  }
  function buildReplyOutcomeStats(records) {
    const strategies = ["answer_and_ask", "validate_and_add", "empathize_pain", "quick_ping"];
    const stats = {};
    const successRateByStrategy = {};
    const variantStats = {};
    const successRateByVariant = {};

    strategies.forEach((strategy) => {
      const strategyRecords = records.filter((record) => record?.replyStrategyLabel === strategy);
      const count = strategyRecords.length;
      const repliedTrue = strategyRecords.filter((record) => record?.replied === true).length;
      const successRate = count >= 5 ? repliedTrue / count : null;
      stats[strategy] = {
        count,
        repliedTrue,
        successRate,
      };
      successRateByStrategy[strategy] = successRate;

      ["A", "B"].forEach((variant) => {
        const key = `${strategy}_${variant}`;
        const variantRecords = records.filter((record) => {
          const recordStrategy = record?.strategy || record?.replyStrategyLabel;
          return recordStrategy === strategy && record?.variant === variant;
        });
        const variantCount = variantRecords.length;
        const variantRepliedTrue = variantRecords.filter((record) => record?.replied === true).length;
        const variantSuccessRate = variantCount >= 5 ? variantRepliedTrue / variantCount : null;
        variantStats[key] = {
          count: variantCount,
          repliedTrue: variantRepliedTrue,
          successRate: variantSuccessRate,
        };
        successRateByVariant[key] = variantSuccessRate;
      });
    });

    return {
      successRateByStrategy,
      successRateByVariant,
      replyOutcomeStatsByStrategy: stats,
      replyOutcomeStatsByVariant: variantStats,
    };
  }
  async function getReplyOutcomeStats() {
    const records = await readReplyOutcomeRecords();
    return {
      trackedCommentsCount: records.length,
      ...buildReplyOutcomeStats(records),
    };
  }
  function getHistoricallyBestStrategy(successRateByStrategy) {
    const ranked = Object.entries(successRateByStrategy || {})
      .filter(([, rate]) => typeof rate === "number")
      .sort((a, b) => b[1] - a[1]);
    if (ranked.length < 2) return null;
    const [bestStrategy, bestRate] = ranked[0];
    const [, nextBestRate] = ranked[1];
    return bestRate > nextBestRate + 0.2 ? bestStrategy : null;
  }
  function isStrategyHistoryOverrideAllowed(result, candidateStrategy) {
    if (!candidateStrategy || candidateStrategy === result.replyStrategyLabel) return false;
    if ((result.recommendation?.key || "").toLowerCase() === "skip" || result.recommendation?.label === "Skip") return false;
    if (result.opIntent === "done") return false;
    if (result.fakeActiveRisk === "High") return false;
    if ((result.isGuardrailAdjusted === true || result.fakeActiveRisk === "Medium") && candidateStrategy !== "quick_ping") return false;
    return true;
  }
  function applyHistoricalStrategyAdjustment(result) {
    result.originalReplyStrategyLabel = result.replyStrategyLabel;
    result.strategyAdjustedByHistory = false;
    const bestStrategy = getHistoricallyBestStrategy(result.successRateByStrategy);
    if (!isStrategyHistoryOverrideAllowed(result, bestStrategy)) return result;

    const quickReply = globalThis.RGCReplyOpportunity?.getQuickReply
      ? globalThis.RGCReplyOpportunity.getQuickReply(bestStrategy)
      : { text: "", variant: "" };
    result.replyStrategyLabel = bestStrategy;
    result.replyStrategyReason = "history_override";
    result.replyAngleText = globalThis.RGCReplyOpportunity?.getReplyAngleText
      ? globalThis.RGCReplyOpportunity.getReplyAngleText(bestStrategy)
      : result.replyAngleText;
    result.quickReplyText = quickReply.text || "";
    result.quickReplyVariant = quickReply.variant || "";
    result.strategyAdjustedByHistory = true;
    result.strategyAdjustedByHistoryReason = "strategy_success_rate_leader";
    return result;
  }
  function applySuccessRateSummary(result) {
    result.successRateSummary = getSuccessRateSummary(result.successRateByStrategy, result.replyStrategyLabel);
    return result;
  }
  function applyBetterStrategyHint(result) {
    result.originalReplyStrategyLabel = result.originalReplyStrategyLabel || result.replyStrategyLabel;
    result.strategyAdjustedByHistory = result.strategyAdjustedByHistory === true;
    const hint = getBetterStrategyHint(result.replyStrategyLabel, result.successRateByStrategy);
    result.betterStrategyHint = hint.text;
    result.betterStrategy = hint.betterStrategy;
    result.improvementDelta = hint.improvementDelta;
    return result;
  }
  async function upsertReplyOutcomeRecord(record) {
    if (!record?.postId || !record?.commentId) return false;
    const records = await readReplyOutcomeRecords();
    const updated = records.filter((item) => !(item?.postId === record.postId && item?.commentId === record.commentId));
    updated.unshift({
      ...record,
      updatedAt: Date.now(),
    });
    return writeReplyOutcomeRecords(updated);
  }
  function extractCurrentRedditUsername() {
    const selectors = [
      "shreddit-app[username]",
      "[data-testid=\"user-drawer\"] a[href*=\"/user/\"]",
      "reddit-header-action-items a[href*=\"/user/\"]",
      "a[href*=\"/user/\"][aria-label*=\"profile\" i]",
      "a[href*=\"/u/\"][aria-label*=\"profile\" i]",
      ".user a[href*=\"/user/\"]"
    ];
    for (const selector of selectors) {
      try {
        const el3 = document.querySelector(selector);
        if (!el3) continue;
        const attr = el3.getAttribute("username") || el3.getAttribute("data-username") || "";
        if (attr) return normalizeUsername(attr);
        const href = el3.getAttribute("href") || "";
        const fromHref = href.match(/\/(?:user|u)\/([^/?#]+)/i);
        if (fromHref) return normalizeUsername(fromHref[1]);
        const text = normalizeCommentText(el3.textContent || el3.innerText || "");
        if (text) return normalizeUsername(text);
      } catch {
      }
    }
    return null;
  }
  function hashString(value) {
    let hash = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }
  function extractCommentId(root) {
    if (!root) return "";
    const attrNames = ["thingid", "comment-id", "data-comment-id", "data-fullname", "data-testid", "id", "permalink"];
    for (const name of attrNames) {
      try {
        const value = root.getAttribute(name) || "";
        if (!value) continue;
        const direct = value.match(/(?:^|[-_/])(t1_[a-z0-9]+|[a-z0-9]{6,})(?:$|[-_/?#])/i);
        if (direct) return direct[1].toLowerCase();
        if (/^t1_[a-z0-9]+$/i.test(value)) return value.toLowerCase();
      } catch {
      }
    }
    try {
      const link = root.querySelector('a[href*="/comments/"][href*="/comment/"], a[href*="/comments/"][href*="t1_"], a[href*="/comments/"]');
      const href = link?.getAttribute("href") || "";
      const t1Match = href.match(/t1_[a-z0-9]+/i);
      if (t1Match) return t1Match[0].toLowerCase();
      const path = new URL(href, location.href).pathname.replace(/\/+$/, "");
      const parts = path.split("/").filter(Boolean);
      const commentsIndex = parts.indexOf("comments");
      const commentId = commentsIndex >= 0 ? parts[commentsIndex + 4] : "";
      if (commentId && /^[a-z0-9]{6,}$/i.test(commentId)) return commentId.toLowerCase();
    } catch {
    }
    const text = extractCommentText(root);
    const author = extractCommentAuthor(root) || "unknown";
    return `local_${author}_${hashString(text.slice(0, 180))}`;
  }
  function getNestedCommentRoots(root) {
    const nested = [];
    const seen = /* @__PURE__ */ new Set();
    for (const selector of COMMENT_ROOT_SELECTORS) {
      try {
        root.querySelectorAll(selector).forEach((item) => {
          if (item === root || seen.has(item)) return;
          seen.add(item);
          const text = normalizeCommentText(item.innerText || item.textContent || "");
          if (text.length >= 12) nested.push(item);
        });
      } catch {
      }
    }
    return nested;
  }
  function findCommentRootById(commentId) {
    if (!commentId) return null;
    const cached = trackedCommentRoots.get(commentId);
    if (cached?.isConnected) return cached;
    for (const root of queryCommentRoots()) {
      if (extractCommentId(root) === commentId) return root;
    }
    return null;
  }
  function hasCommentReply(root) {
    return Boolean(root && getNestedCommentRoots(root).length > 0);
  }
  async function refreshReplyOutcomeStatuses() {
    const records = await readReplyOutcomeRecords();
    const now = Date.now();
    let changed = false;
    const updated = records.map((record) => {
      if (!record || record.replied === true || record.replied === false) return record;
      const root = record.postId === extractPostId() ? findCommentRootById(record.commentId) : null;
      if (root && hasCommentReply(root)) {
        changed = true;
        return {
          ...record,
          replied: true,
          repliedAt: now,
          updatedAt: now,
        };
      }
      if (record.createdAt && now - record.createdAt >= REPLY_OUTCOME_WINDOW_MS) {
        changed = true;
        return {
          ...record,
          replied: false,
          checkedAt: now,
          updatedAt: now,
        };
      }
      return record;
    });
    if (changed) await writeReplyOutcomeRecords(updated);
  }
  async function trackOwnNewComment(root) {
    if (!replyOutcomeContext || !root) return;
    const commentId = extractCommentId(root);
    if (!commentId || knownCommentIds.has(commentId)) return;

    const author = extractCommentAuthor(root);
    const currentUser = replyOutcomeContext.username;
    const ageMinutes = extractCommentAgeMinutes(root);
    const looksNew = ageMinutes == null || ageMinutes <= 10;
    const isOwnComment = currentUser ? author === currentUser : looksNew;
    knownCommentIds.add(commentId);
    if (!isOwnComment || !looksNew) return;

    trackedCommentRoots.set(commentId, root);
    await upsertReplyOutcomeRecord({
      postId: replyOutcomeContext.postId,
      commentId,
      createdAt: Date.now(),
      strategy: replyOutcomeContext.replyStrategyLabel || "",
      variant: replyOutcomeContext.quickReplyVariant || "",
      replyStrategyLabel: replyOutcomeContext.replyStrategyLabel || "",
      opportunityScore: replyOutcomeContext.opportunityScore ?? null,
      recommendation: replyOutcomeContext.recommendation || "",
    });
  }
  function scheduleReplyOutcomeScan() {
    if (replyOutcomeScanTimer != null) window.clearTimeout(replyOutcomeScanTimer);
    replyOutcomeScanTimer = window.setTimeout(() => {
      replyOutcomeScanTimer = null;
      void scanReplyOutcomes();
    }, 700);
  }
  async function scanReplyOutcomes() {
    if (!replyOutcomeContext) return;
    for (const root of queryCommentRoots()) {
      await trackOwnNewComment(root);
    }
    await refreshReplyOutcomeStatuses();
  }
  function startReplyOutcomeTracking(result) {
    stopReplyOutcomeObserver();
    const postId = result?.signals?.postId || result?.postId || extractPostId();
    if (!postId) return;
    knownCommentIds = new Set(queryCommentRoots().map((root) => extractCommentId(root)).filter(Boolean));
    trackedCommentRoots = /* @__PURE__ */ new Map();
    replyOutcomeContext = {
      postId,
      username: extractCurrentRedditUsername(),
      replyStrategyLabel: result.replyStrategyLabel || "",
      quickReplyVariant: result.quickReplyVariant || "",
      opportunityScore: result.opportunityScore ?? result.score ?? null,
      recommendation: result.recommendation?.label || result.level || "",
    };
    replyOutcomeObserver = new MutationObserver((mutations) => {
      const hasCommentMutation = mutations.some((mutation) => {
        if (isInsideOpportunityPanel(mutation.target)) return false;
        return Array.from(mutation.addedNodes).some((node) => !isInsideOpportunityPanel(node));
      });
      if (hasCommentMutation) scheduleReplyOutcomeScan();
    });
    replyOutcomeObserver.observe(document.body, { childList: true, subtree: true });
    void refreshReplyOutcomeStatuses();
  }
  function ensureFeedObserver() {
    if (feedObserver) return;
    feedObserver = new MutationObserver(() => {
      if (feedRefreshTimer != null) window.clearTimeout(feedRefreshTimer);
      feedRefreshTimer = window.setTimeout(() => {
        void renderFeedScores();
      }, 350);
    });
    feedObserver.observe(document.body, { childList: true, subtree: true });
  }
  async function renderFeedScores() {
    const ui = await getFeedUiSettings();
    const pageType = "disabled";
    const scopeAllowed = false;
    if (!scopeAllowed) {
      removeFeedOpportunityBadges();
      stopFeedObserver();
      return;
    }
    ensureFeedObserver();
    let items = extractFeedPostCandidates().map((candidate) => ({
      root: candidate.root,
      permalink: candidate.permalink,
      result: scorePost(candidate.signals)
    }));
    if (ui.feedScoreFilter === "high_only") {
      items = items.filter((item) => item.result.level === "HIGH");
    }
    renderFeedOpportunityBadges(items);
    trackOpportunityEvent("opportunity_feed_rendered", {
      posts_scored: items.length,
      feed_page_type: pageType,
      high_only: ui.feedScoreFilter === "high_only"
    });
  }
  var COMMENT_DRAFT_SELECTORS = [
    'textarea[placeholder*="comment" i]',
    'textarea[placeholder*="reply" i]',
    'textarea[data-testid*="comment" i]',
    '[data-testid*="comment"] textarea',
    'div[role="textbox"][contenteditable="true"]',
    'form [contenteditable="true"]'
  ];
  function isVisible(el3) {
    if (!(el3 instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el3);
    const rect = el3.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function findCommentDraftInput() {
    for (const selector of COMMENT_DRAFT_SELECTORS) {
      const nodes = Array.from(document.querySelectorAll(selector));
      const match = nodes.find((node) => {
        if (!isVisible(node)) return false;
        const text = (node.placeholder || node.getAttribute("aria-label") || node.getAttribute("data-testid") || "").toLowerCase();
        return text.includes("comment") || text.includes("reply") || selector.includes("contenteditable");
      });
      if (match && match instanceof HTMLElement) return match;
    }
    return null;
  }
  function getDraftText(el3) {
    if (!el3) return "";
    if (el3 instanceof HTMLTextAreaElement || el3 instanceof HTMLInputElement) {
      return (el3.value || "").trim();
    }
    return (el3.innerText || el3.textContent || "").trim();
  }
  function updateDraftScore() {
    const draft = getDraftText(activeDraftInput);
    if (!draft) {
      renderCommentDraftPlaceholder("Start typing a Reddit reply to score your draft.");
      return;
    }
    const analysis = scoreCommentDraft(draft);
    renderCommentDraftAnalysis(analysis);
    trackOpportunityEvent("reply_draft_scored", {
      score: analysis.score,
      level: analysis.level.toLowerCase(),
      draft_length: analysis.charCount
    });
  }
  function attachDraftInputListener() {
    const nextInput = findCommentDraftInput();
    if (nextInput === activeDraftInput) {
      if (activeDraftInput) updateDraftScore();
      return;
    }
    if (activeDraftInput && draftInputHandler) {
      activeDraftInput.removeEventListener("input", draftInputHandler);
      activeDraftInput.removeEventListener("keyup", draftInputHandler);
      activeDraftInput.removeEventListener("paste", draftInputHandler);
    }
    activeDraftInput = nextInput;
    if (!activeDraftInput) {
      renderCommentDraftPlaceholder("Click into the Reddit reply box to score your comment draft.");
      return;
    }
    draftInputHandler = () => updateDraftScore();
    activeDraftInput.addEventListener("input", draftInputHandler);
    activeDraftInput.addEventListener("keyup", draftInputHandler);
    activeDraftInput.addEventListener("paste", draftInputHandler);
    updateDraftScore();
  }
  function startDraftObserver() {
    stopDraftObserver();
    attachDraftInputListener();
    draftObserver = new MutationObserver((mutations) => {
      const hasExternalMutation = mutations.some((mutation) => {
        if (!isInsideOpportunityPanel(mutation.target)) return true;
        return Array.from(mutation.addedNodes).some((node) => !isInsideOpportunityPanel(node));
      });
      if (!hasExternalMutation) return;
      attachDraftInputListener();
    });
    draftObserver.observe(document.body, { childList: true, subtree: true });
  }
  async function run() {
    removeFeedOpportunityBadges();
    stopFeedObserver();
    stopDraftObserver();
    stopReplyOutcomeObserver();
    const routeContext = getRedditRouteContext();
    if (!isRedditPostDetailPage()) {
      removeOpportunityPanel();
      return;
    }
    const currentUrl = location.href.split("#")[0];
    if (currentUrl === lastRunUrl) return;
    lastRunUrl = currentUrl;
    sessionStorage.removeItem(DISMISSED_KEY2);
    renderLoadingPanel();
    trackOpportunityEvent("opportunity_analysis_requested");
    setTimeout(async () => {
      if (sessionStorage.getItem(DISMISSED_KEY2)) return;
      try {
        await loadDevMode();
        await globalThis.RGCInterestProfile?.ensureLoaded?.();
        await globalThis.RGCSettings?.ensureLoaded?.();
        const analysis = await analyzePost();
        const signals = analysis.signals || {};
        const result = analysis.result || buildFallbackOpportunityResult(getRedditRouteContext(), signals);

        try {
          const stats = await getReplyOutcomeStats();
          Object.assign(result, stats);
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }

        try {
          applySuccessRateSummary(result);
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }

        try {
          applyBetterStrategyHint(result);
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }

        try {
          await globalThis.RGCProGating?.refreshProUserStatus?.();
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }

        try {
          await globalThis.RGCInterestProfile?.recordPostAnalysis?.(signals);
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }

        try {
          renderOpportunityPanel(result);
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
          renderOpportunityPanel(buildFallbackOpportunityResult(getRedditRouteContext(), signals));
        }

        try {
          startDraftObserver();
          startReplyOutcomeTracking(result);
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }

        try {
          saveLastAnalysis({
            type: "opportunity",
            score: result.opportunityScore ?? result.score,
            label: result.recommendation?.label || result.level,
            recommendation: result.recommendation?.label || result.level,
            timing: result.timingLabel,
            engagement: result.engagementLabel,
            match: result.matchLabel,
            conversion: result.conversionLabel,
            demand: result.demandLabel,
            fakeActiveRisk: result.fakeActiveRisk,
            opStatus: result.opStatus,
            opIntent: result.opIntent,
            opLastReplyAgo: result.opLastReplyAgo,
            title: signals.title ? signals.title.slice(0, 80) : undefined
          });
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }
        try {
          trackOpportunityEvent("opportunity_analysis_completed", {
            score: result.opportunityScore ?? result.score,
            level: (result.recommendation?.key || result.level || "skip").toLowerCase(),
            should_reply: Boolean(result.shouldReply),
            reasons_count: (result.why && result.why.positives ? result.why.positives.length : result.reasons?.length || 0),
            risks_count: (result.why && result.why.risks ? result.why.risks.length : result.risks?.length || 0),
            timing_label: result.timingLabel,
            engagement_label: result.engagementLabel,
            match_label: result.matchLabel,
            conversion_label: result.conversionLabel,
            demand_label: result.demandLabel,
            fake_active_risk: result.fakeActiveRisk,
            op_intent: result.opIntent,
          });
        } catch (error) {
          globalThis.rgcError?.("analyze failed", error);
        }
      } catch (error) {
        globalThis.rgcError?.("analyze failed", error);
        const fallback = buildFallbackOpportunityResult(getRedditRouteContext());
        try {
          renderOpportunityPanel(fallback);
        } catch {
        }
        trackOpportunityEvent("opportunity_analysis_failed", {
          reason: "fallback_render",
        });
      }
    }, 800);
  }
  function patchHistory() {
    const _push = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState = function(...args) {
      _push(...args);
      onUrlChange();
    };
    history.replaceState = function(...args) {
      _replace(...args);
      onUrlChange();
    };
    window.addEventListener("popstate", onUrlChange);
  }
  function onUrlChange() {
    const current = location.href;
    const currentNoHash = current.split("#")[0];
    const lastNoHash = lastObservedUrl.split("#")[0];
    if (currentNoHash === lastNoHash) return;
    lastObservedUrl = current;
    removeFeedOpportunityBadges();
    stopFeedObserver();
    if (isRedditPostDetailPage(current)) {
      sessionStorage.removeItem(DISMISSED_KEY2);
      renderLoadingPanel();
    } else {
      stopReplyOutcomeObserver();
      cleanupInjectedPanels();
    }
    stopAnalysisWaiter();
    if (cleanupTimer != null) window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(() => {
      if (!isRedditPostDetailPage()) {
        cleanupInjectedPanels();
      }
    }, 300);
    if (navTimer != null) window.clearTimeout(navTimer);
    navTimer = window.setTimeout(() => {
      scheduleAnalysis();
    }, 450);
  }
  function attachTitleObserver() {
    function observe(el3) {
      new MutationObserver(onUrlChange).observe(el3, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
    const titleEl = document.querySelector("head > title");
    if (titleEl) {
      observe(titleEl);
      return;
    }
    const headEl = document.querySelector("head");
    if (!headEl) return;
    const headObserver = new MutationObserver(() => {
      const el3 = document.querySelector("head > title");
      if (el3) {
        headObserver.disconnect();
        observe(el3);
      }
    });
    headObserver.observe(headEl, { childList: true });
  }
  function init() {
    patchHistory();
    attachTitleObserver();
    const routeFallbackObserver = new MutationObserver(() => {
      const currentNoHash = location.href.split("#")[0];
      const lastNoHash = lastObservedUrl.split("#")[0];
      if (currentNoHash !== lastNoHash) {
        onUrlChange();
      }
    });
    const observeRouteFallback = () => {
      if (document.body) {
        routeFallbackObserver.observe(document.body, { childList: true, subtree: true });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", observeRouteFallback, { once: true });
    } else {
      observeRouteFallback();
    }
    chromeApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && (changes[SETTINGS_KEY] || changes.rgc_dev_mode)) {
        scheduleAnalysis();
      }
    });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        scheduleAnalysis();
      });
    } else {
      scheduleAnalysis();
    }
  }
  init();
})();
