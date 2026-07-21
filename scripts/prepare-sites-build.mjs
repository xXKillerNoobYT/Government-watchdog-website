import { access, copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist');

if (process.argv.includes('--clean')) {
  await rm(outputDirectory, { recursive: true, force: true });
  process.exit(0);
}

const serverDirectory = resolve(outputDirectory, 'server');
const metadataDirectory = resolve(outputDirectory, '.openai');
const hostingConfig = resolve(process.cwd(), '.openai/hosting.json');
const workerSource = resolve(process.cwd(), 'scripts/sites-worker.mjs');

await access(resolve(outputDirectory, 'client/index.html'));
await access(hostingConfig);
await access(workerSource);
await mkdir(serverDirectory, { recursive: true });
await mkdir(metadataDirectory, { recursive: true });
await copyFile(workerSource, resolve(serverDirectory, 'index.js'));
await copyFile(hostingConfig, resolve(metadataDirectory, 'hosting.json'));
