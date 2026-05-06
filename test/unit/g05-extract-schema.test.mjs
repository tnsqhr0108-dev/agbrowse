// @ts-check
import { describe, it, expect } from 'vitest';
import {
    validateExtraction,
    assertSupportedSchema,
    EXTRACT_SCHEMA_VERSION,
} from '../../web-ai/extract-schema.mjs';

describe('G05 extract-schema validator', () => {
    it('schema version is frozen', () => {
        expect(EXTRACT_SCHEMA_VERSION).toBe('extract-schema-v1');
    });

    it('accepts a well-formed object', () => {
        const schema = {
            type: 'object',
            properties: { title: { type: 'string' }, count: { type: 'integer' } },
            required: ['title'],
        };
        const r = validateExtraction(schema, { title: 'hello', count: 3 });
        expect(r.ok).toBe(true);
    });

    it('rejects a missing required key with required.missing', () => {
        const schema = { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] };
        const r = validateExtraction(schema, {});
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.errors[0].code).toBe('required.missing');
            expect(r.errors[0].path).toBe('$.title');
        }
    });

    it('rejects a type mismatch with type.mismatch', () => {
        const schema = { type: 'object', properties: { count: { type: 'integer' } } };
        const r = validateExtraction(schema, { count: 'three' });
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0].code).toBe('type.mismatch');
    });

    it('validates array items recursively', () => {
        const schema = {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
            minItems: 1,
        };
        const r = validateExtraction(schema, [{ id: 1 }, { id: 'x' }]);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0].path).toBe('$[1].id');
    });

    it('enforces minItems', () => {
        const schema = { type: 'array', items: { type: 'string' }, minItems: 2 };
        const r = validateExtraction(schema, ['a']);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0].code).toBe('array.tooShort');
    });

    it('enforces enum', () => {
        const schema = { type: 'string', enum: ['a', 'b'] };
        const r = validateExtraction(schema, 'c');
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.errors[0].code).toBe('enum.mismatch');
    });

    it('throws capability.unsupported for unsupported keywords', () => {
        expect(() => assertSupportedSchema({ type: 'object', oneOf: [] })).not.toThrow();
        expect(() => assertSupportedSchema({ type: 'unknown' })).toThrow(/unsupported type/);
    });
});
