import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ProtocolCategoryBadge } from '../components/ProtocolCategoryBadge.js';

describe('ProtocolCategoryBadge', () => {
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

  test('renders a readable label and category class', async () => {
    await act(async () => {
      root.render(<ProtocolCategoryBadge category="REST_API" />);
      await flush();
    });

    const badge = container.querySelector('.protocol-badge');
    expect(badge?.textContent).toBe('REST API');
    expect(badge?.className).toContain('protocol-badge--REST_API');
  });

  test('renders other labels without truncating the category mapping', async () => {
    await act(async () => {
      root.render(<ProtocolCategoryBadge category="JWT_ISSUER" />);
      await flush();
    });

    expect(container.textContent).toContain('JWT Issuer');
  });
});

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
