import { describe, expect, it } from 'vitest';
import { lookupClaimTypeDocs, lookupTechnicalProfileDocs } from './documentation-catalog.js';

describe('documentation-catalog', () => {
  it('returns curated entries for common technical profile ids', () => {
    const entries = [
      lookupTechnicalProfileDocs('SelfAsserted-LocalAccountSignin-Email'),
      lookupTechnicalProfileDocs('AAD-UserReadUsingObjectId'),
      lookupTechnicalProfileDocs('REST-GetLoyaltyId'),
      lookupTechnicalProfileDocs('JwtIssuer'),
      lookupTechnicalProfileDocs('PhoneFactor-Verify'),
      lookupTechnicalProfileDocs('SM-SocialLogin'),
    ];

    for (const entry of entries) {
      expect(entry?.description.length).toBeGreaterThan(20);
      expect(entry?.docsUrl.startsWith('https://')).toBe(true);
    }
  });

  it('returns curated entries for common claim type ids', () => {
    const entries = [
      lookupClaimTypeDocs('objectId'),
      lookupClaimTypeDocs('signInName'),
      lookupClaimTypeDocs('email'),
      lookupClaimTypeDocs('displayName'),
      lookupClaimTypeDocs('givenName'),
      lookupClaimTypeDocs('surname'),
      lookupClaimTypeDocs('phoneNumber'),
      lookupClaimTypeDocs('alternativeSecurityId'),
    ];

    for (const entry of entries) {
      expect(entry?.description.length).toBeGreaterThan(10);
      expect(entry?.docsUrl.startsWith('https://')).toBe(true);
    }
  });

  it('returns undefined for unknown ids', () => {
    expect(lookupTechnicalProfileDocs('Contoso-CustomProfile')).toBeUndefined();
    expect(lookupClaimTypeDocs('customExtensionFlag')).toBeUndefined();
  });
});
