import { describe, expect, it } from 'vitest';
import {
  parseAppSettings,
  resolveSettingsInUrl,
  SettingsParseError,
  type AppSettings,
} from './settings-resolver.js';

const settings: AppSettings = {
  Environments: [
    {
      Name: 'Production',
      Production: true,
      Tenant: 'prod.contoso.onmicrosoft.com',
      PolicySettings: {
        ApiHost: 'api.prod.contoso.com',
      },
    },
    {
      Name: 'Development',
      Tenant: 'dev.contoso.onmicrosoft.com',
      PolicySettings: {
        ApiHost: 'api.dev.contoso.com',
        JourneyName: 'ContosoJourney',
      },
    },
  ],
};

describe('settings-resolver', () => {
  it('parses valid appsettings json', () => {
    const parsed = parseAppSettings(JSON.stringify(settings));
    expect(parsed.Environments?.[1]?.Name).toBe('Development');
  });

  it('throws SettingsParseError for invalid json', () => {
    expect(() => parseAppSettings('{invalid')).toThrow(SettingsParseError);
  });

  it('resolves built-in and custom placeholders using the first non-production environment', () => {
    const url = resolveSettingsInUrl(
      'https://{Settings:Tenant}/{Settings:Environment}/{Settings:ApiHost}/{Settings:Filename}/{Settings:PolicyFilename}',
      settings,
      { fileName: 'B2C_1A_SignUpOrSignIn.xml' },
    );

    expect(url).toBe(
      'https://dev.contoso.onmicrosoft.com/Development/api.dev.contoso.com/B2C_1A_SignUpOrSignIn/SignUpOrSignIn',
    );
  });

  it('leaves unmatched placeholders and null settings unchanged', () => {
    expect(resolveSettingsInUrl('https://{Settings:Missing}', settings)).toBe(
      'https://{Settings:Missing}',
    );
    expect(resolveSettingsInUrl('https://{Settings:Tenant}', null)).toBe(
      'https://{Settings:Tenant}',
    );
  });

  it('gracefully no-ops when no environments are available', () => {
    expect(resolveSettingsInUrl('https://{Settings:Tenant}', {})).toBe('https://{Settings:Tenant}');
  });
});
