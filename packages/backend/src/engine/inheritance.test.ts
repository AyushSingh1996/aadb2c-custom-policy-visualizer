import { describe, it, expect } from 'vitest';
import { buildInheritanceGraph } from './inheritance.js';
import type { PolicyFile } from '@policy-analyzer/shared';

let seq = 0;
function makeFile(
  policyId: string,
  tenantId: string,
  basePolicyId?: string,
  basePolicyTenantId?: string,
): PolicyFile {
  const id = `file-${++seq}`;
  const f: PolicyFile = {
    id,
    fileName: `${policyId}.xml`,
    sizeBytes: 0,
    lastModified: '2026-01-01T00:00:00.000Z',
    category: basePolicyId ? 'Extension' : 'Base',
    policyId,
    tenantId,
    rawXml: '',
    parsedAt: '2026-01-01T00:00:00.000Z',
  };
  if (basePolicyId !== undefined) f.basePolicyId = basePolicyId;
  if (basePolicyTenantId !== undefined) f.basePolicyTenantId = basePolicyTenantId;
  return f;
}

describe('buildInheritanceGraph', () => {
  it('resolves a clean three-tier chain: Base → Extension → RP', () => {
    const base = makeFile('B2C_1A_Base', 'tenant.onmicrosoft.com');
    const ext = makeFile('B2C_1A_Extensions', 'tenant.onmicrosoft.com', 'B2C_1A_Base');
    const rp = makeFile('B2C_1A_SignUp', 'tenant.onmicrosoft.com', 'B2C_1A_Extensions');

    const graph = buildInheritanceGraph([base, ext, rp]);

    expect(graph.parentIds.get(base.id)).toBeUndefined();
    expect(graph.parentIds.get(ext.id)).toBe(base.id);
    expect(graph.parentIds.get(rp.id)).toBe(ext.id);
    expect(graph.orphanReferences).toHaveLength(0);
    expect(graph.cycleFileIds).toHaveLength(0);
  });

  it('emits an OrphanReference when the base policy is not in the upload', () => {
    const rp = makeFile('B2C_1A_SignUp', 'tenant.onmicrosoft.com', 'B2C_1A_MissingBase');

    const graph = buildInheritanceGraph([rp]);

    expect(graph.parentIds.get(rp.id)).toBeUndefined();
    expect(graph.orphanReferences).toHaveLength(1);
    expect(graph.orphanReferences[0]?.referencedPolicyId).toBe('B2C_1A_MissingBase');
    expect(graph.orphanReferences[0]?.referencedFromFileId).toBe(rp.id);
  });

  it('detects a direct cycle (A → B → A) and records cycleErrors', () => {
    const a = makeFile('B2C_1A_A', 'tenant.onmicrosoft.com', 'B2C_1A_B');
    const b = makeFile('B2C_1A_B', 'tenant.onmicrosoft.com', 'B2C_1A_A');

    const graph = buildInheritanceGraph([a, b]);

    expect(graph.cycleFileIds.length).toBeGreaterThan(0);
    expect(graph.cycleErrors.length).toBeGreaterThan(0);
    expect(graph.cycleErrors[0]?.error.message).toMatch(/cycle/i);
  });

  it('prefers TenantId+PolicyId match over PolicyId-only when basePolicyTenantId is set', () => {
    // Two files with the same PolicyId but different tenants
    const baseA = makeFile('B2C_1A_Shared', 'tenantA.onmicrosoft.com');
    const baseB = makeFile('B2C_1A_Shared', 'tenantB.onmicrosoft.com');
    // Child references the TenantB version explicitly
    const child = makeFile(
      'B2C_1A_Child',
      'tenantA.onmicrosoft.com',
      'B2C_1A_Shared',
      'tenantB.onmicrosoft.com',
    );

    const graph = buildInheritanceGraph([baseA, baseB, child]);

    expect(graph.parentIds.get(child.id)).toBe(baseB.id);
    expect(graph.orphanReferences).toHaveLength(0);
  });

  it('resolves a deep chain (5 levels) without errors', () => {
    const files = [
      makeFile('B2C_1A_L1', 'tenant.onmicrosoft.com'),
      makeFile('B2C_1A_L2', 'tenant.onmicrosoft.com', 'B2C_1A_L1'),
      makeFile('B2C_1A_L3', 'tenant.onmicrosoft.com', 'B2C_1A_L2'),
      makeFile('B2C_1A_L4', 'tenant.onmicrosoft.com', 'B2C_1A_L3'),
      makeFile('B2C_1A_L5', 'tenant.onmicrosoft.com', 'B2C_1A_L4'),
    ];

    const graph = buildInheritanceGraph(files);

    expect(graph.orphanReferences).toHaveLength(0);
    expect(graph.cycleFileIds).toHaveLength(0);
    // Each file's parent resolves to the previous one
    for (let i = 1; i < files.length; i++) {
      expect(graph.parentIds.get(files[i]!.id)).toBe(files[i - 1]!.id);
    }
  });

  it('handles an empty input without throwing', () => {
    const graph = buildInheritanceGraph([]);
    expect(graph.orphanReferences).toHaveLength(0);
    expect(graph.cycleFileIds).toHaveLength(0);
  });
});
