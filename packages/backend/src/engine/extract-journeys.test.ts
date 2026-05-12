import { describe, expect, it } from 'vitest';
import { extractUserJourneys } from './extract-journeys.js';
import type { ParsedFile } from './types.js';

function parsed(ast: Record<string, unknown>): ParsedFile {
  return {
    fileName: 'journeys.xml',
    policyId: 'B2C_1A_Test',
    tenantId: 'contoso.onmicrosoft.com',
    ast,
    rawXml: '',
  };
}

describe('extractUserJourneys', () => {
  it('parses a ClaimsExchange step with multiple exchanges', () => {
    const journeys = extractUserJourneys(
      parsed({
        UserJourneys: {
          UserJourney: {
            '@_Id': 'SignUpOrSignIn',
            OrchestrationSteps: {
              OrchestrationStep: {
                '@_Order': '2',
                '@_Type': 'ClaimsExchange',
                ClaimsExchanges: {
                  ClaimsExchange: [
                    {
                      '@_Id': 'ExchangeA',
                      '@_TechnicalProfileReferenceId': 'TP-A',
                    },
                    {
                      '@_Id': 'ExchangeB',
                      '@_TechnicalProfileReferenceId': 'TP-B',
                    },
                  ],
                },
              },
            },
          },
        },
      }),
      'file-1',
    );

    expect(journeys).toHaveLength(1);
    expect(journeys[0]?.steps[0]?.claimsExchanges).toEqual([
      { id: 'ExchangeA', technicalProfileReferenceId: 'TP-A' },
      { id: 'ExchangeB', technicalProfileReferenceId: 'TP-B' },
    ]);
  });

  it('captures preconditions and target claims exchange ids', () => {
    const journeys = extractUserJourneys(
      parsed({
        UserJourneys: {
          UserJourney: {
            '@_Id': 'SignIn',
            OrchestrationSteps: {
              OrchestrationStep: {
                '@_Order': '1',
                '@_Type': 'ClaimsProviderSelection',
                Preconditions: {
                  Precondition: {
                    '@_Type': 'ClaimsExist',
                    '@_ExecuteActionsIf': 'false',
                    Value: ['objectId', 'email'],
                    Action: 'SkipThisOrchestrationStep',
                  },
                },
                ClaimsProviderSelections: {
                  ClaimsProviderSelection: {
                    '@_TargetClaimsExchangeId': 'ExchangeA',
                  },
                },
              },
            },
          },
        },
      }),
      'file-2',
    );

    expect(journeys[0]?.steps[0]).toMatchObject({
      targetClaimsExchangeIds: ['ExchangeA'],
      preconditions: [
        {
          type: 'ClaimsExist',
          executeActionsIf: 'false',
          values: ['objectId', 'email'],
          action: 'SkipThisOrchestrationStep',
        },
      ],
    });
  });

  it('maps unknown step types to Other and preserves the raw type', () => {
    const journeys = extractUserJourneys(
      parsed({
        UserJourneys: {
          UserJourney: {
            '@_Id': 'Custom',
            OrchestrationSteps: {
              OrchestrationStep: {
                '@_Order': '5',
                '@_Type': 'InvokeAPI',
              },
            },
          },
        },
      }),
      'file-3',
    );

    expect(journeys[0]?.steps[0]).toMatchObject({
      type: 'Other',
      rawType: 'InvokeAPI',
    });
  });

  it('normalizes Id attribute values with surrounding whitespace', () => {
    const journeys = extractUserJourneys(
      parsed({
        UserJourneys: {
          UserJourney: {
            '@_Id': '  SignUpOrSignIn  ',
            OrchestrationSteps: {
              OrchestrationStep: { '@_Order': '1', '@_Type': 'ClaimsExchange' },
            },
          },
        },
      }),
      'file-1',
    );

    expect(journeys[0]?.id).toBe('SignUpOrSignIn');
  });
});
