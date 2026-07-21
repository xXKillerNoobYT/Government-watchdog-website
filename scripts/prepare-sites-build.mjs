import { access, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist');

if (process.argv.includes('--clean')) {
  await rm(outputDirectory, { recursive: true, force: true });
  process.exit(0);
}

const serverDirectory = resolve(outputDirectory, 'server');
const metadataDirectory = resolve(outputDirectory, '.openai');
const hostingConfig = resolve(process.cwd(), '.openai/hosting.json');

await access(resolve(outputDirectory, 'client/index.html'));
await access(hostingConfig);
await mkdir(serverDirectory, { recursive: true });
await mkdir(metadataDirectory, { recursive: true });
await writeFile(
  resolve(serverDirectory, 'index.js'),
  `async function withRuntimeOrigin(response, request) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const body = (await response.text()).replaceAll('__GW_ORIGIN__', new URL(request.url).origin);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

const worker = {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response('Sites assets binding is unavailable.', { status: 503 });
    }

    const response = await env.ASSETS.fetch(request);
    if (
      response.status !== 404 ||
      request.method !== 'GET' ||
      !(request.headers.get('accept') || '').includes('text/html') ||
      (new URL(request.url).pathname.split('/').pop() || '').includes('.')
    ) {
      return withRuntimeOrigin(response, request);
    }

    const indexUrl = new URL('/index.html', request.url);
    const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
    return withRuntimeOrigin(indexResponse, request);
  },
};

export default worker;
`,
  'utf8',
);
await copyFile(hostingConfig, resolve(metadataDirectory, 'hosting.json'));
