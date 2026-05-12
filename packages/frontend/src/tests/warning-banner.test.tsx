import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { WarningBanner } from '../components/WarningBanner.js';

describe('WarningBanner', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flush();
    });
    container.remove();
  });

  test('renders the message banner copy', async () => {
    await act(async () => {
      root.render(<WarningBanner message="1 unresolved file reference detected." />);
      await flush();
    });

    expect(container.textContent).toContain('1 unresolved file reference detected.');
  });

  test('renders schema warnings in a collapsed details section', async () => {
    await act(async () => {
      root.render(
        <WarningBanner
          schemaWarnings={[
            {
              code: 'INVALID_PROTOCOL_NAME',
              message: 'Technical profile "TP-Unknown" uses unsupported protocol name "Foo".',
              entityId: 'TP-Unknown',
              entityType: 'TechnicalProfile',
              fileId: 'file-1',
            },
          ]}
        />,
      );
      await flush();
    });

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    expect(container.textContent).toContain('Schema warnings (1)');
    expect(container.textContent).toContain('[INVALID_PROTOCOL_NAME]');
    expect(container.textContent).toContain('TP-Unknown');
  });
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
