import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildGeneratedImageDetectionExpression,
    collectImages,
    detectGeneratedImages,
    deriveGeneratedImageOutputPaths,
    isAllowedChatGptImageUrl,
    isImageOnlyGeneratedImageChromeText,
    resolveGeneratedImageWaitTimeoutMs,
} from '../../web-ai/chatgpt-images.mjs';

afterEach(() => {
    vi.useRealTimers();
});

describe('ChatGPT generated image helpers', () => {
    it('derives sibling output paths for multiple generated images', () => {
        expect(deriveGeneratedImageOutputPaths('/tmp/out.png', 3)).toEqual([
            '/tmp/out.png',
            '/tmp/out-2.png',
            '/tmp/out-3.png',
        ]);
    });

    it('allows only ChatGPT estuary image URLs', () => {
        expect(isAllowedChatGptImageUrl('https://chatgpt.com/backend-api/estuary/content?id=file_abc123')).toBe(true);
        expect(isAllowedChatGptImageUrl('https://evil.test/backend-api/estuary/content?id=file_abc123')).toBe(false);
        expect(isAllowedChatGptImageUrl('https://chatgpt.com/not-estuary?id=file_abc123')).toBe(false);
    });

    it('normalizes generated image wait timeout', () => {
        expect(resolveGeneratedImageWaitTimeoutMs(undefined)).toBe(60_000);
        expect(resolveGeneratedImageWaitTimeoutMs(1)).toBe(5_000);
        expect(resolveGeneratedImageWaitTimeoutMs(90_000)).toBe(90_000);
    });

    it('recognizes image-only ChatGPT chrome text', () => {
        expect(isImageOnlyGeneratedImageChromeText('Edit')).toBe(true);
        expect(isImageOnlyGeneratedImageChromeText('Creating image')).toBe(true);
        expect(isImageOnlyGeneratedImageChromeText('Stopped thinking Edit')).toBe(true);
        expect(isImageOnlyGeneratedImageChromeText('Here is the image')).toBe(false);
    });

    it('detects current ChatGPT image-only assistant turns by conversation-turn roots', () => {
        const expression = buildGeneratedImageDetectionExpression(1);

        expect(expression).toContain('conversation-turn');
        expect(expression).toContain('data-turn');
        expect(expression).toContain('/backend-api/estuary/content?id=file_');
        expect(expression).toContain('generated image');
    });

    it('normalizes CDP array results from generated image detection', async () => {
        const cdp = {
            send: vi.fn(async () => ({
                result: {
                    value: [
                        {
                            url: 'https://chatgpt.com/backend-api/estuary/content?id=file_abc123&v=0',
                            fileId: 'file_abc123',
                            alt: 'Generated image: blue square',
                            width: 1254,
                            height: 1254,
                        },
                    ],
                },
            })),
        };

        await expect(detectGeneratedImages(cdp, { baselineAssistantCount: 1 })).resolves.toEqual([
            {
                url: 'https://chatgpt.com/backend-api/estuary/content?id=file_abc123&v=0',
                fileId: 'file_abc123',
                alt: 'Generated image: blue square',
                width: 1254,
                height: 1254,
            },
        ]);
        expect(cdp.send).toHaveBeenCalledWith('Runtime.evaluate', expect.objectContaining({
            returnByValue: true,
        }));
    });

    it('returns explicit errors when --output-image requested but no image appears', async () => {
        vi.useFakeTimers();
        const cdp = {
            send: vi.fn(async () => ({ result: { value: '[]' } })),
        };
        const pending = collectImages(cdp, {
            baselineAssistantCount: 0,
            outputPath: '/tmp/out.png',
            waitTimeoutMs: 1,
        });

        await vi.advanceTimersByTimeAsync(6_000);
        const result = await pending;

        expect(result.explicitOutputRequested).toBe(true);
        expect(result.savedPaths).toEqual([]);
        expect(result.errors).toContain('no generated image detected for explicit output path');
    });
});
