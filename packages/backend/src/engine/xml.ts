export function normalizeId(raw: string): string {
  return raw.trim();
}

export function asArray<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null || Array.isArray(value) || typeof value !== 'object') return undefined;
  return value as Record<string, unknown>;
}

export function readAttr(node: unknown, attrName: string): string | undefined {
  const record = asRecord(node);
  return normalizeString(record?.[`@_${attrName}`]);
}

export function readText(node: unknown): string | undefined {
  if (typeof node === 'string') return normalizeString(node);
  if (typeof node === 'number') return String(node);

  const record = asRecord(node);
  return normalizeString(record?.['#text']);
}

export function readNode(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (Array.isArray(current)) {
      current = current[0];
    }

    const record = asRecord(current);
    if (record === undefined) return undefined;
    current = record[key];
  }

  return current;
}

export function readTextAt(root: unknown, path: string[]): string | undefined {
  return readText(readNode(root, path));
}

export function readBooleanLike(value: unknown): boolean | undefined {
  const text = normalizeString(value);
  if (text === undefined) return undefined;
  if (text.toLowerCase() === 'true') return true;
  if (text.toLowerCase() === 'false') return false;
  return undefined;
}

export function copyOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
