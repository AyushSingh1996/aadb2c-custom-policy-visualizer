import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  AnalysisResult,
  ClaimReference,
  OrchestrationStep,
  PolicyChain,
  PolicyFile,
  SchemaWarning,
  TechnicalProfile,
} from '@policy-analyzer/shared';
import App from '../App.js';
import { createInitialAnalysisState, useAnalysisStore } from '../store/analysis.js';

const fixtureRoot = resolve(process.cwd(), '../backend/tests/fixtures');

describe('application end-to-end flows', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    window.history.pushState({}, '', '/');
    resetStore();
    await renderApp(root);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    document.body.innerHTML = '';
  });

  test('sample mode navigates upload to map to detail with a selected first step', async () => {
    const sampleResult = createSampleAnalysisResult();
    mockFetch((input, init) => {
      if (input === '/api/sample' && init?.method === 'GET') {
        return jsonResponse(sampleResult);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    await clickButton('Try with sample policies');
    await waitFor(() => window.location.pathname === '/map');
    expect(document.body.textContent).toContain('Policy Map');

    await clickButton('TrustFrameworkBase-LocalAccounts.xml');
    await waitFor(
      () =>
        document.body.textContent?.includes('TrustFrameworkExtensions-LocalAccounts-MFA.xml') ===
        true,
    );
    await clickButton('TrustFrameworkExtensions-LocalAccounts-MFA.xml');
    await waitFor(() => document.body.textContent?.includes('B2C_1A_SignIn_Local.xml') === true);
    await clickButton('B2C_1A_SignIn_Local.xml');

    await waitFor(() => window.location.pathname.startsWith('/detail/'));
    await waitFor(() => document.body.textContent?.includes('User Journeys (1)') === true);
    expect(document.body.textContent).toContain('SignUpOrSignIn');
    expect(document.body.textContent).toContain('Step 1 of 5');
    expect(document.body.textContent).toContain('Local Account Signin');
    expect(document.body.textContent).toContain('Learn more');
  });

  test('folder upload of clean fixtures shows relative paths and navigates to the map', async () => {
    const cleanResult = createCleanFixtureAnalysisResult({
      rootDir: 'tenant-a',
    });
    mockFetch((input, init) => {
      if (input === '/api/analyze' && init?.method === 'POST') {
        return jsonResponse(cleanResult);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    await uploadFixtureFolder('clean', 'tenant-a', [
      'TrustFrameworkBase.xml',
      'TrustFrameworkExtensions.xml',
      'SignUpOrSignIn.xml',
    ]);

    await waitFor(() => document.body.textContent?.includes('Detected Files (3)') === true);
    expect(document.body.textContent).toContain('TrustFrameworkBase.xml');
    expect(document.body.textContent).toContain('TrustFrameworkExtensions.xml');
    expect(document.body.textContent).toContain('SignUpOrSignIn.xml');
    expect(document.body.textContent).toContain('tenant-a/');
    expect(document.body.textContent).toContain('Base');
    expect(document.body.textContent).toContain('Extension');
    expect(document.body.textContent).toContain('Relying Party');

    await clickButton('Analyze Policies');
    await waitFor(() => window.location.pathname === '/map');
    expect(document.body.textContent).toContain('Policy Map');
  });

  test('orphan upload flow shows the unresolved file reference warning on the map', async () => {
    const orphanResult = createOrphanAnalysisResult();
    mockFetch((input, init) => {
      if (input === '/api/analyze' && init?.method === 'POST') {
        return jsonResponse(orphanResult);
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    await uploadFixtureFiles('missing-base', [
      'TrustFrameworkExtensions.xml',
      'SignUpOrSignIn.xml',
    ]);

    await clickButton('Analyze Policies');
    await waitFor(() => window.location.pathname === '/map');
    expect(document.body.textContent).toContain('1 unresolved file reference detected.');
  });
});

function resetStore(): void {
  useAnalysisStore.setState({
    ...createInitialAnalysisState(),
    setResult: useAnalysisStore.getState().setResult,
    clearResult: useAnalysisStore.getState().clearResult,
    setAnalyzing: useAnalysisStore.getState().setAnalyzing,
    setError: useAnalysisStore.getState().setError,
  });
}

async function renderApp(root: Root): Promise<void> {
  await act(async () => {
    root.render(<App />);
    await flush();
  });
}

async function clickButton(labelText: string): Promise<void> {
  const button = findButton(labelText);
  expect(button).not.toBeNull();
  await act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();
  });
}

async function uploadFixtureFiles(fixtureDir: string, fileNames: string[]): Promise<void> {
  const input = document.querySelector('[data-upload-input="files"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const files = fileNames.map((fileName) => {
    const content = readFileSync(join(fixtureRoot, fixtureDir, fileName), 'utf-8');
    return new File([content], fileName, {
      type: 'application/xml',
      lastModified: 1,
    });
  });

  Object.defineProperty(input, 'files', {
    configurable: true,
    value: createFileList(files),
  });

  await act(async () => {
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  });
}

async function uploadFixtureFolder(
  fixtureDir: string,
  rootDir: string,
  fileNames: string[],
): Promise<void> {
  const input = document.querySelector('[data-upload-input="folder"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const files = fileNames.map((fileName) => {
    const content = readFileSync(join(fixtureRoot, fixtureDir, fileName), 'utf-8');
    const file = new File([content], fileName, {
      type: 'application/xml',
      lastModified: 1,
    });
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      value: `${rootDir}/${fileName}`,
    });
    return file;
  });

  Object.defineProperty(input, 'files', {
    configurable: true,
    value: createFileList(files),
  });

  await act(async () => {
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await flush();
  });
}

function createFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item(index: number): File | null {
      return files[index] ?? null;
    },
    [Symbol.iterator](): IterableIterator<File> {
      return files.values();
    },
  } as FileList & { [index: number]: File };

  files.forEach((file, index) => {
    fileList[index] = file;
  });

  return fileList;
}

function findButton(labelText: string): HTMLButtonElement | null {
  return (
    ([...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(labelText),
    ) as HTMLButtonElement | undefined) ?? null
  );
}

async function waitFor(predicate: () => boolean, attempts = 50): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) {
      return;
    }
    await flush();
  }

  throw new Error('Timed out waiting for condition.');
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => handler(input, init));
}

function jsonResponse(payload: AnalysisResult): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createSampleAnalysisResult(): AnalysisResult {
  const localBase = createPolicyFile('base-local', 'TrustFrameworkBase-LocalAccounts.xml', 'Base');
  const localExtension = createPolicyFile(
    'ext-local-mfa',
    'TrustFrameworkExtensions-LocalAccounts-MFA.xml',
    'Extension',
  );
  const localRp = createPolicyFile('rp-local-signin', 'B2C_1A_SignIn_Local.xml', 'RelyingParty');
  const socialBase = createPolicyFile(
    'base-social',
    'TrustFrameworkBase-SocialAccounts.xml',
    'Base',
  );
  const socialExtension = createPolicyFile(
    'ext-social',
    'TrustFrameworkExtensions-SocialAccounts-Linking.xml',
    'Extension',
  );
  const socialRp = createPolicyFile('rp-social-signin', 'B2C_1A_SignIn_Social.xml', 'RelyingParty');
  const b2bBase = createPolicyFile('base-b2b', 'TrustFrameworkBase-B2B.xml', 'Base');
  const b2bExtension = createPolicyFile(
    'ext-b2b',
    'TrustFrameworkExtensions-B2B-Invitations.xml',
    'Extension',
  );
  const b2bRp = createPolicyFile('rp-b2b-signin', 'B2C_1A_SignIn_B2B.xml', 'RelyingParty');

  const localChain = createChain({
    id: 'chain-local',
    name: 'Sign-In (Local Account)',
    fileIds: [localBase.id, localExtension.id, localRp.id],
    rpFileId: localRp.id,
    journeyId: 'SignUpOrSignIn',
    technicalProfiles: [
      createTechnicalProfile('SelfAsserted-LocalAccountSignin-Email', 'Local Account Signin', {
        catalogDescription:
          'Collects local account sign-in credentials and drives validation technical profiles.',
        catalogDocsUrl:
          'https://learn.microsoft.com/en-us/azure/active-directory-b2c/self-asserted-technical-profile',
        inputClaims: [claimReference('signInName')],
        outputClaims: [claimReference('email'), claimReference('objectId')],
      }),
      createTechnicalProfile('REST-GetLoyaltyId', 'Get Loyalty ID', {
        outputClaims: [claimReference('extension_loyaltyId')],
        metadata: { ServiceUrl: 'https://api.contoso.com/loyalty' },
      }),
      createTechnicalProfile('AAD-UserReadUsingObjectId', 'Read User', {
        inputClaims: [claimReference('objectId')],
        outputClaims: [claimReference('displayName')],
      }),
      createTechnicalProfile('AAD-UserWriteProfile', 'Write Profile', {
        inputClaims: [claimReference('displayName')],
        outputClaims: [claimReference('displayName')],
      }),
      createTechnicalProfile('JwtIssuer', 'JwtIssuer', {
        outputClaims: [claimReference('objectId')],
      }),
    ],
    steps: [
      orchestrationStep(
        1,
        'CombinedSignInAndSignUp',
        'SelfAsserted-LocalAccountSignin-Email',
        ['signInName'],
        ['email', 'objectId'],
      ),
      orchestrationStep(
        2,
        'ClaimsExchange',
        'REST-GetLoyaltyId',
        ['email'],
        ['extension_loyaltyId'],
      ),
      orchestrationStep(
        3,
        'ClaimsExchange',
        'AAD-UserReadUsingObjectId',
        ['objectId'],
        ['displayName'],
      ),
      orchestrationStep(
        4,
        'ClaimsExchange',
        'AAD-UserWriteProfile',
        ['displayName'],
        ['displayName'],
      ),
      orchestrationStep(5, 'SendClaims', 'JwtIssuer', ['objectId'], ['objectId']),
    ],
    externalDependencies: [
      {
        type: 'RestApi',
        url: 'https://api.contoso.com/loyalty',
        technicalProfileId: 'REST-GetLoyaltyId',
        context: 'ServiceUrl',
      },
    ],
  });

  const socialChain = createChain({
    id: 'chain-social',
    name: 'Sign-In (Social Account)',
    fileIds: [socialBase.id, socialExtension.id, socialRp.id],
    rpFileId: socialRp.id,
    journeyId: 'SignInSocial',
    technicalProfiles: [createTechnicalProfile('Facebook-OAUTH', 'Facebook Login')],
    steps: [orchestrationStep(1, 'ClaimsExchange', 'Facebook-OAUTH', [], ['objectId'])],
  });

  const b2bChain = createChain({
    id: 'chain-b2b',
    name: 'B2B Sign-In',
    fileIds: [b2bBase.id, b2bExtension.id, b2bRp.id],
    rpFileId: b2bRp.id,
    journeyId: 'SignInB2B',
    technicalProfiles: [createTechnicalProfile('B2B-SignIn', 'B2B Sign-In')],
    steps: [orchestrationStep(1, 'ClaimsExchange', 'B2B-SignIn', [], ['objectId'])],
  });

  return createAnalysisResult(
    [
      localBase,
      localExtension,
      localRp,
      socialBase,
      socialExtension,
      socialRp,
      b2bBase,
      b2bExtension,
      b2bRp,
    ],
    [localChain, socialChain, b2bChain],
  );
}

function createCleanFixtureAnalysisResult(options: { rootDir?: string } = {}): AnalysisResult {
  const base = createPolicyFile('base', 'TrustFrameworkBase.xml', 'Base', options.rootDir);
  const extension = createPolicyFile(
    'extension',
    'TrustFrameworkExtensions.xml',
    'Extension',
    options.rootDir,
  );
  const rp = createPolicyFile('rp', 'SignUpOrSignIn.xml', 'RelyingParty', options.rootDir);

  return createAnalysisResult(
    [base, extension, rp],
    [
      createChain({
        id: 'clean-chain',
        name: 'Sign Up Or Sign In Flow',
        fileIds: [base.id, extension.id, rp.id],
        rpFileId: rp.id,
        journeyId: 'SignUpOrSignIn',
        technicalProfiles: [
          createTechnicalProfile('SelfAsserted-LocalAccountSignin-Email', 'Local Account Signin'),
        ],
        steps: [
          orchestrationStep(
            1,
            'ClaimsExchange',
            'SelfAsserted-LocalAccountSignin-Email',
            ['signInName'],
            ['email'],
          ),
        ],
      }),
    ],
  );
}

function createOrphanAnalysisResult(): AnalysisResult {
  const extension = createPolicyFile(
    'extension-missing',
    'TrustFrameworkExtensions.xml',
    'Extension',
  );
  const rp = createPolicyFile('rp-missing', 'SignUpOrSignIn.xml', 'RelyingParty');

  return createAnalysisResult(
    [extension, rp],
    [
      createChain({
        id: 'orphan-chain',
        name: 'Orphan Flow',
        fileIds: [extension.id, rp.id],
        rpFileId: rp.id,
        journeyId: 'SignUpOrSignIn',
        technicalProfiles: [
          createTechnicalProfile('SelfAsserted-LocalAccountSignin-Email', 'Local Account Signin'),
        ],
        steps: [
          orchestrationStep(
            1,
            'ClaimsExchange',
            'SelfAsserted-LocalAccountSignin-Email',
            ['signInName'],
            ['email'],
          ),
        ],
      }),
    ],
    [
      {
        referencedPolicyId: 'B2C_1A_MissingBase',
        referencedFromFileId: rp.id,
        referenceType: 'BasePolicy',
        message:
          '"SignUpOrSignIn.xml" references base policy "B2C_1A_MissingBase" which was not found in the upload.',
      },
    ],
  );
}

function createAnalysisResult(
  files: PolicyFile[],
  chains: PolicyChain[],
  orphanReferences: AnalysisResult['orphanReferences'] = [],
  schemaWarnings: SchemaWarning[] = [],
): AnalysisResult {
  return {
    sessionId: 'session-e2e',
    uploadedAt: '2026-04-29T00:00:00.000Z',
    files,
    chains,
    orphanReferences,
    parseErrors: [],
    schemaWarnings,
    stats: {
      policyChains: chains.length,
      filesAnalyzed: files.length,
      filesSkipped: 0,
      userJourneys: chains.reduce((sum, chain) => sum + chain.resolvedJourneys.length, 0),
      technicalProfiles: chains.reduce(
        (sum, chain) => sum + chain.resolvedTechnicalProfiles.length,
        0,
      ),
      externalDependencies: chains.reduce(
        (sum, chain) => sum + chain.externalDependencies.length,
        0,
      ),
      schemaWarningCount: schemaWarnings.length,
    },
  };
}

function createChain({
  id,
  name,
  fileIds,
  rpFileId,
  journeyId,
  technicalProfiles,
  steps,
  externalDependencies = [],
}: {
  id: string;
  name: string;
  fileIds: string[];
  rpFileId: string;
  journeyId: string;
  technicalProfiles: TechnicalProfile[];
  steps: OrchestrationStep[];
  externalDependencies?: PolicyChain['externalDependencies'];
}): PolicyChain {
  return {
    id,
    name,
    fileIds,
    rpFileId,
    defaultUserJourneyId: journeyId,
    resolvedJourneys: [
      {
        id: journeyId,
        definedInFileId: rpFileId,
        isOverride: false,
        steps,
      },
    ],
    resolvedTechnicalProfiles: technicalProfiles,
    resolvedClaimsSchema: [
      claimSchema('signInName'),
      claimSchema('email'),
      claimSchema('objectId'),
      claimSchema('displayName'),
      claimSchema('extension_loyaltyId'),
    ],
    resolvedClaimsTransformations: [],
    resolvedClaimsProviders: [],
    resolvedLocalizations: [],
    externalDependencies,
    orphanReferences: [],
    stats: {
      fileCount: fileIds.length,
      userJourneyCount: 1,
      technicalProfileCount: technicalProfiles.length,
      orchestrationStepCount: steps.length,
      externalDependencyCount: externalDependencies.length,
    },
  };
}

function createPolicyFile(
  id: string,
  fileName: string,
  category: PolicyFile['category'],
  rootDir?: string,
): PolicyFile {
  return {
    id,
    fileName,
    ...(rootDir ? { relativePath: `${rootDir}/${fileName}` } : {}),
    sizeBytes: 256,
    lastModified: '2026-04-29T00:00:00.000Z',
    category,
    rawXml: `<TrustFrameworkPolicy PolicyId="${fileName}" TenantId="contoso.onmicrosoft.com" />`,
    parsedAt: '2026-04-29T00:00:00.000Z',
  };
}

function createTechnicalProfile(
  id: string,
  displayName: string,
  overrides: Partial<TechnicalProfile> = {},
): TechnicalProfile {
  return {
    id,
    displayName,
    protocolCategory: 'OTHER',
    metadata: {},
    cryptographicKeys: [],
    inputClaims: [],
    outputClaims: [],
    persistedClaims: [],
    inputClaimsTransformations: [],
    outputClaimsTransformations: [],
    validationTechnicalProfiles: [],
    definedInFileId: 'base-local',
    isOverride: false,
    overriddenFromFileIds: [],
    resolvedFromMerge: false,
    ...overrides,
  };
}

function orchestrationStep(
  order: number,
  type: OrchestrationStep['type'],
  technicalProfileReferenceId: string,
  inputClaimNames: string[],
  outputClaimNames: string[],
): OrchestrationStep {
  return {
    order,
    type,
    technicalProfileReferenceId,
    claimsExchanges:
      type === 'ClaimsExchange'
        ? [
            {
              id: `${technicalProfileReferenceId}-exchange`,
              technicalProfileReferenceId,
            },
          ]
        : [],
    preconditions: [],
    inputClaimNames,
    outputClaimNames,
  };
}

function claimReference(claimTypeReferenceId: string): ClaimReference {
  return { claimTypeReferenceId };
}

function claimSchema(id: string) {
  return {
    id,
    dataType: 'string',
    displayName: id,
    definedInFileId: 'base-local',
    isOverride: false,
  };
}
