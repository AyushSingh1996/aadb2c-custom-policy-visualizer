// Thin wrapper around Map that supports both PolicyId-only and TenantId+PolicyId lookups.
// The TenantId-qualified lookup takes priority when a tenantId is supplied to resolve().
export class IdIndex<T> {
  private readonly byPolicyId = new Map<string, T>();
  private readonly byTenantPolicyId = new Map<string, T>();

  add(policyId: string, tenantId: string, value: T): void {
    this.byPolicyId.set(policyId, value);
    this.byTenantPolicyId.set(compositeKey(tenantId, policyId), value);
  }

  // Prefer TenantId+PolicyId match; fall back to PolicyId-only. §7.3 rule 2.
  resolve(policyId: string, preferTenantId?: string): T | undefined {
    if (preferTenantId !== undefined) {
      const hit = this.byTenantPolicyId.get(compositeKey(preferTenantId, policyId));
      if (hit !== undefined) return hit;
    }
    return this.byPolicyId.get(policyId);
  }

  has(policyId: string): boolean {
    return this.byPolicyId.has(policyId);
  }

  values(): IterableIterator<T> {
    return this.byPolicyId.values();
  }

  get size(): number {
    return this.byPolicyId.size;
  }
}

function compositeKey(tenantId: string, policyId: string): string {
  return `${tenantId}\x00${policyId}`;
}
