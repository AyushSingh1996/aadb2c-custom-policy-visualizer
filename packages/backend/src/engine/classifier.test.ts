import { describe, it, expect } from 'vitest';
import { classifyFile } from './classifier.js';
import type { ParsedFile } from './types.js';

function parsed(
  astOverrides: Record<string, unknown> = {},
  fields: Partial<ParsedFile> = {},
): ParsedFile {
  const base: ParsedFile = {
    fileName: 'test.xml',
    policyId: 'B2C_1A_Test',
    tenantId: 'tenant.onmicrosoft.com',
    ast: { '@_PolicyId': 'B2C_1A_Test', '@_TenantId': 'tenant.onmicrosoft.com', ...astOverrides },
    rawXml: '',
  };
  return { ...base, ...fields };
}

describe('classifyFile — §7.2 rules', () => {
  it('classifies a base file (no BasePolicy, no RelyingParty) as Base', () => {
    expect(classifyFile(parsed())).toBe('Base');
  });

  it('classifies a file with basePolicyId but no RelyingParty as Extension', () => {
    expect(classifyFile(parsed({}, { basePolicyId: 'B2C_1A_TrustFrameworkBase' }))).toBe(
      'Extension',
    );
  });

  it('classifies a file with a <RelyingParty> element as RelyingParty', () => {
    expect(classifyFile(parsed({ RelyingParty: { DefaultUserJourney: {} } }))).toBe('RelyingParty');
  });

  it('classifies a file with both BasePolicy and RelyingParty as RelyingParty (RP wins)', () => {
    const f = parsed({ RelyingParty: {} }, { basePolicyId: 'B2C_1A_TrustFrameworkExtensions' });
    expect(classifyFile(f)).toBe('RelyingParty');
  });

  it('classifies a localization-only file (BuildingBlocks with only Localization)', () => {
    expect(
      classifyFile(parsed({ BuildingBlocks: { Localization: { SupportedLanguages: {} } } })),
    ).toBe('Localization');
  });

  it('classifies a localization-only file (BuildingBlocks with Localization + ContentDefinitions)', () => {
    expect(
      classifyFile(parsed({ BuildingBlocks: { Localization: {}, ContentDefinitions: {} } })),
    ).toBe('Localization');
  });

  it('does not classify as Localization when BuildingBlocks also has ClaimsSchema', () => {
    const f = parsed({
      BuildingBlocks: { Localization: {}, ClaimsSchema: {} },
    });
    expect(classifyFile(f)).toBe('Base');
  });

  it('does not classify as Localization when top-level ClaimsProviders with TPs are present', () => {
    const f = parsed({
      BuildingBlocks: { Localization: {} },
      ClaimsProviders: { ClaimsProvider: { DisplayName: 'Local Account' } },
    });
    expect(classifyFile(f)).toBe('Base');
  });

  it('does not classify as Localization when UserJourneys are present', () => {
    const f = parsed({
      BuildingBlocks: { Localization: {} },
      UserJourneys: { UserJourney: {} },
    });
    expect(classifyFile(f)).toBe('Base');
  });

  it('classifies an empty TrustFrameworkPolicy as Base', () => {
    expect(classifyFile(parsed())).toBe('Base');
  });
});
