import type { LocalizationEntry } from '@policy-analyzer/shared';
import type { ParsedFile } from './types.js';
import { asArray, copyOptional, readAttr, readNode, readText } from './xml.js';

export function extractLocalization(parsed: ParsedFile, fileId: string): LocalizationEntry[] {
  const supportedLanguages = new Set(
    asArray<unknown>(readNode(parsed.ast, ['BuildingBlocks', 'Localization', 'SupportedLanguages', 'SupportedLanguage']))
      .map((language) => readText(language))
      .filter((language): language is string => language !== undefined),
  );

  const entries: LocalizationEntry[] = [];
  for (const resource of asArray<Record<string, unknown>>(
    readNode(parsed.ast, ['BuildingBlocks', 'Localization', 'LocalizedResources']),
  )) {
    const resourceId = readAttr(resource, 'Id');
    if (resourceId === undefined) continue;

    const entry: LocalizationEntry = {
      resourceId,
      localizedStrings: asArray<Record<string, unknown>>(
        readNode(resource, ['LocalizedStrings', 'LocalizedString']),
      )
        .map((item) => {
          const elementType = readAttr(item, 'ElementType');
          const stringId = readAttr(item, 'StringId');
          const value = readText(item);
          if (elementType === undefined || stringId === undefined || value === undefined) {
            return undefined;
          }
          return { elementType, stringId, value };
        })
        .filter((item): item is LocalizationEntry['localizedStrings'][number] => item !== undefined),
      localizedCollections: asArray<Record<string, unknown>>(
        readNode(resource, ['LocalizedCollections', 'LocalizedCollection']),
      )
        .map((collection) => {
          const elementType = readAttr(collection, 'ElementType');
          const elementId = readAttr(collection, 'ElementId');
          if (elementType === undefined || elementId === undefined) return undefined;

          const items = asArray<Record<string, unknown>>(readNode(collection, ['Item']))
            .map((item) => {
              const name = readAttr(item, 'Name');
              const value = readText(item);
              if (name === undefined || value === undefined) return undefined;
              return { name, value };
            })
            .filter(
              (item): item is LocalizationEntry['localizedCollections'][number]['items'][number] =>
                item !== undefined,
            );

          return { elementType, elementId, items };
        })
        .filter(
          (item): item is LocalizationEntry['localizedCollections'][number] => item !== undefined,
        ),
      definedInFileId: fileId,
    };
    copyOptional(entry, 'language', inferLanguage(resourceId, supportedLanguages));
    entries.push(entry);
  }
  return entries;
}

function inferLanguage(resourceId: string, supportedLanguages: Set<string>): string | undefined {
  const candidate = resourceId.split('.').pop();
  if (candidate !== undefined && supportedLanguages.has(candidate)) return candidate;
  return undefined;
}
