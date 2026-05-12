import { XMLParser } from 'fast-xml-parser';
import type { ParseError } from '@policy-analyzer/shared';
import type { ParsedFile, TrustFrameworkPolicyAst } from './types.js';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  processEntities: true,
  alwaysCreateTextNode: false,
  allowBooleanAttributes: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
});

export function parseFile(
  buffer: Buffer,
  fileName: string,
  relativePath?: string,
): ParsedFile | ParseError {
  let root: Record<string, unknown>;

  try {
    root = xmlParser.parse(buffer) as Record<string, unknown>;
  } catch (err) {
    return {
      fileName,
      ...(relativePath ? { relativePath } : {}),
      message: err instanceof Error ? err.message : String(err),
    };
  }

  if (!('TrustFrameworkPolicy' in root)) {
    return {
      fileName,
      ...(relativePath ? { relativePath } : {}),
      message: 'Not a B2C custom policy file. Root element must be <TrustFrameworkPolicy>.',
    };
  }

  const tfp = root['TrustFrameworkPolicy'] as Record<string, unknown>;
  const policyId = toStr(tfp['@_PolicyId']);
  const tenantId = toStr(tfp['@_TenantId']);

  if (!policyId || !tenantId) {
    return {
      fileName,
      ...(relativePath ? { relativePath } : {}),
      message: 'TrustFrameworkPolicy is missing required PolicyId or TenantId attribute.',
    };
  }

  const basePolicy = tfp['BasePolicy'] as Record<string, unknown> | undefined;
  const basePolicyId = basePolicy ? toStr(basePolicy['PolicyId']) : undefined;
  const basePolicyTenantId = basePolicy ? toStr(basePolicy['TenantId']) : undefined;

  const result: ParsedFile = {
    fileName,
    policyId,
    tenantId,
    ast: tfp as TrustFrameworkPolicyAst,
    rawXml: buffer.toString('utf-8'),
  };

  if (basePolicyId !== undefined) result.basePolicyId = basePolicyId;
  if (basePolicyTenantId !== undefined) result.basePolicyTenantId = basePolicyTenantId;

  return result;
}

export function isParsedFile(result: ParsedFile | ParseError): result is ParsedFile {
  return 'ast' in result;
}

function toStr(val: unknown): string | undefined {
  if (typeof val === 'string') return val.trim() || undefined;
  if (typeof val === 'number') return String(val);
  return undefined;
}
