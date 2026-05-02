import { editorContractForVendor } from './vendor-editor-contract.mjs';
import { buildWebAiSnapshot } from './ax-snapshot.mjs';

export async function auditContractAgainstSnapshot(page, vendor) {
    const contract = editorContractForVendor(vendor);
    const snapshot = await buildWebAiSnapshot(page, { maxDepth: 3 });
    
    const drifts = [];
    for (const [feature, target] of Object.entries(contract.semanticTargets || {})) {
        const matches = snapshot.refs.filter(ref => 
            target.roles?.includes(ref.role) &&
            target.names?.some(p => p.test(ref.name))
        );
        
        if (matches.length === 0) {
            drifts.push({ feature, severity: 'error', message: `No elements match contract for ${feature}` });
        } else if (matches.length > 1) {
            drifts.push({ feature, severity: 'warn', message: `Ambiguous match: ${matches.length} elements for ${feature}` });
        }
    }
    
    return {
        vendor,
        snapshotId: snapshot.snapshotId,
        driftCount: drifts.length,
        errors: drifts.filter(d => d.severity === 'error'),
        warnings: drifts.filter(d => d.severity === 'warn'),
        drifts,
    };
}
