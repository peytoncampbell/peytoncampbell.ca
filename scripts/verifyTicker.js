import { readFileSync } from 'node:fs';

const ticker = readFileSync('src/LiveTicker.tsx', 'utf8');
const data = readFileSync('src/data.ts', 'utf8');

const failures = [];

const mustInclude = (source, snippet, message) => {
  if (!source.includes(snippet)) failures.push(message);
};

const mustExclude = (source, snippet, message) => {
  if (source.includes(snippet)) failures.push(message);
};

mustInclude(ticker, 'aria-live="polite"', 'Ticker should announce rotating status text politely.');
mustInclude(ticker, 'work-status-ticker', 'Ticker should have a dedicated styling hook.');
mustInclude(ticker, 'text-slate-100', 'Ticker value should be high contrast.');
mustInclude(ticker, 'text-cyan-200', 'Ticker label should be visibly accented.');
mustInclude(ticker, 'w-[300px]', 'Ticker should be wide enough for readable professional status text.');
mustInclude(ticker, 'LIVE_STATUS[index].label', 'Ticker should still render rotating labels.');
mustInclude(ticker, 'LIVE_STATUS[index].value', 'Ticker should still render rotating values.');

mustInclude(data, "label: 'Role'", 'Ticker copy should use direct professional labels.');
mustInclude(data, "label: 'Stack'", 'Ticker copy should use direct professional labels.');
mustInclude(data, "label: 'Domain'", 'Ticker copy should use direct professional labels.');
mustInclude(data, "label: 'Based in'", 'Ticker copy should use direct professional labels.');
mustInclude(data, "value: 'Full-stack software developer'", 'Ticker should state the role directly.');
mustInclude(data, "value: 'React, Next.js, Python, C#, .NET MAUI'", 'Ticker should show concrete stack details.');
mustInclude(data, "value: 'Sports technology and IoT tools'", 'Ticker should describe domain without hype.');

mustExclude(ticker, 'text-slate-600', 'Ticker should not use low-contrast slate text.');
mustExclude(ticker, 'animate-ping', 'Ticker should avoid gimmicky ping animation.');
mustExclude(ticker, "filter: 'blur", 'Ticker rotation should not blur text that needs to stay readable.');
mustExclude(data, "label: 'Focus'", 'Ticker labels should not be vague.');
mustExclude(data, "label: 'Status'", 'Ticker labels should not be vague.');
mustExclude(data, "label: 'Current'", 'Ticker labels should not be vague.');
mustExclude(data, 'Toronto reach', 'Ticker copy should avoid vague/corny reach phrasing.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Ticker verified.');
