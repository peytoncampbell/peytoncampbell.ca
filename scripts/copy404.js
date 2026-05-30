// Post-build: create static SPA entrypoints for GitHub Pages routing.
import { copyFile, constants, mkdir } from 'fs';
import { resolve } from 'path';

const src = resolve('docs', 'index.html');
const projectSlugs = [
  'scoreboard-configurator',
  'provisioning-console',
  'scorecontroller',
  'production-test-jig',
  'catan-settlement-optimizer',
];

function copyEntrypoint(dest, label) {
  copyFile(src, dest, constants.COPYFILE_FICLONE, (err) => {
    if (err) {
      console.error(`Failed to create ${label} from index.html:`, err);
      process.exitCode = 1;
    } else {
      console.log(`Created ${label}.`);
    }
  });
}

copyEntrypoint(resolve('docs', '404.html'), 'docs/404.html for GitHub Pages routing');

for (const slug of projectSlugs) {
  const dir = resolve('docs', 'projects', slug);
  mkdir(dir, { recursive: true }, (mkdirErr) => {
    if (mkdirErr) {
      console.error(`Failed to create project route directory for ${slug}:`, mkdirErr);
      process.exitCode = 1;
      return;
    }

    copyEntrypoint(resolve(dir, 'index.html'), `docs/projects/${slug}/index.html`);
  });
}

