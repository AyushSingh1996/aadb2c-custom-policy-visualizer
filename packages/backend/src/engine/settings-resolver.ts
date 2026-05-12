export interface AppSettings {
  Environments?: AppSettingsEnvironment[];
  EnvironmentsFolder?: string;
}

export interface AppSettingsEnvironment {
  Name: string;
  Production?: boolean;
  Tenant?: string;
  PolicySettings?: Record<string, string>;
}

export class SettingsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsParseError';
  }
}

export function parseAppSettings(rawJson: string): AppSettings {
  try {
    return JSON.parse(rawJson) as AppSettings;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.';
    throw new SettingsParseError(message);
  }
}

export function resolveSettingsInUrl(
  url: string,
  settings: AppSettings | null,
  context?: { fileName?: string },
): string {
  if (settings === null) {
    return url;
  }

  const environment = selectEnvironment(settings);
  if (environment === undefined) {
    return url;
  }

  return url.replace(/\{Settings:([^}]+)\}/g, (placeholder, rawKey: string) => {
    const resolved = resolvePlaceholder(rawKey, environment, context);
    return resolved ?? placeholder;
  });
}

function selectEnvironment(settings: AppSettings): AppSettingsEnvironment | undefined {
  const environments = settings.Environments;
  if (!Array.isArray(environments) || environments.length === 0) {
    return undefined;
  }

  return environments.find((environment) => environment.Production !== true) ?? environments[0];
}

function resolvePlaceholder(
  rawKey: string,
  environment: AppSettingsEnvironment,
  context?: { fileName?: string },
): string | undefined {
  switch (rawKey.toLowerCase()) {
    case 'tenant':
      return environment.Tenant;
    case 'filename':
      return stripExtension(context?.fileName);
    case 'policyfilename':
      return stripPolicyPrefix(stripExtension(context?.fileName));
    case 'environment':
      return environment.Name;
    default:
      return environment.PolicySettings?.[rawKey];
  }
}

function stripExtension(fileName: string | undefined): string | undefined {
  if (!fileName) {
    return undefined;
  }

  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

function stripPolicyPrefix(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.startsWith('B2C_1A_') ? value.slice('B2C_1A_'.length) : value;
}
