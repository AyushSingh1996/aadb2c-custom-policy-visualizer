import type {
  ClaimsProvider,
  ClaimsSchemaEntry,
  ClaimsTransformation,
  LocalizationEntry,
  OrphanReference,
  ParseError,
  PolicyChain,
  PolicyFile,
  TechnicalProfile,
  UserJourney,
} from '@policy-analyzer/shared';

// Internal representation of a successfully parsed XML file.
// Holds the raw AST so entity extractors (Phase 3) can access it without re-parsing.
export interface ParsedFile {
  fileName: string;
  policyId: string;
  tenantId: string;
  basePolicyId?: string;
  basePolicyTenantId?: string;
  ast: TrustFrameworkPolicyAst;
  rawXml: string;
}

// The TrustFrameworkPolicy object as returned by fast-xml-parser.
// Typed loosely; entity extractors narrow specific sub-trees as needed.
export type TrustFrameworkPolicyAst = Record<string, unknown>;

export interface InheritanceGraph {
  // fileId → resolved parent fileId; undefined for base files and unresolved orphans
  parentIds: Map<string, string | undefined>;
  cycleFileIds: string[];
  orphanReferences: OrphanReference[];
  // One ParseError per file detected in a cycle, keyed to the file id for unambiguous mapping.
  cycleErrors: Array<{ fileId: string; error: ParseError }>;
}

export interface UploadedFile {
  fileName: string;
  relativePath?: string;
  buffer: Buffer;
  sizeBytes: number;
  lastModified: string;
}

export interface ExtractedFileEntities {
  technicalProfiles: TechnicalProfile[];
  journeys: UserJourney[];
  claimsSchema: ClaimsSchemaEntry[];
  claimsTransformations: ClaimsTransformation[];
  claimsProviders: ClaimsProvider[];
  localizations: LocalizationEntry[];
}

export interface ResolvedChainEntities {
  resolvedJourneys: UserJourney[];
  resolvedTechnicalProfiles: TechnicalProfile[];
  resolvedClaimsSchema: ClaimsSchemaEntry[];
  resolvedClaimsTransformations: ClaimsTransformation[];
  resolvedClaimsProviders: ClaimsProvider[];
  resolvedLocalizations: LocalizationEntry[];
}

export interface DraftPolicyChain
  extends Omit<
    PolicyChain,
    | 'resolvedJourneys'
    | 'resolvedTechnicalProfiles'
    | 'resolvedClaimsSchema'
    | 'resolvedClaimsTransformations'
    | 'resolvedClaimsProviders'
    | 'resolvedLocalizations'
    | 'externalDependencies'
    | 'orphanReferences'
    | 'stats'
  > {}

export interface AnalysisContext {
  filesById: Map<string, PolicyFile>;
  parsedByFileId: Map<string, ParsedFile>;
  extractedByFileId: Map<string, ExtractedFileEntities>;
}
