// @ts-check

const RUNWAY_BASE_URL = 'https://app.runwayml.com';

/** @typedef {{ id: string, label: string, url: string | null, deepAutomation: boolean, purpose: string }} RunwaySurface */
/** @typedef {{ name: string, selector: string, locator: string, purpose: string, blocked?: boolean }} RunwaySelector */

/** @type {Readonly<Record<string, RunwaySurface>>} */
export const RUNWAY_SURFACES = Object.freeze({
    apps: {
        id: 'apps',
        label: 'Apps',
        url: `${RUNWAY_BASE_URL}/ai-tools/generate?mode=apps`,
        deepAutomation: true,
        purpose: 'Unlimited-relevant app/model catalog and starter surface',
    },
    'custom-tools': {
        id: 'custom-tools',
        label: 'Custom/tools',
        url: `${RUNWAY_BASE_URL}/ai-tools/generate?mode=tools`,
        deepAutomation: true,
        purpose: 'Unlimited-relevant generation form and parameter controls',
    },
    agent: {
        id: 'agent',
        label: 'Agent',
        url: null,
        deepAutomation: false,
        purpose: 'Surface-only conversational/outline flow',
    },
    recents: {
        id: 'recents',
        label: 'Recents',
        url: `${RUNWAY_BASE_URL}/ai-tools/recents`,
        deepAutomation: true,
        purpose: 'Asset/job library with download capability',
    },
    workflow: {
        id: 'workflow',
        label: 'Workflow',
        url: null,
        deepAutomation: false,
        purpose: 'Surface-only node/canvas flow',
    },
    characters: {
        id: 'characters',
        label: 'Characters',
        url: null,
        deepAutomation: false,
        purpose: 'Surface-only catalog/input source',
    },
});

/** @type {Readonly<Record<string, string>>} */
export const SURFACE_ALIASES = Object.freeze({
    app: 'apps',
    apps: 'apps',
    custom: 'custom-tools',
    tools: 'custom-tools',
    tool: 'custom-tools',
    'custom-tools': 'custom-tools',
    'custom/tools': 'custom-tools',
    agent: 'agent',
    recents: 'recents',
    recent: 'recents',
    sessions: 'recents',
    workflow: 'workflow',
    workflows: 'workflow',
    characters: 'characters',
    character: 'characters',
});

/** @type {readonly RunwaySelector[]} */
export const COMMON_SELECTORS = Object.freeze([
    {
        name: 'left-sidebar',
        selector: '[data-testid="mira-app-sidebar"]',
        locator: 'page.locator(\'[data-testid="mira-app-sidebar"]\')',
        purpose: 'Runway main navigation container',
    },
    {
        name: 'unlimited-plan-indicator',
        selector: '[data-testid="credit-info-button"]',
        locator: 'page.locator(\'[data-testid="credit-info-button"]\')',
        purpose: 'Plan/quota preflight. Read only.',
    },
]);

/** @type {Readonly<Record<string, readonly RunwaySelector[]>>} */
export const SURFACE_SELECTORS = Object.freeze({
    apps: Object.freeze([
        {
            name: 'apps-search',
            selector: 'input[placeholder="Describe your creation or search apps"]',
            locator: 'page.getByPlaceholder(\'Describe your creation or search apps\')',
            purpose: 'Apps search/input surface',
        },
        {
            name: 'models-tab',
            selector: 'role=tab[name="Models"]',
            locator: 'page.getByRole(\'tab\', { name: \'Models\' })',
            purpose: 'Models catalog tab',
        },
        {
            name: 'model-card',
            selector: 'role=button[name=/^Seedance 2\\.0 - Video$/]',
            locator: 'page.getByRole(\'button\', { name: /^Seedance 2\\.0 - Video$/ })',
            purpose: 'Representative Apps model card selector pattern',
        },
    ]),
    'custom-tools': Object.freeze([
        {
            name: 'prompt-editor',
            selector: 'div[aria-label="Prompt"]',
            locator: 'page.locator(\'div[aria-label="Prompt"]\')',
            purpose: 'Prompt editor for Custom/tools generation setup',
        },
        {
            name: 'file-input',
            selector: 'input[type="file"]',
            locator: 'page.locator(\'input[type="file"]\')',
            purpose: 'Asset upload input. Use only when upload is requested.',
        },
        {
            name: 'base-model-select',
            selector: '[data-testid="select-base-model"]',
            locator: 'page.locator(\'[data-testid="select-base-model"]\')',
            purpose: 'Video/image model selection control',
        },
        {
            name: 'related-apps',
            selector: '#related-apps-trigger',
            locator: 'page.locator(\'#related-apps-trigger\')',
            purpose: 'Helpful Apps relation picker',
        },
        {
            name: 'generation-cost',
            selector: 'role=button[name=/^View generation cost$/]',
            locator: 'page.getByRole(\'button\', { name: /^View generation cost$/ })',
            purpose: 'Cost preflight candidate. Read only.',
        },
        {
            name: 'generate',
            selector: 'role=button[name=/^Generate$/]',
            locator: 'page.getByRole(\'button\', { name: /^Generate$/ })',
            purpose: 'Submission selector. Blocked unless --allow-submit.',
            blocked: true,
        },
        {
            name: 'mode-toggle',
            selector: '[data-testid="explore-credits-toggle"], button:has-text("Explore"), button:has-text("Credits")',
            locator: 'page.locator(\'[data-testid="explore-credits-toggle"]\')',
            purpose: 'Explore/Credits mode toggle',
        },
        {
            name: 'duration-select',
            selector: '[data-testid="duration-select"], button:has-text("5s"), button:has-text("10s")',
            locator: 'page.locator(\'[data-testid="duration-select"]\')',
            purpose: 'Video duration selection',
        },
        {
            name: 'ratio-select',
            selector: '[data-testid="aspect-ratio-select"], button:has-text("16:9"), button:has-text("9:16")',
            locator: 'page.locator(\'[data-testid="aspect-ratio-select"]\')',
            purpose: 'Aspect ratio selection',
        },
        {
            name: 'resolution-select',
            selector: '[data-testid="resolution-select"], button:has-text("720p"), button:has-text("1080p")',
            locator: 'page.locator(\'[data-testid="resolution-select"]\')',
            purpose: 'Resolution selection',
        },
        {
            name: 'audio-toggle',
            selector: '[data-testid="audio-toggle"], input[type="checkbox"][aria-label*="audio" i]',
            locator: 'page.locator(\'[data-testid="audio-toggle"]\')',
            purpose: 'Audio generation toggle',
        },
    ]),
    recents: Object.freeze([
        {
            name: 'asset-card',
            selector: '[data-testid="asset-card"], [class*="asset-card"], [class*="AssetCard"]',
            locator: 'page.locator(\'[data-testid="asset-card"]\')',
            purpose: 'Recents asset card container',
        },
        {
            name: 'asset-download',
            selector: '[data-testid="asset-download"], button[aria-label*="download" i], a[download]',
            locator: 'page.locator(\'[data-testid="asset-download"]\')',
            purpose: 'Asset download button',
        },
    ]),
});

export const BLOCKED_ACTIONS = Object.freeze([
    'Generate',
    'Run all',
    'payment',
    'destructive',
    'submit-like controls',
]);

/**
 * @param {number} level — 0=read-only, 1=mutation, 2=submit
 */
export function buildRunwaySafety(level = 0) {
    if (level >= 2) {
        return {
            mutationAllowed: true,
            submitAllowed: true,
            blockedActions: ['payment', 'destructive'],
            note: 'Level 2: Generate button click is allowed. Payment and destructive actions remain blocked.',
        };
    }
    if (level >= 1) {
        return {
            mutationAllowed: true,
            submitAllowed: false,
            blockedActions: BLOCKED_ACTIONS,
            note: 'Level 1: Prompt input, model selection, file upload allowed. Generate button remains blocked.',
        };
    }
    return {
        mutationAllowed: false,
        submitAllowed: false,
        blockedActions: BLOCKED_ACTIONS,
        note: 'Level 0: Read-only. No mutation or submission allowed.',
    };
}
