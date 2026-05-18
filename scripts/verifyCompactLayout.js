import { readFileSync } from 'node:fs';

const css = readFileSync('src/index.css', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

const failures = [];

const requireIncludes = (source, snippet, message) => {
  if (!source.includes(snippet)) failures.push(message);
};

const requireExcludes = (source, snippet, message) => {
  if (source.includes(snippet)) failures.push(message);
};

requireIncludes(css, 'min-height: clamp(620px, 82svh, 780px);', 'Hero should use a compact responsive height instead of occupying the full viewport.');
requireIncludes(css, 'font-size: clamp(3rem, 7vw, 6rem);', 'Desktop hero headline should be scaled down for denser first viewport.');
requireIncludes(css, 'padding: 7.2rem 0 3.2rem;', 'Hero vertical padding should be tighter.');
requireIncludes(css, 'padding-block: clamp(3.6rem, 6vw, 5.5rem);', 'Sections should use compact vertical spacing.');
requireIncludes(css, 'margin-bottom: clamp(1.35rem, 3vw, 2.25rem);', 'Section intros should not create excessive dead space.');
requireIncludes(css, 'font-size: clamp(2rem, 4.4vw, 3.75rem);', 'Section titles should be large but not oversized.');
requireIncludes(css, 'grid-template-columns: minmax(0, 1fr) minmax(240px, 0.78fr);', 'Featured project layout should use a denser metric column.');
requireIncludes(css, 'padding: clamp(1rem, 2.5vw, 1.8rem);', 'Featured project card padding should be reduced.');
requireIncludes(css, 'min-height: 18rem;', 'Project cards should be shorter and more scan-friendly.');
requireIncludes(css, 'padding: 1rem;', 'Project cards and repeated cards should use tighter padding.');
requireIncludes(css, 'grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.2fr);', 'Capabilities should favor dense skill scanning.');
requireIncludes(css, 'min-height: 34rem;', 'Story section should be compressed.');
requireIncludes(css, 'padding: clamp(1.5rem, 4vw, 3.4rem);', 'Story copy should use less padding.');
requireIncludes(css, 'min-height: 640px;', 'Mobile hero should be shorter.');
requireIncludes(css, 'height: 640px;', 'Mobile hero image should match shorter hero.');
requireIncludes(css, 'height: 700px;', 'Mobile hero overlay should match compact hero.');
requireIncludes(app, 'projects-compact', 'Projects section should opt into compact section spacing.');
requireIncludes(app, 'capabilities-compact', 'Capabilities section should opt into compact section spacing.');

requireExcludes(css, 'min-height: 100svh;', 'Full viewport hero height wastes space.');
requireExcludes(css, 'padding-block: clamp(5rem, 9vw, 8rem);', 'Old section padding is too tall.');
requireExcludes(css, 'min-height: 22rem;', 'Old project card minimum height is too tall.');
requireExcludes(css, 'min-height: 44rem;', 'Old story section minimum height is too tall.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Compact layout verified.');
