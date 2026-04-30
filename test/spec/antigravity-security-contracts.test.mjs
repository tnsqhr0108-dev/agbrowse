import { describe, it } from 'vitest';

describe('Antigravity Security Contracts', () => {
    describe('URL Allowlist / Denylist', () => {
        it.skip('blocks navigation to undefined domains when allowlist is active');
        it.skip('blocks navigation to domains explicitly in denylist');
        it.skip('allows navigation to allowed domains');
        it.skip('blocks file:// protocol and other dangerous schemes by default');
    });

    describe('BrowserJsExecutionPolicy', () => {
        it.skip('blocks evaluate commands when policy is deny');
        it.skip('allows only specific expression signatures when policy is allowlist');
    });
});
