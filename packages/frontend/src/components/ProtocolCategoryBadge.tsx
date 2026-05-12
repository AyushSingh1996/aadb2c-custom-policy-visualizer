import type { ProtocolCategory } from '@policy-analyzer/shared';

const LABELS: Record<ProtocolCategory, string> = {
  OIDC_IDP: 'OIDC IdP',
  SAML_IDP: 'SAML IdP',
  REST_API: 'REST API',
  AAD_DIRECTORY: 'AAD Directory',
  AAD_SSPR: 'AAD SSPR',
  JWT_ISSUER: 'JWT Issuer',
  OAUTH2_IDP: 'OAuth2 IdP',
  PHONE_MFA: 'Phone MFA',
  EMAIL_VERIFY: 'Email Verify',
  TOTP: 'TOTP',
  CLAIMS_TRANSFORM: 'Claims Transform',
  SESSION: 'Session',
  OTHER: 'Other',
};

export interface ProtocolCategoryBadgeProps {
  category: ProtocolCategory;
}

export function ProtocolCategoryBadge({ category }: ProtocolCategoryBadgeProps): JSX.Element {
  return (
    <span className={`badge protocol-badge protocol-badge--${category}`}>{LABELS[category]}</span>
  );
}
