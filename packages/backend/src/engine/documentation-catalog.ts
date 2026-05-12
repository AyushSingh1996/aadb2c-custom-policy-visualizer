export interface CatalogEntry {
  description: string;
  docsUrl: string;
}

const TP_DOCS: ReadonlyArray<{ pattern: string; entry: CatalogEntry }> = [
  {
    pattern: 'login-noninteractive',
    entry: entry(
      'Validates a local account credential set without rendering a self-asserted page.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'localaccountsignupwithlogonemail',
    entry: entry(
      'Creates a local account from an email sign-up journey and persists the new directory object.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-localaccountsignin-email',
    entry: entry(
      'Collects local account sign-in credentials and drives validation technical profiles.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-profileedit-basic',
    entry: entry(
      'Captures a small profile-edit form for baseline local account attributes.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-profileedit-advanced',
    entry: entry(
      'Captures an expanded profile-edit experience for additional directory-backed claims.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-socialprofilecompletion',
    entry: entry(
      'Prompts a social identity user to complete missing profile claims before account creation.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-consentmanagement',
    entry: entry(
      'Collects user consent choices before downstream REST or directory updates are executed.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-emailinvitecode',
    entry: entry(
      'Collects and validates an invitation or access code during a B2B onboarding flow.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-collectphoneformfa',
    entry: entry(
      'Prompts the user for a phone number before invoking phone-based MFA technical profiles.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-stepupphone',
    entry: entry(
      'Captures or confirms phone data for a step-up MFA challenge.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted-b2bprofile',
    entry: entry(
      'Collects B2B invitation profile details before writing the invited user object.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'selfasserted',
    entry: entry(
      'Renders a self-asserted page that collects or confirms user claims in the browser.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
    ),
  },
  {
    pattern: 'aad-userreadusingobjectid',
    entry: entry(
      'Reads a directory user by object identifier to hydrate claims later in the journey.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userreadusingemailaddress-b2b',
    entry: entry(
      'Looks up an invited B2B user by email address before invitation processing continues.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userreadusingemailaddress',
    entry: entry(
      'Reads a directory user by email address for local account discovery or validation.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userreadusingalternativesecurityid',
    entry: entry(
      'Reads a directory user by social identity mapping stored in alternativeSecurityId.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userwriteusinglogonemail',
    entry: entry(
      'Creates a new local account in the directory using an email-based sign-in identifier.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userwriteusingalternativesecurityid',
    entry: entry(
      'Creates a directory user linked to a federated social identity record.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userwriteprofileusingobjectid',
    entry: entry(
      'Updates profile claims on an existing directory user addressed by objectId.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userwritepasswordusingobjectid',
    entry: entry(
      'Writes a password change or reset back to an existing local account.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'aad-userwriteinvitationuser',
    entry: entry(
      'Creates or updates an invited B2B user record with invitation metadata.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/active-directory-technical-profile',
    ),
  },
  {
    pattern: 'facebook-oauth',
    entry: entry(
      'Federates sign-in with Facebook through an OAuth2 technical profile.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/oauth2-technical-profile',
    ),
  },
  {
    pattern: 'google-oauth',
    entry: entry(
      'Federates sign-in with Google through an OAuth2 technical profile.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/oauth2-technical-profile',
    ),
  },
  {
    pattern: 'msa-oidc',
    entry: entry(
      'Federates sign-in with Microsoft accounts through an OpenID Connect technical profile.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/openid-connect-technical-profile',
    ),
  },
  {
    pattern: 'common-aad',
    entry: entry(
      'Federates sign-in with a multi-tenant Azure AD identity provider using OpenID Connect.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/openid-connect-technical-profile',
    ),
  },
  {
    pattern: 'phonefactor-',
    entry: entry(
      'Executes a phone-based multifactor authentication challenge and returns the verification result.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/phone-factor-technical-profile',
    ),
  },
  {
    pattern: 'rest-',
    entry: entry(
      'Calls an external REST endpoint to enrich claims, validate data, or record side effects.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/restful-technical-profile',
    ),
  },
  {
    pattern: 'jwtissuer',
    entry: entry(
      'Issues the final token back to the relying party after the journey has completed.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/jwt-issuer-technical-profile',
    ),
  },
  {
    pattern: 'sm-aad',
    entry: entry(
      'Maintains single sign-on session state for local directory-backed journeys.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/custom-policy-reference-sso',
    ),
  },
  {
    pattern: 'sm-sociallogin',
    entry: entry(
      'Maintains single sign-on session state for social identity provider sign-ins.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/custom-policy-reference-sso',
    ),
  },
  {
    pattern: 'sm-noop',
    entry: entry(
      'Disables or bypasses session persistence for a technical profile execution path.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/custom-policy-reference-sso',
    ),
  },
  {
    pattern: 'policyprofile',
    entry: entry(
      'Shapes the relying party token output by selecting the final claims to issue.',
      'https://learn.microsoft.com/en-us/azure/active-directory-b2c/relyingparty',
    ),
  },
];

const CLAIM_DOCS: Readonly<Record<string, CatalogEntry>> = {
  objectId: claimEntry('Directory object identifier for the signed-in user.'),
  signInName: claimEntry('Local account sign-in identifier, usually an email or username.'),
  'signInNames.emailAddress': claimEntry(
    'Email-specific local account sign-in name stored in the directory.',
  ),
  email: claimEntry('Primary email address claim used across local and federated journeys.'),
  displayName: claimEntry('Friendly display name presented back to the application or UI.'),
  givenName: claimEntry('User given name claim.'),
  surname: claimEntry('User surname or family name claim.'),
  phoneNumber: claimEntry('Phone number captured for profile data or phone-based MFA.'),
  country: claimEntry('Country or region profile claim.'),
  city: claimEntry('City profile claim.'),
  companyName: claimEntry('Company or organization profile claim.'),
  jobTitle: claimEntry('Job title or role profile claim.'),
  alternativeSecurityId: claimEntry(
    'Serialized social identity binding used for federated account linking.',
  ),
  socialIdpUserId: claimEntry('Unique user identifier returned by a social identity provider.'),
  socialIdentityProvider: claimEntry(
    'Normalized name of the social identity provider used in the journey.',
  ),
  identityProvider: claimEntry('Identity provider that authenticated the user.'),
  authenticationSource: claimEntry(
    'Indicates whether authentication came from a local or social provider.',
  ),
  userPrincipalName: claimEntry(
    'Directory principal name generated for the local or federated account.',
  ),
  password: claimEntry('Current password value entered on a self-asserted page.'),
  newPassword: claimEntry('New password value used during sign-up or reset.'),
  reenterPassword: claimEntry('Password confirmation claim paired with newPassword.'),
  newUser: claimEntry('Boolean-style marker indicating that a new account is being created.'),
  'executed-SelfAsserted-Input': claimEntry(
    'Execution marker set after a self-asserted page completes.',
  ),
  mfaPhoneNumber: claimEntry('Phone number claim dedicated to MFA enrollment or step-up flows.'),
  consentVersion: claimEntry('Version marker for the accepted consent statement.'),
  marketingPreference: claimEntry('User preference for receiving marketing communications.'),
  invitationId: claimEntry('Identifier for a B2B invitation or onboarding request.'),
  invitationStatus: claimEntry('Current status of the invitation-processing flow.'),
  invitationAuditId: claimEntry(
    'Audit identifier used when invitation events are recorded externally.',
  ),
  extension_loyaltyId: claimEntry(
    'Application extension claim storing a loyalty program identifier.',
  ),
  extension_deviceId: claimEntry(
    'Application extension claim storing a registered device identifier.',
  ),
  stepUpReason: claimEntry(
    'Reason code explaining why an additional verification step was triggered.',
  ),
  riskLevel: claimEntry('Risk score or classification returned from an external fraud signal.'),
};

export function lookupTechnicalProfileDocs(tpId: string): CatalogEntry | undefined {
  const normalizedTpId = tpId.toLowerCase();
  return TP_DOCS.find(({ pattern }) => normalizedTpId.includes(pattern))?.entry;
}

export function lookupClaimTypeDocs(claimTypeId: string): CatalogEntry | undefined {
  return CLAIM_DOCS[claimTypeId];
}

function entry(description: string, docsUrl: string): CatalogEntry {
  return { description, docsUrl };
}

function claimEntry(description: string): CatalogEntry {
  return entry(
    description,
    'https://learn.microsoft.com/en-us/azure/active-directory-b2c/claimsschema',
  );
}
