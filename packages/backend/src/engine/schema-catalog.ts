import type { ProtocolCategory } from '@policy-analyzer/shared';

export const KNOWN_PROTOCOL_NAMES: ReadonlySet<string> = new Set([
  'OpenIdConnect',
  'SAML2',
  'Restful',
  'Proprietary',
  'None',
  'OAuth2',
]);

export function classifyTechnicalProfile(
  protocolName: string | undefined,
  handler: string | undefined,
  tpId: string,
): ProtocolCategory {
  const normalizedProtocolName = protocolName?.trim();
  const normalizedHandler = handler?.toLowerCase();
  const normalizedTpId = tpId.toLowerCase();

  if (normalizedProtocolName === 'OpenIdConnect') return 'OIDC_IDP';
  if (normalizedProtocolName === 'SAML2') return 'SAML_IDP';
  if (normalizedProtocolName === 'Restful') return 'REST_API';
  if (
    normalizedProtocolName === 'Proprietary' &&
    hasHandler(normalizedHandler, 'restfulprovider')
  ) {
    return 'REST_API';
  }

  if (
    normalizedProtocolName === 'Proprietary' &&
    hasHandler(normalizedHandler, 'aaddirectorylookup', 'aadssomsi')
  ) {
    return 'AAD_DIRECTORY';
  }

  if (normalizedProtocolName === 'Proprietary' && hasHandler(normalizedHandler, 'aadsspr')) {
    return 'AAD_SSPR';
  }

  if (normalizedProtocolName === 'None' && normalizedTpId.includes('jwtissuer')) {
    return 'JWT_ISSUER';
  }

  if (normalizedProtocolName === 'OAuth2') return 'OAUTH2_IDP';

  if (normalizedProtocolName === 'Proprietary' && hasHandler(normalizedHandler, 'phonefactor')) {
    return 'PHONE_MFA';
  }

  if (normalizedProtocolName === 'Proprietary' && hasHandler(normalizedHandler, 'aadmfaemail')) {
    return 'EMAIL_VERIFY';
  }

  if (normalizedProtocolName === 'Proprietary' && hasHandler(normalizedHandler, 'totp')) {
    return 'TOTP';
  }

  if (normalizedProtocolName === 'None') return 'CLAIMS_TRANSFORM';

  if (normalizedProtocolName === 'Proprietary' && hasHandler(normalizedHandler, 'session')) {
    return 'SESSION';
  }

  return 'OTHER';
}

function hasHandler(handler: string | undefined, ...fragments: string[]): boolean {
  if (handler === undefined) return false;
  return fragments.some((fragment) => handler.includes(fragment));
}
