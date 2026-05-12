import { describe, expect, it } from 'vitest';
import type { PolicyFile } from '@policy-analyzer/shared';
import { groupIntoChains } from './chains.js';
import type { InheritanceGraph, ParsedFile } from './types.js';

let seq = 0;

function makePolicyFile(
  category: PolicyFile['category'],
  policyId: string,
  basePolicyId?: string,
  fileName = `${policyId}.xml`,
): PolicyFile {
  const id = `file-${++seq}`;
  const file: PolicyFile = {
    id,
    fileName,
    sizeBytes: 123,
    lastModified: '2026-04-28T00:00:00.000Z',
    category,
    policyId,
    tenantId: 'contoso.onmicrosoft.com',
    rawXml: '',
    parsedAt: '2026-04-28T00:00:00.000Z',
  };
  if (basePolicyId !== undefined) {
    file.basePolicyId = basePolicyId;
    file.basePolicyTenantId = 'contoso.onmicrosoft.com';
  }
  return file;
}

function parsedRelyingParty(overrides: Record<string, unknown> = {}): ParsedFile {
  return {
    fileName: 'rp.xml',
    policyId: 'B2C_1A_signup_signin',
    tenantId: 'contoso.onmicrosoft.com',
    ast: {
      RelyingParty: {
        DefaultUserJourney: { '@_ReferenceId': 'SignUpOrSignIn' },
        ...overrides,
      },
    },
    rawXml: '',
  };
}

function inheritanceGraph(edges: Array<[string, string | undefined]>): InheritanceGraph {
  return {
    parentIds: new Map(edges),
    cycleFileIds: [],
    orphanReferences: [],
    cycleErrors: [],
  };
}

describe('groupIntoChains', () => {
  it('builds one ordered chain for a single Base → Extension → RP lineage', () => {
    const base = makePolicyFile('Base', 'B2C_1A_Base');
    const ext = makePolicyFile('Extension', 'B2C_1A_Extensions', 'B2C_1A_Base');
    const rp = makePolicyFile('RelyingParty', 'B2C_1A_signup_signin', 'B2C_1A_Extensions');
    const chains = groupIntoChains(
      [base, ext, rp],
      inheritanceGraph([
        [base.id, undefined],
        [ext.id, base.id],
        [rp.id, ext.id],
      ]),
      new Map([[rp.id, parsedRelyingParty()]]),
    );

    expect(chains).toHaveLength(1);
    expect(chains[0]?.fileIds).toEqual([base.id, ext.id, rp.id]);
    expect(chains[0]?.rpFileId).toBe(rp.id);
    expect(chains[0]?.name).toBe('Sign Up Or Sign In Flow');
    expect(chains[0]?.defaultUserJourneyId).toBe('SignUpOrSignIn');
  });

  it('creates separate chains for two RPs that share the same parent', () => {
    const base = makePolicyFile('Base', 'B2C_1A_Base');
    const ext = makePolicyFile('Extension', 'B2C_1A_Extensions', 'B2C_1A_Base');
    const rpA = makePolicyFile('RelyingParty', 'B2C_1A_SignUp', 'B2C_1A_Extensions');
    const rpB = makePolicyFile('RelyingParty', 'B2C_1A_ProfileEdit', 'B2C_1A_Extensions');

    const chains = groupIntoChains(
      [base, ext, rpA, rpB],
      inheritanceGraph([
        [base.id, undefined],
        [ext.id, base.id],
        [rpA.id, ext.id],
        [rpB.id, ext.id],
      ]),
      new Map([
        [rpA.id, parsedRelyingParty({ DefaultUserJourney: { '@_ReferenceId': 'SignUp' } })],
        [rpB.id, parsedRelyingParty({ DefaultUserJourney: { '@_ReferenceId': 'ProfileEdit' } })],
      ]),
    );

    expect(chains).toHaveLength(2);
    expect(chains.map((chain) => chain.fileIds)).toEqual([
      [base.id, ext.id, rpA.id],
      [base.id, ext.id, rpB.id],
    ]);
  });

  it('handles deep inheritance chains in base-first order', () => {
    const files = [
      makePolicyFile('Base', 'B2C_1A_L1'),
      makePolicyFile('Extension', 'B2C_1A_L2', 'B2C_1A_L1'),
      makePolicyFile('Extension', 'B2C_1A_L3', 'B2C_1A_L2'),
      makePolicyFile('Extension', 'B2C_1A_L4', 'B2C_1A_L3'),
      makePolicyFile('RelyingParty', 'B2C_1A_L5', 'B2C_1A_L4'),
    ];
    const [l1, l2, l3, l4, rp] = files;

    const chains = groupIntoChains(
      files,
      inheritanceGraph([
        [l1!.id, undefined],
        [l2!.id, l1!.id],
        [l3!.id, l2!.id],
        [l4!.id, l3!.id],
        [rp!.id, l4!.id],
      ]),
      new Map([[rp!.id, parsedRelyingParty({ DefaultUserJourney: { '@_ReferenceId': 'LevelFive' } })]]),
    );

    expect(chains[0]?.fileIds).toEqual(files.map((file) => file.id));
  });

  it('still emits a chain for an orphan RP and falls back to prettified policy id', () => {
    const rp = makePolicyFile('RelyingParty', 'B2C_1A_CustomPolicy', 'B2C_1A_MissingBase');

    const chains = groupIntoChains(
      [rp],
      inheritanceGraph([[rp.id, undefined]]),
      new Map([[rp.id, { ...parsedRelyingParty({}), ast: { RelyingParty: {} } }]]),
    );

    expect(chains).toHaveLength(1);
    expect(chains[0]?.fileIds).toEqual([rp.id]);
    expect(chains[0]?.name).toBe('Custom Policy');
  });

  it('prefers the MFA reference for chain naming when present', () => {
    const rp = makePolicyFile('RelyingParty', 'B2C_1A_CustomPolicy');

    const chains = groupIntoChains(
      [rp],
      inheritanceGraph([[rp.id, undefined]]),
      new Map([
        [
          rp.id,
          parsedRelyingParty({
            UserJourneyBehaviors: {
              MultiFactorAuthentication: { ReferenceId: 'B2C_1A_MfaSignIn' },
            },
          }),
        ],
      ]),
    );

    expect(chains[0]?.name).toBe('Mfa Sign In Flow');
  });
});
