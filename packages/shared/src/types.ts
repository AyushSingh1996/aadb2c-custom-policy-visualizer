// ─── §6.1 Top-level analysis result ─────────────────────────────────────────

export interface AnalysisResult {
  sessionId: string;
  uploadedAt: string;
  files: PolicyFile[];
  chains: PolicyChain[];
  orphanReferences: OrphanReference[];
  parseErrors: ParseError[];
  schemaWarnings: SchemaWarning[];
  stats: AnalysisStats;
}

// ─── §6.2 PolicyFile ─────────────────────────────────────────────────────────

export type FileCategory = 'Base' | 'Extension' | 'RelyingParty' | 'Localization' | 'Error';

export interface PolicyFile {
  id: string;
  fileName: string;
  relativePath?: string;
  sizeBytes: number;
  lastModified: string;
  category: FileCategory;
  policyId?: string;
  tenantId?: string;
  basePolicyId?: string;
  basePolicyTenantId?: string;
  rawXml: string;
  parsedAt: string;
  parseError?: string;
}

// ─── §6.3 PolicyChain ────────────────────────────────────────────────────────

export interface PolicyChain {
  id: string;
  name: string;
  description?: string;
  fileIds: string[];
  rpFileId: string;
  defaultUserJourneyId?: string;
  resolvedJourneys: UserJourney[];
  resolvedTechnicalProfiles: TechnicalProfile[];
  resolvedClaimsSchema: ClaimsSchemaEntry[];
  resolvedClaimsTransformations: ClaimsTransformation[];
  resolvedClaimsProviders: ClaimsProvider[];
  resolvedLocalizations: LocalizationEntry[];
  externalDependencies: ExternalDependency[];
  orphanReferences: OrphanReference[];
  stats: ChainStats;
}

// ─── §6.4 UserJourney and OrchestrationStep ──────────────────────────────────

export interface UserJourney {
  id: string;
  definedInFileId: string;
  isOverride: boolean;
  steps: OrchestrationStep[];
}

export type OrchestrationStepType =
  | 'ClaimsExchange'
  | 'ClaimsProviderSelection'
  | 'CombinedSignInAndSignUp'
  | 'SendClaims'
  | 'InvokeSubJourney'
  | 'GetClaims'
  | 'Other';

export interface OrchestrationStep {
  order: number;
  type: OrchestrationStepType;
  rawType?: string;
  contentDefinitionReferenceId?: string;
  technicalProfileReferenceId?: string;
  targetClaimsExchangeIds?: string[];
  claimsExchanges: ClaimsExchange[];
  preconditions: Precondition[];
  inputClaimNames: string[];
  outputClaimNames: string[];
}

export interface ClaimsExchange {
  id: string;
  technicalProfileReferenceId: string;
}

export interface Precondition {
  type: string;
  executeActionsIf: 'true' | 'false';
  values: string[];
  action?: string;
}

// ─── §6.5 TechnicalProfile and supporting types ──────────────────────────────

export interface TechnicalProfile {
  id: string;
  displayName?: string;
  description?: string;
  protocol?: ProtocolInfo;
  protocolCategory: ProtocolCategory;
  catalogDescription?: string;
  catalogDocsUrl?: string;
  domain?: string;
  metadata: Record<string, string>;
  cryptographicKeys: CryptographicKey[];
  inputClaims: ClaimReference[];
  outputClaims: ClaimReference[];
  persistedClaims: ClaimReference[];
  inputClaimsTransformations: TransformationReference[];
  outputClaimsTransformations: TransformationReference[];
  validationTechnicalProfiles: ValidationTechnicalProfileRef[];
  includeInSso?: boolean;
  includeClaimsFromTechnicalProfileId?: string;
  useTechnicalProfileForSessionManagement?: string;
  enabled?: boolean;
  definedInFileId: string;
  isOverride: boolean;
  overriddenFromFileIds: string[];
  resolvedFromMerge: boolean;
}

export interface ProtocolInfo {
  name: string;
  handler?: string;
}

export type ProtocolCategory =
  | 'OIDC_IDP'
  | 'SAML_IDP'
  | 'REST_API'
  | 'AAD_DIRECTORY'
  | 'AAD_SSPR'
  | 'JWT_ISSUER'
  | 'OAUTH2_IDP'
  | 'PHONE_MFA'
  | 'EMAIL_VERIFY'
  | 'TOTP'
  | 'CLAIMS_TRANSFORM'
  | 'SESSION'
  | 'OTHER';

export interface ClaimReference {
  claimTypeReferenceId: string;
  defaultValue?: string;
  required?: boolean;
  partnerClaimType?: string;
}

export interface TransformationReference {
  referenceId: string;
}

export interface ValidationTechnicalProfileRef {
  referenceId: string;
  preconditions: Precondition[];
  continueOnError?: boolean;
}

export interface CryptographicKey {
  id: string;
  storageReferenceId: string;
}

// ─── §6.6 Claims schema and providers ────────────────────────────────────────

export interface ClaimsSchemaEntry {
  id: string;
  displayName?: string;
  dataType?: string;
  catalogDescription?: string;
  catalogDocsUrl?: string;
  userInputType?: string;
  userHelpText?: string;
  mask?: string;
  predicateValidationReference?: string;
  restrictionEnumeration?: { value: string; text: string }[];
  definedInFileId: string;
  isOverride: boolean;
}

export interface ClaimsTransformation {
  id: string;
  transformationMethod: string;
  inputClaims: { claimTypeReferenceId: string; transformationClaimType: string }[];
  inputParameters: { id: string; dataType: string; value: string }[];
  outputClaims: { claimTypeReferenceId: string; transformationClaimType: string }[];
  definedInFileId: string;
  isOverride: boolean;
}

export interface ClaimsProvider {
  displayName: string;
  domain?: string;
  technicalProfileIds: string[];
  definedInFileId: string;
}

// ─── §6.7 Localization ───────────────────────────────────────────────────────

export interface LocalizationEntry {
  resourceId: string;
  language?: string;
  localizedStrings: { elementType: string; stringId: string; value: string }[];
  localizedCollections: {
    elementType: string;
    elementId: string;
    items: { name: string; value: string }[];
  }[];
  definedInFileId: string;
}

// ─── §6.8 External dependencies ──────────────────────────────────────────────

export interface ExternalDependency {
  type: 'RestApi' | 'HtmlTemplate' | 'IdpMetadata' | 'OpenIdMetadata' | 'PartnerMetadata';
  url: string;
  technicalProfileId: string;
  context: string;
  authentication?: string;
}

// ─── §6.9 Errors, warnings, and stats ────────────────────────────────────────

export interface OrphanReference {
  referencedPolicyId: string;
  referencedTenantId?: string;
  referencedFromFileId: string;
  referenceType:
    | 'BasePolicy'
    | 'TechnicalProfile'
    | 'ClaimsTransformation'
    | 'ClaimType'
    | 'UserJourney';
  message: string;
}

export interface ParseError {
  fileName: string;
  relativePath?: string;
  message: string;
  line?: number;
  column?: number;
}

export interface AnalysisStats {
  policyChains: number;
  filesAnalyzed: number;
  filesSkipped: number;
  userJourneys: number;
  technicalProfiles: number;
  externalDependencies: number;
  schemaWarningCount: number;
}

export interface ChainStats {
  fileCount: number;
  userJourneyCount: number;
  technicalProfileCount: number;
  orchestrationStepCount: number;
  externalDependencyCount: number;
}

export type SchemaWarningCode =
  | 'INVALID_PROTOCOL_NAME'
  | 'MISSING_REQUIRED_ATTRIBUTE'
  | 'INVALID_DATA_TYPE'
  | 'INVALID_TRANSFORMATION_METHOD';

export interface SchemaWarning {
  code: SchemaWarningCode;
  message: string;
  entityId?: string;
  entityType?: 'TechnicalProfile' | 'ClaimType' | 'ClaimsTransformation';
  fileId: string;
}
