import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve(process.cwd(), 'dist');

if (process.argv.includes('--clean')) {
  await rm(outputDirectory, { recursive: true, force: true });
  process.exit(0);
}

const serverDirectory = resolve(outputDirectory, 'server');

await mkdir(serverDirectory, { recursive: true });
await writeFile(
  resolve(serverDirectory, 'index.js'),
  `const worker = {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response('Sites assets binding is unavailable.', { status: 503 });
    }

    const response = await env.ASSETS.fetch(request);
    if (
      response.status !== 404 ||
      request.method !== 'GET' ||
      !(request.headers.get('accept') || '').includes('text/html')
    ) {
      return response;
    }

    const indexUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};

export default worker;
`,
  'utf8',
);
