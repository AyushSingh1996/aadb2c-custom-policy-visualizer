import type { ExternalDependency, PolicyFile, TechnicalProfile } from '@policy-analyzer/shared';
import type { AppSettings } from './settings-resolver.js';
import { resolveSettingsInUrl } from './settings-resolver.js';

export function detectExternalDependencies(
  resolvedTPs: TechnicalProfile[],
  settings: AppSettings | null = null,
  fileById: Map<string, PolicyFile> = new Map(),
): ExternalDependency[] {
  return resolvedTPs.flatMap((profile) => detectProfileDependencies(profile, settings, fileById));
}

function detectProfileDependencies(
  profile: TechnicalProfile,
  settings: AppSettings | null,
  fileById: Map<string, PolicyFile>,
): ExternalDependency[] {
  const dependencies: ExternalDependency[] = [];
  const protocolName = profile.protocol?.name;
  const handler = profile.protocol?.handler ?? '';
  const sourceFileName = fileById.get(profile.definedInFileId)?.fileName;
  const resolveUrl = (value: string) =>
    resolveSettingsInUrl(
      value,
      settings,
      sourceFileName ? { fileName: sourceFileName } : undefined,
    );

  if (
    protocolName === 'Proprietary' &&
    handler.includes('RestfulProvider') &&
    profile.metadata['ServiceUrl'] !== undefined
  ) {
    const dependency: ExternalDependency = {
      type: 'RestApi',
      url: resolveUrl(profile.metadata['ServiceUrl']),
      technicalProfileId: profile.id,
      context: 'ServiceUrl',
    };
    const authentication = profile.metadata['AuthenticationType'];
    if (authentication !== undefined) {
      dependency.authentication = authentication;
    }
    dependencies.push(dependency);
  }

  const loadUri = profile.metadata['LoadUri'];
  if (loadUri !== undefined && looksLikeUrl(loadUri)) {
    dependencies.push({
      type: 'HtmlTemplate',
      url: resolveUrl(loadUri),
      technicalProfileId: profile.id,
      context: 'LoadUri',
    });
  }

  if (protocolName === 'OAuth2' || protocolName === 'OpenIdConnect') {
    for (const key of ['METADATA', 'OpenIdConnectMetadata', 'WellKnownConfiguration'] as const) {
      const url = profile.metadata[key];
      if (url !== undefined && looksLikeUrl(url)) {
        dependencies.push({
          type:
            key === 'OpenIdConnectMetadata' ||
            (protocolName === 'OpenIdConnect' && key === 'METADATA')
              ? 'OpenIdMetadata'
              : 'IdpMetadata',
          url: resolveUrl(url),
          technicalProfileId: profile.id,
          context: key,
        });
      }
    }
  }

  if (protocolName === 'SAML2') {
    for (const key of ['PartnerEntity', 'MetadataLocation'] as const) {
      const url = profile.metadata[key];
      if (url !== undefined && looksLikeUrl(url)) {
        dependencies.push({
          type: 'PartnerMetadata',
          url: resolveUrl(url),
          technicalProfileId: profile.id,
          context: key,
        });
      }
    }
  }

  return dependencies;
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
