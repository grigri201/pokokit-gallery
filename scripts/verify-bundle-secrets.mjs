import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(repoRoot, 'dist');
const forbiddenMarkers = [
  'POKOKIT_SESSION_SECRET',
  'pokokit_session',
  'sb_secret_',
  'service_role',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SECRET',
  'SUPABASE_JWT_SECRET',
  'JWT_SECRET',
  'JWT secret',
  'jwt_secret',
];
const jwtCandidatePattern = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

if (!existsSync(distRoot)) {
  throw new Error('dist is missing. Run the Gallery build before verifying bundle secrets.');
}

const violations = [];

for (const filePath of listFiles(distRoot)) {
  const content = readFileSync(filePath);
  const textContent = content.toString('utf8');

  for (const marker of forbiddenMarkers) {
    if (content.includes(Buffer.from(marker))) {
      violations.push(`${relative(repoRoot, filePath)} contains forbidden marker ${marker}`);
    }
  }

  for (const candidate of textContent.matchAll(jwtCandidatePattern)) {
    const payload = decodeJwtPayload(candidate[0]);
    if (payload?.role === 'service_role') {
      violations.push(`${relative(repoRoot, filePath)} contains a forbidden service_role JWT`);
    }
  }
}

if (violations.length > 0) {
  throw new Error([
    'Gallery bundle secret scan failed.',
    ...violations.map((violation) => `- ${violation}`),
  ].join('\n'));
}

console.log(`Gallery bundle secret scan passed for ${relative(repoRoot, distRoot)}.`);

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = resolve(directory, entry);
    const stats = statSync(filePath);

    return stats.isDirectory() ? listFiles(filePath) : [filePath];
  });
}

function decodeJwtPayload(jwt) {
  const payloadSegment = jwt.split('.')[1];
  if (!payloadSegment) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));

    return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}
