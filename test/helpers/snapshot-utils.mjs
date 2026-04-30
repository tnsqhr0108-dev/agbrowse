/**
 * Parse a snapshot stdout line to find a ref by role and name.
 */
export function extractRef(snapshot, role, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = snapshot.match(new RegExp(`^(e\\d+)\\s+.*${role}\\s+\\"${escaped}\\"`, 'm'));
    return match?.[1] || null;
}

export function extractRefs(snapshot, role, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return Array.from(snapshot.matchAll(new RegExp(`^(e\\d+)\\s+.*${role}\\s+\\"${escaped}\\"`, 'gm')))
        .map(match => match[1]);
}
