import { readFileSync, statSync } from 'node:fs';

const data = readFileSync('src/data.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const html = readFileSync('index.html', 'utf8');

const requiredSnippets = [
  'Full Stack Software Developer',
  'Scoreboard Configurator & Admin Layout Editor',
  'Provisioning Operations Console',
  'ScoreController',
  'Python Production Test Jig',
  'React',
  'Next.js',
  'TypeScript',
  'Tailwind CSS',
  'JSON layouts',
  'RouterOS',
  'LoRaWAN',
  'TTN',
  'PyInstaller',
  '.NET MAUI',
  'XAML',
  'MVVM',
  'ReactiveUI',
  'BLE',
  'STM32CubeProgrammer',
  'DynamoDB',
  'Fanshawe College',
  'Jan 2025 - Aug 2025',
  'sports technology and IoT products',
  'London, ON',
  'Full-Stack Software Developer',
];

const staleSnippets = [
  'Jarvis Console',
  'OpenClaw Agent Infrastructure',
  'AI Personal Assistant (Jarvis)',
  'Job Hunt Pipeline',
  '7 supervised services',
  'AI Systems Builder',
  'autonomous systems',
];

const failures = [];

for (const snippet of requiredSnippets) {
  if (!data.includes(snippet) && !app.includes(snippet) && !html.includes(snippet)) {
    failures.push(`Missing resume-aligned content: ${snippet}`);
  }
}

for (const snippet of staleSnippets) {
  if (data.includes(snippet) || app.includes(snippet) || html.includes(snippet)) {
    failures.push(`Stale non-resume positioning remains: ${snippet}`);
  }
}

const resumeSize = statSync('public/PeytonCampbellResume.pdf').size;
if (resumeSize < 70000) {
  failures.push('public/PeytonCampbellResume.pdf does not look like the current resume PDF');
}

if (!app.includes('{HERO.subheadline}')) {
  failures.push('Hero subtitle should come from resume-aligned data instead of hardcoded copy');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Resume alignment verified.');
