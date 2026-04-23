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
  headline: 'Full-stack developer building real products.',
  subheadline:
    'I am a full-stack developer with hands-on experience across frontend, backend, and product delivery. My strongest stack is React, TypeScript, Node.js, and C#/.NET.',
  stats: [
    { label: 'Frontend + backend delivery', icon: Code2 },
    { label: 'React, Node.js, TypeScript, .NET', icon: Brain },
    { label: 'Always learning and improving', icon: Trophy },
  ],
};

export const HIGHLIGHTS = [
  {
    label: 'Jarvis Console',
    detail:
      'Built a Next.js control surface for chat, memory inspection, session management, and cron visibility across a live agent environment.',
    icon: Rocket,
  },
  {
    label: 'Cross-platform product work',
    detail:
      'Ship .NET MAUI apps and operational tooling for scoreboard control, sync, and deployment at OES.',
    icon: Award,
  },
  {
    label: 'Agent infrastructure',
    detail:
      'Run a personal AI system across Telegram, Discord, and Signal with health monitoring, recovery flows, and persistent memory.',
    icon: Database,
  },
];

export const SKILLS = [
  {
    title: 'AI and automation systems',
    tags: ['Python', 'TypeScript', 'Claude API', 'WebSocket', 'Cron'],
    copy:
      'I build agent-driven systems with supervision, recovery paths, and durable operating context rather than one-off demos.',
    icon: Layout,
  },
  {
    title: 'Full-stack engineering',
    tags: ['React', 'Next.js', 'Node.js', 'REST APIs', 'PWA'],
    copy:
      'From responsive interfaces to backend workflows, I build products that feel good to use and hold up operationally.',
    icon: Database,
  },
  {
    title: 'Infrastructure and delivery',
    tags: ['Process Management', 'Cloudflare', 'SQLite', 'Windows Services', 'CI/CD'],
    copy:
      'I care about runbooks, release quality, and the parts of software that keep teams calm after launch.',
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
  { label: 'Focus', value: 'Junior full-stack software roles' },
  { label: 'Status', value: 'Early-career developer growing fast' },
  { label: 'Location', value: 'London, ON with Toronto reach' },
  { label: 'Current', value: 'Building across React, Node.js, TypeScript, and .NET' },
];

export const EXPERIENCE = [
  {
    company: 'OES Inc',
    location: 'London, ON',
    title: 'Full Stack Developer',
    period: 'Aug 2025 - Present',
    bullets: [
      'Build cross-platform .NET MAUI scoreboard control apps with shared libraries and MVVM architecture.',
      'Design REST APIs for real-time sync between hardware, edge devices, and mobile clients.',
      'Automate regression testing in Python, cutting validation time by roughly 40 percent.',
      'Support deployment workflows and release quality for multi-platform product delivery.',
      'Help move legacy product surfaces toward a more modern, maintainable architecture.',
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
    period: '2025',
    bullets: [],
  },
];

export const PROJECTS = [
  {
    id: 16,
    title: 'Jarvis Console',
    category: 'Production',
    featured: true,
    description:
      'Operational console for my agent ecosystem. It centralizes chat, memory browsing, cron visibility, and session control in a single responsive workspace.',
    tech: ['Next.js', 'WebSocket', 'RPC', 'PWA', 'Real-time'],
    role: 'Full-Stack Engineer',
    metrics: [
      'Real-time chat and command surface',
      'Session management across active tools',
      'Memory browser and search',
      'Cron visibility and status',
      'Responsive PWA architecture',
    ],
    cta: { label: 'View Console', url: 'https://peytoncampbell.ca/console/' },
  },
  {
    id: 17,
    title: 'OpenClaw Agent Infrastructure',
    category: 'Production',
    featured: false,
    description:
      'Personal AI agent infrastructure spanning multiple messaging platforms, supervision loops, research tasks, and persistent memory.',
    tech: ['Node.js', 'Python', 'Cron Scheduling', 'Multi-service', 'Cross-platform'],
    role: 'Infrastructure Architect',
    metrics: ['7 supervised services', 'Health monitoring', 'Auto-recovery', 'Research workflows', 'Persistent memory system'],
    cta: null,
  },
  {
    id: 12,
    title: 'AI Personal Assistant (Jarvis)',
    category: 'Tools',
    featured: false,
    description:
      'Multi-platform AI assistant with persistent memory, browser automation, scheduled workflows, and proactive monitoring.',
    tech: ['TypeScript', 'Claude API', 'Playwright', 'Node.js'],
    role: 'Solo builder',
    metrics: ['3 messaging platforms', '8+ service era infrastructure', 'Persistent memory', '24/7 uptime monitoring'],
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
    cta: { label: 'Try It', url: 'https://peytoncampbell.ca/catan/' },
  },
  {
    id: 2,
    title: 'Score Controller',
    category: 'Production',
    featured: false,
    description:
      'Mobile control system for OES scoreboards, designed for responsive game operations and resilient sync across devices.',
    tech: ['iOS', 'Bluetooth/WiFi', 'Real-time Systems'],
    role: 'Full stack / Mobile',
    metrics: ['Latency down 150ms', 'Crash-free sessions up 8%', 'Onboarding time down 30%'],
    cta: { label: 'App Store', url: 'https://apps.apple.com/us/app/score-controller/id1563410119' },
  },
  {
    id: 3,
    title: 'Player Performance Predictor',
    category: 'ML/AI',
    featured: false,
    description:
      'Roster construction engine using XGBoost, feature engineering, and Optuna tuning to predict long-horizon player value.',
    tech: ['Python', 'XGBoost', 'Optuna', 'Pandas'],
    role: 'Data science',
    metrics: ['R^2 0.59 on WAR', 'Optuna search loop', '1k lineup simulations per run'],
    cta: { label: 'View repo', url: 'https://github.com/peytoncampbell' },
  },
];

export const TECH_STACK = [
  { name: 'Python', category: 'Languages' },
  { name: 'TypeScript', category: 'Languages' },
  { name: 'C# / .NET', category: 'Languages' },
  { name: 'Swift', category: 'Languages' },
  { name: 'React', category: 'Frontend' },
  { name: 'Next.js', category: 'Frontend' },
  { name: 'Tailwind', category: 'Frontend' },
  { name: 'scikit-learn', category: 'ML/AI' },
  { name: 'XGBoost', category: 'ML/AI' },
  { name: 'Claude API', category: 'ML/AI' },
  { name: 'OpenAI API', category: 'ML/AI' },
  { name: 'Playwright', category: 'ML/AI' },
  { name: 'PostgreSQL', category: 'Infrastructure' },
  { name: 'SQLite', category: 'Infrastructure' },
  { name: 'Docker', category: 'Infrastructure' },
  { name: 'Node.js', category: 'Infrastructure' },
  { name: 'Cloudflare', category: 'Infrastructure' },
  { name: 'Vercel', category: 'Infrastructure' },
  { name: 'Playwright', category: 'Tools' },
  { name: 'Git', category: 'Tools' },
];

export const BUILDING_NOW = [
  {
    name: 'Jarvis Console',
    status: 'Live',
    statusColor: 'green',
    detail: 'Control surface for chat, memory, sessions, and scheduled workflows.',
    icon: Rocket,
  },
  {
    name: 'Agent Infrastructure',
    status: 'Live',
    statusColor: 'green',
    detail: 'Supervision, recovery, and multi-platform automation across 7 active services.',
    icon: Brain,
  },
  {
    name: 'Job Hunt Pipeline',
    status: 'Active',
    statusColor: 'green',
    detail: 'Automated job discovery, scoring, and application tracking.',
    icon: Bot,
  },
];

export const BLOG_POSTS = [
  {
    title: 'How I Keep an Agent Stack Operable',
    date: 'Draft',
    readTime: 'In progress',
    excerpt:
      'Notes on supervision, recovery paths, and why the boring operational layer matters more than the demo.',
    tags: ['Automation', 'Infra', 'Systems'],
    href: null,
  },
  {
    title: 'Designing a Useful AI Control Surface',
    date: 'Draft',
    readTime: 'In progress',
    excerpt:
      'What I learned building Jarvis Console: what belongs in a workspace, what belongs in logs, and what should stay out of the UI.',
    tags: ['Product', 'UI', 'AI'],
    href: null,
  },
  {
    title: 'What Shipping Cross-Platform Software Taught Me',
    date: 'Draft',
    readTime: 'In progress',
    excerpt:
      'A practical look at product reliability, release discipline, and why platform work changes how you think about engineering.',
    tags: ['Product', 'Delivery', 'Engineering'],
    href: null,
  },
];
