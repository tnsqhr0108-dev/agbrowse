// @ts-check
/**
 * Deep Research report-selection helpers (32.1). Pure functions, extracted from
 * chatgpt-deep-research.mjs to keep that module under the 500-line bar. Shared
 * by extractResearchReport (32.1) and the resume path (35.2).
 */

// First-line markers of a planning card / progress / status update — NOT a
// completed Deep Research report. Matched against the normalized first line.
const DR_INCOMPLETE_MARKERS = [
    /^(researching|reading|searching|browsing|analy[sz]ing|gathering)\b/i,
    /^(thinking|working on it|in progress|please wait)\b/i,
    /^starting (deep )?research/i,
    /^i'?ll (research|look into|start|begin|investigate)/i,
    /^let me (research|look|dig|investigate)/i,
    /^here'?s my (research )?plan/i,
    /^research plan\b/i,
    /^(planning|plan:)\b/i,
    /^researched \d+ sources?$/i,
];

const DR_MIN_REPORT_CHARS = 120;

/**
 * Normalize Deep Research report text: CRLF→LF, collapse 3+ blank lines, trim.
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeDeepResearchReportText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * True if the text is an incomplete Deep Research artifact — a planning card,
 * progress/status line, or too short to be a final report. A completed report
 * is long-form and does not lead with a status marker.
 * @param {unknown} text
 * @returns {boolean}
 */
export function isIncompleteDeepResearchText(text) {
    const norm = normalizeDeepResearchReportText(text);
    if (norm.length < DR_MIN_REPORT_CHARS) return true;
    const firstLine = norm.split('\n', 1)[0].trim();
    return DR_INCOMPLETE_MARKERS.some((re) => re.test(firstLine));
}

/**
 * Choose the authoritative Deep Research report between a page-scoped target
 * read and a legacy frame read. Prefers a COMPLETED target over a frame; falls
 * back to a completed frame; if neither is complete, returns the longer
 * non-empty read flagged `completed:false`, or `null` when both are empty.
 * @param {{ text?: string, sources?: string[], from?: string }|null} targetRead
 * @param {{ text?: string, sources?: string[], from?: string }|null} frameRead
 * @returns {{ text: string, sources: string[], from: string, completed: boolean }|null}
 */
export function chooseDeepResearchReportRead(targetRead, frameRead) {
    const shape = (read, fallbackFrom) => ({
        text: normalizeDeepResearchReportText(read?.text),
        sources: Array.isArray(read?.sources) ? read.sources : [],
        from: read?.from || fallbackFrom,
    });
    const target = targetRead ? shape(targetRead, 'target') : null;
    const frame = frameRead ? shape(frameRead, 'frame') : null;

    if (target?.text && !isIncompleteDeepResearchText(target.text)) return { ...target, completed: true };
    if (frame?.text && !isIncompleteDeepResearchText(frame.text)) return { ...frame, completed: true };

    const candidates = [target, frame].filter((r) => r && r.text);
    if (!candidates.length) return null;
    const best = candidates.sort((a, b) => b.text.length - a.text.length)[0];
    return { ...best, completed: false };
}
