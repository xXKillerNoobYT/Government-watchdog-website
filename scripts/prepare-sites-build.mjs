import { access, copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKER_SOURCES = Object.freeze({
  private: 'scripts/sites-worker.mjs',
  public: 'scripts/sites-worker-public.mjs',
});

export function parseSitesBuildOptions(args) {
  let clean = false;
  let profile = 'private';
  let profileSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--clean') {
      if (clean) throw new Error('Duplicate --clean option.');
      clean = true;
      continue;
    }

    if (argument === '--profile') {
      if (profileSeen) throw new Error('Duplicate --profile option.');
      const candidate = args[index + 1];
      if (candidate !== 'private' && candidate !== 'public') {
        throw new Error('--profile must be private or public.');
      }
      profile = candidate;
      profileSeen = true;
      index += 1;
      continue;
    }

    throw new Error('Unknown argument: ' + argument);
  }

  return { clean, profile };
}

export function sitesWorkerSource(profile) {
  if (!Object.hasOwn(WORKER_SOURCES, profile)) {
    throw new Error('Unknown Sites worker profile: ' + profile);
  }

  return WORKER_SOURCES[profile];
}

export async function prepareSitesBuild(
  args = process.argv.slice(2),
  repositoryRoot = process.cwd(),
) {
  const { clean, profile } = parseSitesBuildOptions(args);
  const outputDirectory = resolve(repositoryRoot, 'dist');

  if (clean) {
    await rm(outputDirectory, { recursive: true, force: true });
    return;
  }

  const serverDirectory = resolve(outputDirectory, 'server');
  const metadataDirectory = resolve(outputDirectory, '.openai');
  const hostingConfig = resolve(repositoryRoot, '.openai/hosting.json');
  const workerSource = resolve(repositoryRoot, sitesWorkerSource(profile));

  await access(resolve(outputDirectory, 'client/index.html'));
  await access(hostingConfig);
  await access(workerSource);
  await mkdir(serverDirectory, { recursive: true });
  await mkdir(metadataDirectory, { recursive: true });
  await copyFile(workerSource, resolve(serverDirectory, 'index.js'));
  await copyFile(hostingConfig, resolve(metadataDirectory, 'hosting.json'));
}

const invokedScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedScript) await prepareSitesBuild();
