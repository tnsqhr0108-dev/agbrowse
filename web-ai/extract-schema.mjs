// @ts-check
/**
 * G05 — Schema-bound page extraction.
 *
 * Provides a small, fail-closed validator for active-page extraction
 * against a JSON-Schema-like shape. Intentionally a SUBSET, not a full
 * Zod/Ajv replacement — kept local, dep-free, and deterministic.
 *
 * Supported subset:
 *   { type: 'object', properties: { ... }, required: [...] }
 *   { type: 'array',  items: <schema>, minItems?, maxItems? }
 *   { type: 'string' | 'number' | 'integer' | 'boolean' | 'null', enum?: [...] }
 *
 * Anything outside the subset is rejected at schema-load time with a
 * `capability.unsupported` error so callers cannot silently get partial
 * validation.
 */

/** @typedef {{ type: string, properties?: Record<string, unknown>, required?: string[], items?: unknown, enum?: unknown[], minItems?: number, maxItems?: number }} ExtractSchema */
/** @typedef {{ ok: true, data: unknown } | { ok: false, errors: Array<{ path: string, code: string, detail: string }> }} ExtractValidation */

const SUPPORTED_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);

/**
 * Throws `capability.unsupported` if schema uses constructs outside the documented subset.
 * @param {unknown} schema
 * @param {string} path
 */
export function assertSupportedSchema(schema, path = '$') {
    if (!schema || typeof schema !== 'object') {
        throw Object.assign(new Error(`schema at ${path} must be an object`), { code: 'schema.malformed' });
    }
    const s = /** @type {ExtractSchema} */ (schema);
    if (typeof s.type !== 'string' || !SUPPORTED_TYPES.has(s.type)) {
        throw Object.assign(
            new Error(`schema at ${path} uses unsupported type "${s.type}" (subset: ${[...SUPPORTED_TYPES].join('|')})`),
            { code: 'capability.unsupported' },
        );
    }
    if (s.type === 'object' && s.properties) {
        for (const [key, child] of Object.entries(s.properties)) {
            assertSupportedSchema(child, `${path}.${key}`);
        }
    }
    if (s.type === 'array' && s.items) {
        assertSupportedSchema(s.items, `${path}[]`);
    }
}

/**
 * Validate `data` against `schema`. Fail-closed: returns ok=false with all collected errors.
 * @param {ExtractSchema} schema
 * @param {unknown} data
 * @returns {ExtractValidation}
 */
export function validateExtraction(schema, data) {
    assertSupportedSchema(schema);
    /** @type {Array<{ path: string, code: string, detail: string }>} */
    const errors = [];
    walk(schema, data, '$', errors);
    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, data };
}

/**
 * @param {ExtractSchema} schema
 * @param {unknown} value
 * @param {string} path
 * @param {Array<{ path: string, code: string, detail: string }>} errors
 */
function walk(schema, value, path, errors) {
    if (schema.type === 'null') {
        if (value !== null) errors.push({ path, code: 'type.mismatch', detail: 'expected null' });
        return;
    }
    if (value === null || value === undefined) {
        errors.push({ path, code: 'value.missing', detail: `expected ${schema.type}` });
        return;
    }
    if (schema.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push({ path, code: 'type.mismatch', detail: 'expected object' });
            return;
        }
        const v = /** @type {Record<string, unknown>} */ (value);
        for (const r of schema.required || []) {
            if (!(r in v)) errors.push({ path: `${path}.${r}`, code: 'required.missing', detail: `key "${r}" required` });
        }
        for (const [key, child] of Object.entries(schema.properties || {})) {
            if (key in v) walk(/** @type {ExtractSchema} */ (child), v[key], `${path}.${key}`, errors);
        }
        return;
    }
    if (schema.type === 'array') {
        if (!Array.isArray(value)) {
            errors.push({ path, code: 'type.mismatch', detail: 'expected array' });
            return;
        }
        if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
            errors.push({ path, code: 'array.tooShort', detail: `len=${value.length} < min=${schema.minItems}` });
        }
        if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
            errors.push({ path, code: 'array.tooLong', detail: `len=${value.length} > max=${schema.maxItems}` });
        }
        if (schema.items) {
            value.forEach((item, i) => walk(/** @type {ExtractSchema} */ (schema.items), item, `${path}[${i}]`, errors));
        }
        return;
    }
    if (schema.type === 'string' && typeof value !== 'string') {
        errors.push({ path, code: 'type.mismatch', detail: 'expected string' });
        return;
    }
    if (schema.type === 'integer') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            errors.push({ path, code: 'type.mismatch', detail: 'expected integer' });
            return;
        }
    } else if (schema.type === 'number' && typeof value !== 'number') {
        errors.push({ path, code: 'type.mismatch', detail: 'expected number' });
        return;
    }
    if (schema.type === 'boolean' && typeof value !== 'boolean') {
        errors.push({ path, code: 'type.mismatch', detail: 'expected boolean' });
        return;
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
        errors.push({ path, code: 'enum.mismatch', detail: `value not in enum (${schema.enum.length} options)` });
    }
}

export const EXTRACT_SCHEMA_VERSION = 'extract-schema-v1';
