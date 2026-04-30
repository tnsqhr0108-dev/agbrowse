export const WEB_AI_VENDOR = Object.freeze({
    CHATGPT: 'chatgpt',
    GEMINI: 'gemini',
    GROK: 'grok',
});

export const WEB_AI_STATUS = Object.freeze({
    READY: 'ready',
    RENDERED: 'rendered',
    SENT: 'sent',
    STREAMING: 'streaming',
    COMPLETE: 'complete',
    BLOCKED: 'blocked',
    TIMEOUT: 'timeout',
    ERROR: 'error',
});

export const ATTACHMENT_POLICY = Object.freeze({
    INLINE_ONLY: 'inline-only',
    UPLOAD: 'upload',
    AUTO: 'auto',
});

/**
 * @typedef {'chatgpt'|'gemini'|'grok'} WebAiVendor
 * @typedef {'inline-only'|'upload'|'auto'} AttachmentPolicy
 * @typedef {'ready'|'rendered'|'sent'|'streaming'|'complete'|'blocked'|'timeout'|'error'} WebAiStatus
 *
 * @typedef {Object} QuestionEnvelope
 * @property {WebAiVendor} vendor
 * @property {string=} system
 * @property {string} prompt
 * @property {string=} project
 * @property {string=} goal
 * @property {string=} context
 * @property {string=} question
 * @property {string=} output
 * @property {string=} constraints
 * @property {AttachmentPolicy} attachmentPolicy
 *
 * @typedef {Object} RenderedQuestionBundle
 * @property {string} markdown
 * @property {string} composerText
 * @property {number} estimatedChars
 * @property {string[]} warnings
 *
 * @typedef {Object} CommittedTurnBaseline
 * @property {WebAiVendor} vendor
 * @property {string} url
 * @property {string} promptHash
 * @property {number} assistantCount
 * @property {string=} textHash
 * @property {string} capturedAt
 *
 * @typedef {Object} WebAiOutput
 * @property {boolean} ok
 * @property {WebAiVendor} vendor
 * @property {WebAiStatus} status
 * @property {string=} url
 * @property {string=} answerText
 * @property {RenderedQuestionBundle=} rendered
 * @property {CommittedTurnBaseline=} baseline
 * @property {string[]} warnings
 * @property {string=} error
 */
