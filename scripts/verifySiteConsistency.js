import { readFile, access } from 'node:fs/promises';

const requiredFiles = [
  'public/PeytonCampbellResume.pdf',
  'public/CNAME',
  'public/portrait-1200.webp',
  'public/basketball-1200.webp',
  'public/golf-1200.webp',
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(file);
  } catch {
    failures.push(`Missing required asset: ${file}`);
  }
}

const data = await readFile('src/data.ts', 'utf8');
const app = await readFile('src/App.tsx', 'utf8');
const index = await readFile('index.html', 'utf8');
const copyScript = await readFile('scripts/copy404.js', 'utf8');

const slugs = [...data.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);

if (!slugs.length) failures.push('No project slugs found in src/data.ts');
if (duplicateSlugs.length) failures.push(`Duplicate project slugs: ${[...new Set(duplicateSlugs)].join(', ')}`);

for (const slug of slugs) {
  if (!copyScript.includes(`'${slug}'`)) failures.push(`Project slug missing from static route generation: ${slug}`);
}

const visuals = [...data.matchAll(/visual: '([^']+)'/g)].map((match) => match[1]);
const allowedVisuals = new Set(['scoreboard', 'console', 'mobile', 'tester', 'catan']);
const unknownVisuals = visuals.filter((visual) => !allowedVisuals.has(visual));
if (unknownVisuals.length) failures.push(`Unknown project visual types: ${unknownVisuals.join(', ')}`);

const requiredSourceSignals = [
  'ArchitectureDiagram',
  'ProjectDetail',
  'NotFound',
  'trackPageView',
  'CONTACT_TRUST',
];

for (const signal of requiredSourceSignals) {
  if (!app.includes(signal)) failures.push(`Missing app integration: ${signal}`);
}

const requiredHeadSignals = [
  'application/ld+json',
  'plausible.io/js/script.js',
  'portrait-1200.webp',
  'theme-color',
];

for (const signal of requiredHeadSignals) {
  if (!index.includes(signal)) failures.push(`Missing document head signal: ${signal}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Site consistency verified (${slugs.length} project slugs, ${visuals.length} visuals).`);
