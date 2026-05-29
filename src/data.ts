import {
  Award,
  Bot,
  Brain,
  Code2,
  Compass,
  Database,
  Layout,
  RefreshCw,
  Rocket,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

export const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
  { label: 'My Story', href: '#duality' },
  { label: 'Contact', href: '#contact' },
];

export const HERO = {
  headline: 'Full-stack developer for product tools.',
  subheadline:
    'I own end-to-end delivery across web, mobile, desktop, and internal operations tools for sports technology and IoT products, with hands-on depth in React, Next.js, TypeScript, Python, C#, .NET MAUI, and BLE systems.',
  stats: [
    { label: 'Web, mobile, desktop, and internal tooling', icon: Code2 },
    { label: 'React, Next.js, Python, C#, .NET MAUI', icon: Brain },
    { label: 'Sports tech, IoT, BLE, and production testing', icon: Trophy },
  ],
};

export const HIGHLIGHTS = [
  {
    label: 'Scoreboard product tooling',
    detail:
      'Build React and Next.js configurators, admin layout editors, and reusable preview components for customizable scoreboard products.',
    icon: Rocket,
  },
  {
    label: 'Cross-platform scoreboard control',
    detail:
      'Ship .NET MAUI apps for iOS, Android, and Windows using C#, XAML, MVVM, ReactiveUI, BLE communication, and cloud-backed data flows.',
    icon: Award,
  },
  {
    label: 'IoT operations and production testing',
    detail:
      'Build Python tooling for provisioning, serial protocol validation, STM32 firmware programming, TTN checks, and DynamoDB result logging.',
    icon: Database,
  },
];

export const SKILLS = [
  {
    title: 'Product interfaces',
    tags: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'XAML'],
    copy:
      'I build customer-facing previews, admin editors, responsive UI, and reusable product components that match real hardware constraints.',
    icon: Layout,
  },
  {
    title: 'Backend, data, and cloud',
    tags: ['Python', 'C#', '.NET', 'REST APIs', 'DynamoDB'],
    copy:
      'I connect product surfaces to APIs, JSON data flows, SQL, AWS IoT, and ETL-style workflows with reliability in mind.',
    icon: Database,
  },
  {
    title: 'Systems and delivery',
    tags: ['BLE', 'LoRaWAN', 'RouterOS', 'CI/CD', 'Regression Testing'],
    copy:
      'I work across hardware, cloud, manufacturing, and field workflows with automated tests, diagnostics, logging, and release discipline.',
    icon: Users,
  },
];

export const PROCESS = [
  {
    stage: 'Scout',
    mantra: 'Diagnose the field',
    description: 'Shadow stakeholders, inspect telemetry, and size the opportunity before writing code.',
    deliverable: 'Problem brief + success metrics',
    icon: Compass,
  },
  {
    stage: 'Strategy',
    mantra: 'Design the playbook',
    description: 'Translate scouting notes into a pragmatic technical plan with trade-offs surfaced early.',
    deliverable: 'Architecture sketch + decision log',
    icon: Target,
  },
  {
    stage: 'Execution',
    mantra: 'Ship with intent',
    description: 'Pair tight feedback loops with reliable automation so releases are calm, not chaotic.',
    deliverable: 'Incremental releases + telemetry hooks',
    icon: Zap,
  },
  {
    stage: 'Review',
    mantra: 'Measure and reinforce',
    description: 'Inspect outcomes, capture lessons, and feed insights back into the next cycle.',
    deliverable: 'Post-launch scorecard + retro',
    icon: RefreshCw,
  },
];

export const LIVE_STATUS = [
  { label: 'Role', value: 'Full-stack software developer' },
  { label: 'Stack', value: 'React, Next.js, Python, C#, .NET MAUI' },
  { label: 'Domain', value: 'Sports technology and IoT tools' },
  { label: 'Based in', value: 'London, Ontario' },
];

export const EXPERIENCE = [
  {
    company: 'OES',
    location: 'London, ON',
    title: 'Full Stack Software Developer',
    period: 'Aug 2025 - Present',
    bullets: [
      'Own end-to-end delivery of user-facing web, mobile, desktop, and internal operations tools for sports technology and IoT products.',
      'Build cross-platform .NET MAUI applications for iOS, Android, and Windows using C#, XAML, MVVM, dependency injection, Shell navigation, BLE communication, and cloud-backed data flows.',
      'Develop React and Next.js product configurator and admin tooling for customizable scoreboard layouts, reusable components, responsive previews, and JSON-based layout publishing workflows.',
      'Build Python tooling for IoT provisioning, embedded production testing, serial protocol validation, firmware programming, and cloud result logging.',
      'Improve product reliability through CI/CD pipelines, automated tests, boot diagnostics, regression testing, live logging, and debugging across frontend, backend, mobile, hardware, and cloud boundaries.',
    ],
  },
];

export const EDUCATION = [
  {
    school: 'University of Western Ontario',
    degree: 'Bachelor of Computer Science',
    period: 'Sept 2020 - Jan 2025',
    bullets: ["Varsity Men's Basketball Athlete", 'Bob Gage Athletic Leadership Award Recipient'],
  },
  {
    school: 'Fanshawe College',
    degree: 'AI and Machine Learning Certificate',
    period: 'Jan 2025 - Aug 2025',
    bullets: [],
  },
];

export const PROJECTS = [
  {
    id: 18,
    title: 'Scoreboard Configurator & Admin Layout Editor',
    category: 'Production',
    featured: true,
    description:
      'Web-based scoreboard configurator and internal admin layout editor for customer-facing previews and editable hardware-specific layouts.',
    tech: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'JSON layouts'],
    role: 'Full-stack product engineer',
    metrics: [
      'Model selection and sport-specific layouts',
      'Editable panels, LED digits, labels, logos, and indicators',
      'Reusable model-specific components',
      'Responsive customer previews',
      'JSON-based layout publishing workflows',
    ],
    caseStudy: {
      problem: 'Customers and internal teams needed reliable previews for hardware layouts that vary by model, sport, and physical constraints.',
      approach:
        'Built a component-driven editor with model-specific rendering, JSON layout publishing, and responsive preview surfaces that mirror real scoreboard behavior.',
      outcome:
        'Reduced ambiguity between sales, product, and production by turning configurable hardware layouts into inspectable software workflows.',
      details: ['Hardware-aware UI constraints', 'Reusable layout primitives', 'Preview-to-publishing workflow'],
    },
    cta: null,
  },
  {
    id: 19,
    title: 'Provisioning Operations Console',
    category: 'Production',
    featured: false,
    description:
      'Internal operations console for IoT device provisioning and commissioning with guided operator workflows, live logs, and persistent job history.',
    tech: ['Python', 'RouterOS', 'LoRaWAN', 'TTN', 'PyInstaller'],
    role: 'Operations tooling engineer',
    metrics: ['MikroTik gateway setup', 'SIM activation', 'Water Sniffer validation', 'TTN registration checks', 'Validation reporting'],
    caseStudy: {
      problem: 'Provisioning work had many operator steps across gateways, SIMs, network checks, and device validation.',
      approach:
        'Created guided Python tooling with live logs, repeatable checks, and persistent job history so commissioning steps could be verified consistently.',
      outcome:
        'Made field and production workflows easier to audit, repeat, and debug when devices or network services behaved unexpectedly.',
      details: ['Operator-first workflow', 'Live validation logs', 'Persistent provisioning records'],
    },
    cta: null,
  },
  {
    id: 20,
    title: 'ScoreController',
    category: 'Production',
    featured: false,
    description:
      'Cross-platform scoreboard controller for iOS, Android, and Windows with real-time BLE communication to embedded scoreboard hardware.',
    tech: ['C#', '.NET MAUI', 'XAML', 'MVVM', 'ReactiveUI', 'BLE'],
    role: 'Mobile and systems engineer',
    metrics: ['Hockey, basketball, football, soccer, volleyball, and baseball workflows', 'iOS startup crash fixes', 'MAUI resource loading refactors', 'Play-clock edge case fixes'],
    caseStudy: {
      problem: 'Scoreboard operators need dependable control across sports, devices, and BLE-connected embedded hardware.',
      approach:
        'Improved .NET MAUI app reliability across iOS, Android, and Windows while tightening resource loading, startup behavior, and sport-specific edge cases.',
      outcome:
        'Delivered a steadier controller experience for real-time game operations where timing, device state, and operator confidence matter.',
      details: ['Cross-platform app delivery', 'BLE hardware communication', 'Sport-specific control flows'],
    },
    cta: { label: 'App Store', url: 'https://apps.apple.com/us/app/score-controller/id1563410119' },
  },
  {
    id: 21,
    title: 'Python Production Test Jig',
    category: 'Systems',
    featured: false,
    description:
      'Production test application for embedded sensor board manufacturing with serial protocol validation, firmware programming, and cloud result logging.',
    tech: ['Python', 'Serial Protocols', 'STM32CubeProgrammer', 'DynamoDB', 'Regression Testing'],
    role: 'Production systems engineer',
    metrics: ['Custom 50-byte serial protocol', 'GUI-guided operator checks', 'Checksum and response parsing fixes', 'Binary serialization', 'Regression tests for traceability'],
    caseStudy: {
      problem: 'Manufacturing needed a dependable way to validate embedded boards before they moved deeper into production.',
      approach:
        'Built a GUI-guided Python test application around serial protocol validation, firmware programming, response parsing, and cloud result logging.',
      outcome:
        'Improved traceability and repeatability by turning manual board checks into testable, logged production steps.',
      details: ['Serial protocol validation', 'Firmware programming flow', 'Cloud-backed result logging'],
    },
    cta: null,
  },
  {
    id: 15,
    title: 'Catan Settlement Optimizer',
    category: 'Tools',
    featured: false,
    description:
      'Interactive Catan optimizer that ranks settlement positions using weighted probability, scarcity analysis, and port-aware heuristics.',
    tech: ['JavaScript', 'Canvas API', 'Algorithms'],
    role: 'Solo builder',
    metrics: ['Scarcity scoring', 'Port concentration engine', 'Resource rarity ledger', 'Weighted probability analysis'],
    caseStudy: {
      problem: 'Catan settlement choices are usually judged by instinct, even though board state can be scored systematically.',
      approach:
        'Modeled settlement value with probability weighting, scarcity, port access, and resource concentration to explain stronger opening choices.',
      outcome:
        'Turned a strategy problem into an interactive decision tool that demonstrates algorithmic thinking in a playful format.',
      details: ['Weighted probability scoring', 'Port-aware heuristics', 'Interactive board analysis'],
    },
    cta: { label: 'Try It', url: 'https://peytoncampbell.ca/catan/' },
  },
];

export const TECH_STACK = [
  { name: 'Python', category: 'Languages' },
  { name: 'TypeScript', category: 'Languages' },
  { name: 'JavaScript', category: 'Languages' },
  { name: 'C# / .NET', category: 'Languages' },
  { name: 'React', category: 'Frontend' },
  { name: 'Next.js', category: 'Frontend' },
  { name: 'Tailwind CSS', category: 'Frontend' },
  { name: 'HTML/CSS', category: 'Frontend' },
  { name: 'Responsive UI', category: 'Frontend' },
  { name: 'XAML', category: 'Frontend' },
  { name: 'REST APIs', category: 'Backend & Data' },
  { name: 'SQL', category: 'Backend & Data' },
  { name: 'ETL/data pipelines', category: 'Backend & Data' },
  { name: 'DynamoDB', category: 'Backend & Data' },
  { name: 'AWS IoT', category: 'Backend & Data' },
  { name: 'JSON data flows', category: 'Backend & Data' },
  { name: 'AWS', category: 'Infrastructure' },
  { name: 'Azure DevOps', category: 'Infrastructure' },
  { name: 'CI/CD', category: 'Infrastructure' },
  { name: 'Docker', category: 'Infrastructure' },
  { name: 'Git', category: 'Tools' },
  { name: 'PyInstaller', category: 'Tools' },
  { name: 'Unit testing', category: 'Tools' },
  { name: 'Regression testing', category: 'Tools' },
  { name: 'Agile', category: 'Tools' },
  { name: 'Bluetooth Low Energy', category: 'Systems' },
  { name: 'Serial protocols', category: 'Systems' },
  { name: 'LoRaWAN', category: 'Systems' },
  { name: 'MikroTik RouterOS', category: 'Systems' },
  { name: 'STM32 firmware programming', category: 'Systems' },
];

export const BUILDING_NOW = [
  {
    name: 'Scoreboard configurator',
    status: 'Shipping',
    statusColor: 'green',
    detail: 'React and Next.js product previews, admin layout editing, and JSON publishing workflows.',
    icon: Rocket,
  },
  {
    name: 'ScoreController',
    status: 'Active',
    statusColor: 'green',
    detail: '.NET MAUI scoreboard control across iOS, Android, Windows, BLE, and sport-specific workflows.',
    icon: Brain,
  },
  {
    name: 'Provisioning and test tooling',
    status: 'Active',
    statusColor: 'green',
    detail: 'Python operations tools for IoT commissioning, embedded test jigs, and production traceability.',
    icon: Bot,
  },
];
