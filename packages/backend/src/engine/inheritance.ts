import type { PolicyFile, OrphanReference, ParseError } from '@policy-analyzer/shared';
import type { InheritanceGraph } from './types.js';
import { IdIndex } from '../util/id-index.js';
import { getFileLabel } from './file-label.js';

export function buildInheritanceGraph(files: PolicyFile[]): InheritanceGraph {
  // Index all files by PolicyId (and TenantId+PolicyId) for parent resolution.
  const index = new IdIndex<PolicyFile>();
  for (const f of files) {
    if (f.policyId !== undefined) {
      index.add(f.policyId, f.tenantId ?? '', f);
    }
  }

  const parentIds = new Map<string, string | undefined>();
  const orphanReferences: OrphanReference[] = [];

  for (const f of files) {
    if (f.basePolicyId === undefined) {
      parentIds.set(f.id, undefined);
      continue;
    }
    const parent = index.resolve(f.basePolicyId, f.basePolicyTenantId);
    if (parent === undefined) {
      parentIds.set(f.id, undefined);
      const ref: OrphanReference = {
        referencedPolicyId: f.basePolicyId,
        referencedFromFileId: f.id,
        referenceType: 'BasePolicy',
        message: `"${getFileLabel(f)}" references base policy "${f.basePolicyId}" which was not found in the upload.`,
      };
      if (f.basePolicyTenantId !== undefined) ref.referencedTenantId = f.basePolicyTenantId;
      orphanReferences.push(ref);
    } else {
      parentIds.set(f.id, parent.id);
    }
  }

  // DFS cycle detection — WHITE/GRAY/BLACK coloring.
  type Color = 'white' | 'gray' | 'black';
  const color = new Map<string, Color>(files.map((f) => [f.id, 'white']));
  const fileById = new Map(files.map((f) => [f.id, f]));
  const cycleFileIds: string[] = [];
  const cycleErrors: Array<{ fileId: string; error: ParseError }> = [];

  const visit = (fileId: string, stack: string[]): void => {
    color.set(fileId, 'gray');
    stack.push(fileId);

    const parentId = parentIds.get(fileId);
    if (parentId !== undefined) {
      const parentColor = color.get(parentId);
      if (parentColor === 'gray') {
        // Found a cycle — collect all members between parentId and the current node.
        const cycleStart = stack.indexOf(parentId);
        const cycleMembers = stack.slice(cycleStart);
        const cycleNames = [
          ...cycleMembers.map((id) => {
            const cycleFile = fileById.get(id);
            return cycleFile ? getFileLabel(cycleFile) : id;
          }),
          (() => {
            const parentFile = fileById.get(parentId);
            return parentFile ? getFileLabel(parentFile) : parentId;
          })(),
        ].join(' → ');
        for (const id of cycleMembers) {
          if (!cycleFileIds.includes(id)) {
            cycleFileIds.push(id);
            const cycleFile = fileById.get(id);
            cycleErrors.push({
              fileId: id,
              error: {
                fileName: cycleFile?.fileName ?? id,
                ...(cycleFile?.relativePath ? { relativePath: cycleFile.relativePath } : {}),
                message: `Cycle detected in inheritance chain: ${cycleNames}`,
              },
            });
          }
        }
      } else if (parentColor === 'white') {
        visit(parentId, stack);
      }
    }

    stack.pop();
    color.set(fileId, 'black');
  };

  for (const f of files) {
    if (color.get(f.id) === 'white') {
      visit(f.id, []);
    }
  }

  return { parentIds, cycleFileIds, orphanReferences, cycleErrors };
}
