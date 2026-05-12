import { describe, expect, it } from 'vitest';
import { classifyTechnicalProfile, KNOWN_PROTOCOL_NAMES } from './schema-catalog.js';

describe('schema-catalog', () => {
  it('exposes the supported protocol names set', () => {
    expect([...KNOWN_PROTOCOL_NAMES]).toEqual([
      'OpenIdConnect',
      'SAML2',
      'Restful',
      'Proprietary',
      'None',
      'OAuth2',
    ]);
  });

  it('classifies direct protocol names to expected categories', () => {
    expect(classifyTechnicalProfile('OpenIdConnect', undefined, 'External-OIDC')).toBe('OIDC_IDP');
    expect(classifyTechnicalProfile('SAML2', undefined, 'External-SAML')).toBe('SAML_IDP');
    expect(classifyTechnicalProfile('Restful', undefined, 'REST-GetProfile')).toBe('REST_API');
    expect(classifyTechnicalProfile('OAuth2', undefined, 'Facebook-OAUTH')).toBe('OAUTH2_IDP');
    expect(classifyTechnicalProfile('None', undefined, 'ClaimsTransformation-Runner')).toBe(
      'CLAIMS_TRANSFORM',
    );
  });

  it('classifies proprietary handlers by semantic category', () => {
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.RestfulProvider',
        'REST-GetProfile',
      ),
    ).toBe('REST_API');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.AzureActiveDirectoryProvider,AadDirectoryLookup',
        'AAD-UserReadUsingObjectId',
      ),
    ).toBe('AAD_DIRECTORY');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.AzureActiveDirectoryProvider,AadSsoMsi',
        'AAD-UserWriteUsingObjectId',
      ),
    ).toBe('AAD_DIRECTORY');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.SelfAssertedAttributeProvider,AadSspr',
        'LocalAccountDiscoveryUsingEmailAddress',
      ),
    ).toBe('AAD_SSPR');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.PhoneFactorProtocolProvider,PhoneFactor',
        'PhoneFactor-Verify',
      ),
    ).toBe('PHONE_MFA');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.EmailProtocolProvider,AadMfaEmail',
        'EmailOtp',
      ),
    ).toBe('EMAIL_VERIFY');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.Providers.TotpProtocolProvider,Totp',
        'TotpFactor-Input',
      ),
    ).toBe('TOTP');
    expect(
      classifyTechnicalProfile(
        'Proprietary',
        'Web.TPEngine.SSO.DefaultSSOSessionProvider,Session',
        'SM-AAD',
      ),
    ).toBe('SESSION');
  });

  it('prioritizes jwt issuer over generic None protocol classification', () => {
    expect(classifyTechnicalProfile('None', undefined, 'JwtIssuer')).toBe('JWT_ISSUER');
    expect(classifyTechnicalProfile('None', undefined, 'B2C_1A_JwtIssuer_Custom')).toBe(
      'JWT_ISSUER',
    );
  });

  it('falls back to OTHER for unknown or incomplete inputs', () => {
    expect(classifyTechnicalProfile(undefined, undefined, 'CustomProfile')).toBe('OTHER');
    expect(classifyTechnicalProfile('Proprietary', undefined, 'CustomProfile')).toBe('OTHER');
    expect(classifyTechnicalProfile('UnknownProtocol', 'CustomHandler', 'CustomProfile')).toBe(
      'OTHER',
    );
  });
});
