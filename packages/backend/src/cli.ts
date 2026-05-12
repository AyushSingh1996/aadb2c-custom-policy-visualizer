import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runAnalysis } from './engine/pipeline.js';
import type { UploadedFile } from './engine/types.js';

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) {
    process.stderr.write('Usage: npx tsx src/cli.ts <path-to-xml-directory>\n');
    process.exit(1);
  }

  const absDir = resolve(dir);
  const entries = await readdir(absDir);
  const xmlEntries = entries.filter((e) => e.toLowerCase().endsWith('.xml'));

  if (xmlEntries.length === 0) {
    process.stderr.write(`No .xml files found in ${absDir}\n`);
    process.exit(1);
  }

  const uploadedFiles: UploadedFile[] = await Promise.all(
    xmlEntries.map(async (fileName) => {
      const filePath = join(absDir, fileName);
      const [buffer, stats] = await Promise.all([readFile(filePath), stat(filePath)]);
      return { fileName, buffer, sizeBytes: stats.size, lastModified: stats.mtime.toISOString() };
    }),
  );

  const result = await runAnalysis(uploadedFiles);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
