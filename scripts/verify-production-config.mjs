import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(repoRoot, 'dist');
const requiredEnvVars = [
  'VITE_SCENE_API_URL',
  'VITE_SCENE_EDITOR_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];
const placeholderPattern = /\breplace\b|\bplaceholder\b|\bexample\b/i;

if (!existsSync(distRoot)) {
  throw new Error('dist is missing. Run the Gallery production build before verifying production config.');
}

const values = requiredEnvVars.map((name) => {
  const value = process.env[name]?.trim() ?? '';
  return { name, value };
});
const missing = values.filter(({ value }) => !value);
const placeholders = values.filter(({ value }) => placeholderPattern.test(value));

if (missing.length > 0 || placeholders.length > 0) {
  throw new Error([
    'Gallery production config verification failed.',
    ...missing.map(({ name }) => `- ${name} is required for production Gallery auth.`),
    ...placeholders.map(({ name }) => `- ${name} still looks like a placeholder.`),
  ].join('\n'));
}

const files = listFiles(distRoot);
const missingFromBundle = values.filter(({ value }) => !files.some((filePath) => readFileSync(filePath).includes(Buffer.from(value))));

if (missingFromBundle.length > 0) {
  throw new Error([
    'Gallery production config verification failed.',
    ...missingFromBundle.map(({ name }) => `- ${name} was not found in the built bundle.`),
  ].join('\n'));
}

console.log(`Gallery production config scan passed for ${relative(repoRoot, distRoot)}.`);

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = resolve(directory, entry);
    const stats = statSync(filePath);

    return stats.isDirectory() ? listFiles(filePath) : [filePath];
  });
}
