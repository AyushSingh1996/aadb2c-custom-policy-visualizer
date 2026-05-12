import type { FileCategory } from '@policy-analyzer/shared';
import type { ParsedFile } from './types.js';

// Applies §7.2 classification rules in order. First match wins.
export function classifyFile(parsed: ParsedFile): FileCategory {
  const tfp = parsed.ast;

  // Rule 3: has <RelyingParty>
  if ('RelyingParty' in tfp) return 'RelyingParty';

  // Rule 4: Localization heuristic
  if (isLocalizationOnly(tfp)) return 'Localization';

  // Rule 5: has <BasePolicy>
  if (parsed.basePolicyId !== undefined) return 'Extension';

  // Rule 6: no <BasePolicy> → base file
  return 'Base';
}

// §7.2 rule 4: a file is localization-only when its BuildingBlocks contains only
// Localization and/or ContentDefinitions children, and it has no ClaimsProviders with
// TechnicalProfiles and no UserJourneys.
function isLocalizationOnly(tfp: Record<string, unknown>): boolean {
  if ('UserJourneys' in tfp) return false;

  if ('ClaimsProviders' in tfp) {
    const cp = tfp['ClaimsProviders'] as Record<string, unknown> | null | undefined;
    if (cp != null && 'ClaimsProvider' in cp) return false;
  }

  if (!('BuildingBlocks' in tfp)) return false;
  const bb = tfp['BuildingBlocks'] as Record<string, unknown>;

  if (!('Localization' in bb) && !('ContentDefinitions' in bb)) return false;

  const localizationKeys = new Set(['Localization', 'ContentDefinitions']);
  return !Object.keys(bb).some((k) => !localizationKeys.has(k));
}
