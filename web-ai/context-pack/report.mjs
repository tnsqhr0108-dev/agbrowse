export function renderContextDryRunReport(result, options = {}) {
    const mode = options.mode || (options.full ? 'full' : options.json ? 'json' : 'summary');
    if (mode === 'json') return JSON.stringify(toJsonResult(result, options), null, 2);
    if (mode === 'full') return result.transport === 'inline' ? result.composerText : result.attachmentText;
    return renderSummary(result);
}

export function toJsonResult(result, options = {}) {
    const includeComposerText = Boolean(options.full || options.includeComposerText);
    const base = {
        ok: result.ok,
        status: result.status,
        vendor: result.vendor,
        model: result.model,
        budget: result.budget,
        transport: result.transport,
        files: result.files.map(file => ({
            path: file.path,
            relativePath: file.relativePath,
            sizeBytes: file.sizeBytes,
            estimatedTokens: file.estimatedTokens,
            language: file.language,
        })),
        attachments: result.attachments || [],
        excluded: result.excluded,
        warnings: result.warnings,
    };
    if (includeComposerText) base.composerText = result.composerText;
    return base;
}

function renderSummary(result) {
    const lines = [
        `[context-dry-run] ${result.files.length} files, ~${result.budget.estimatedTokens} / ${result.budget.maxInputTokens} tokens (${result.budget.status})`,
        `[context-dry-run] inline chars: ${result.budget.inlineChars} / ${result.budget.inlineCharLimit}`,
        `[context-dry-run] transport: ${result.transport || 'upload'}`,
    ];

    if (result.attachments?.length) {
        lines.push('');
        lines.push('Attachments to upload:');
        for (const attachment of result.attachments) {
            lines.push(`  - ${attachment.displayPath || attachment.path} — ${attachment.sizeBytes} bytes`);
        }
    }

    lines.push('');
    lines.push('Included:');
    if (result.files.length === 0) lines.push('  (none)');
    for (const file of result.files) {
        lines.push(`  - ${file.relativePath} — ~${file.estimatedTokens} tokens, ${file.sizeBytes} bytes`);
    }

    if (result.excluded.length || result.warnings.length) {
        lines.push('');
        lines.push('Excluded:');
        if (result.excluded.length === 0) lines.push('  (none)');
        for (const file of result.excluded) {
            lines.push(`  - ${file.relativePath || file.path} — ${file.reason}${file.sizeBytes ? ` (${file.sizeBytes} bytes)` : ''}`);
        }
    }

    if (result.warnings.length) {
        lines.push('');
        lines.push('Warnings:');
        for (const warning of result.warnings) lines.push(`  - ${warning}`);
    }

    return lines.join('\n');
}
