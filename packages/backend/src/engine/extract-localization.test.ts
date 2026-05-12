import { describe, expect, it } from 'vitest';
import { extractLocalization } from './extract-localization.js';
import type { ParsedFile } from './types.js';

function parsed(ast: Record<string, unknown>): ParsedFile {
  return {
    fileName: 'loc.xml',
    policyId: 'B2C_1A_Test',
    tenantId: 'contoso.onmicrosoft.com',
    ast,
    rawXml: '',
  };
}

describe('extractLocalization', () => {
  it('extracts multiple localized resources as separate entries', () => {
    const localizations = extractLocalization(
      parsed({
        BuildingBlocks: {
          Localization: {
            SupportedLanguages: {
              SupportedLanguage: ['en', 'fr'],
            },
            LocalizedResources: [
              {
                '@_Id': 'api.signup.en',
                LocalizedStrings: {
                  LocalizedString: {
                    '@_ElementType': 'UxElement',
                    '@_StringId': 'heading',
                    '#text': 'Sign up',
                  },
                },
              },
              {
                '@_Id': 'api.signup.fr',
                LocalizedCollections: {
                  LocalizedCollection: {
                    '@_ElementType': 'ClaimType',
                    '@_ElementId': 'country',
                    Item: [{ '@_Name': 'France', '#text': 'FR' }],
                  },
                },
              },
            ],
          },
        },
      }),
      'file-1',
    );

    expect(localizations).toHaveLength(2);
    expect(localizations[0]).toMatchObject({
      resourceId: 'api.signup.en',
      language: 'en',
      localizedStrings: [
        {
          elementType: 'UxElement',
          stringId: 'heading',
          value: 'Sign up',
        },
      ],
    });
    expect(localizations[1]).toMatchObject({
      resourceId: 'api.signup.fr',
      language: 'fr',
      localizedCollections: [
        {
          elementType: 'ClaimType',
          elementId: 'country',
          items: [{ name: 'France', value: 'FR' }],
        },
      ],
    });
  });
});
