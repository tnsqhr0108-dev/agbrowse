export function parseAriaYaml(yaml) {
    const nodes = [];
    let counter = 0;
    for (const line of yaml.split('\n')) {
        if (!line.trim() || !line.includes('-')) continue;
        const indent = line.search(/\S/);
        const depth = Math.floor(indent / 2);
        const match = line.match(/-\s+(\w+)(?:\s+"([^"]*)")?/);
        if (!match) continue;
        counter++;
        const role = match[1];
        const name = match[2] || '';
        nodes.push({ ref: `e${counter}`, role, name, depth });
    }
    return nodes;
}

export function parseCdpAxTree(axNodes) {
    const nodes = [];
    let counter = 0;
    const depthMap = {};
    for (const node of axNodes) {
        const parentDepth = node.parentId ? (depthMap[node.parentId] ?? 0) : -1;
        const depth = parentDepth + 1;
        depthMap[node.nodeId] = depth;
        const role = node.role?.value || 'unknown';
        const name = node.name?.value || '';
        const value = node.value?.value || '';
        if (node.ignored) continue;
        counter++;
        nodes.push({
            ref: `e${counter}`,
            role,
            name,
            ...(value ? { value } : {}),
            depth,
        });
    }
    return nodes;
}

export function annotateNodeOccurrences(nodes) {
    const counts = new Map();
    return nodes.map(node => {
        const key = `${node.role}\u0000${node.name ?? ''}`;
        const occurrence = counts.get(key) ?? 0;
        counts.set(key, occurrence + 1);
        return { ...node, occurrence };
    });
}

export function filterRequests(requests, filter) {
    if (!filter) return requests;
    return requests.filter(request => request.url.includes(filter));
}

export function dedupeRequests(requests) {
    const seen = new Set();
    return requests.filter(request => {
        const key = `${request.method}:${request.type || ''}:${request.url}:${request.source || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
