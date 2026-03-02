import { Code2, Database, Trophy, Brain, Layout, Users, Compass, Target, Zap, RefreshCw, Sparkles, Award, Rocket, Globe, Bot, Briefcase } from 'lucide-react';

export const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Dashboard', href: '#dashboard' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
  { label: 'My Story', href: '#duality' },
  { label: 'Contact', href: '#contact' },
];

export const HERO = {
  headline: 'I build things that work autonomously.',
  subheadline:
    'Full-stack engineer building autonomous trading systems on Polymarket. I design systems that copy whale trades, manage risk, and profit — without human intervention.',
  stats: [
    { label: '4+ Live Positions', icon: Code2 },
    { label: 'Whale Copy-Trading System', icon: Brain },
    { label: '$4532.72+ Resolved Profit', icon: Trophy },
  ],
};

export const HIGHLIGHTS = [
  {
    label: '24/7 Whale Copy-Trading Bot',
    detail: 'Polymarket prediction market bot copying whale trades with gasless relays, proxy wallet architecture, and real USDC profit.',
    icon: Sparkles,
  },
  {
    label: 'Shipped cross-platform MAUI apps',
    detail: 'Shared libraries, MVVM, and offline-first sync at OES.',
    icon: Award,
  },
  {
    label: 'AI-Powered Automation',
    detail: 'Personal AI agent running 24/7 across Telegram, Discord, and Signal with persistent memory.',
    icon: Database,
  },
];

export const SKILLS = [
  {
    title: 'Autonomous Trading Systems',
    tags: ['Python', 'Web3', 'Polymarket', 'Trading Bots', 'Dashboards'],
    copy: 'Building whale copy-trading systems on Polymarket with gasless relays, proxy wallets, and 9 supervised services. From on-chain trade copying to real-time dashboards — I ship production systems that run 24/7.',
    icon: Layout,
  },
  {
    title: 'Data & ML Intelligence',
    tags: ['Python', 'scikit-learn', 'XGBoost', 'Regime Detection', 'NLP'],
    copy: '62,000+ trades executed across 23 ML strategies. Real-time regime detection, feature engineering on market microstructure, and transformer-based sentiment analysis.',
    icon: Database,
  },
  {
    title: 'Leadership & Strategy',
    tags: ['Consulting', 'Campbell Solutions', 'Agile', 'Team Strategy'],
    copy: 'Running Campbell Solutions for consulting engagements. Translating athletic discipline into development velocity — bridging complex technical systems with business outcomes.',
    icon: Users,
  },
];

export const SCOUTING_REPORT = [
  { axis: 'Frontend', value: 0.9, fullMark: 1 },
  { axis: 'Backend', value: 0.85, fullMark: 1 },
  { axis: 'ML / AI', value: 0.92, fullMark: 1 },
  { axis: 'Architecture', value: 0.85, fullMark: 1 },
  { axis: 'Leadership', value: 0.95, fullMark: 1 },
  { axis: 'Data Eng', value: 0.85, fullMark: 1 },
  { axis: 'Trading Systems', value: 0.88, fullMark: 1 },
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
    description: 'Inspect outcomes, capture lessons, and feed insights back into the next scouting cycle.',
    deliverable: 'Post-launch scorecard + retro',
    icon: RefreshCw,
  },
];

export const LIVE_STATUS = [
  { label: 'Focus', value: 'Polymarket + Autonomous Systems' },
  { label: 'Status', value: 'Building 24/7' },
  { label: 'Location', value: 'London, ON → Toronto' },
  { label: 'Bot', value: '4+ live positions' },
];

export const EXPERIENCE = [
  {
    company: 'OES Inc',
    location: 'London, ON',
    title: 'Full Stack Developer',
    period: 'Aug 2025 - Present',
    description: 'Building next-gen scoreboard control software.',
    bullets: [
      'Automated regression testing in Python, cutting validation time by 40% while improving defect catch rate.',
      'Modernizing legacy codebases into cross-platform .NET MAUI apps using MVVM and shared component libraries.',
      'Architecting REST APIs to sync scoreboard hardware, edge devices, and mobile clients in real time.',
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
    degree: 'AI & Machine Learning Certificate',
    period: '2025',
    bullets: [],
  },
];

export const PROJECTS = [
  {
    id: 10,
    title: 'Whale Copy-Trading System',
    category: 'ML/AI',
    featured: true,
    description: 'Live Polymarket prediction market system that copies trades from a high-performing whale wallet. Gasless relay execution via proxy wallet, automated position management, and real USDC profit. Running 24/7 with 9 supervised services.',
    tech: ['Python', 'Web3', 'Polymarket CLOB', 'Polygon', 'Cloudflare'],
    role: 'Solo builder',
    metrics: ['4+ live positions', '$4532.72+ resolved profit (1989W/3649L)', 'Gasless relay execution', 'Proxy wallet architecture', '0 supervised services'],
    cta: null,
  },
  {
    id: 14,
    title: 'Campbell Solutions',
    category: 'Production',
    featured: false,
    description:
      'Technology consulting practice offering full-stack development, AI/ML integration, and trading system architecture for businesses and startups.',
    tech: ['React', 'Next.js', 'Python', 'AI/ML', 'Consulting'],
    role: 'Founder',
    metrics: ['Full-stack consulting', 'AI integration', 'Trading systems'],
    cta: { label: 'Visit Site', url: 'https://campbell-solutions.vercel.app' },
  },
  {
    id: 12,
    title: 'AI Personal Assistant (Jarvis)',
    category: 'Tools',
    featured: false,
    description:
      'Multi-platform AI agent with persistent memory, cron scheduling, autonomous job applications across 6 ATS platforms, browser automation, and proactive monitoring.',
    tech: ['TypeScript', 'Claude API', 'Playwright', 'Node.js'],
    role: 'Solo builder',
    metrics: ['3 platforms (Telegram/Discord/Signal)', '6 ATS integrations', 'Persistent memory', '24/7 uptime'],
    cta: null,
  },
  {
    id: 13,
    title: 'Real-Time Trading Dashboard',
    category: 'Production',
    featured: false,
    description: 'Live performance dashboard for autonomous trading systems. Real-time data through Cloudflare tunnel, P&L tracking, trade history, and system monitoring.',
    tech: ['Next.js', 'TypeScript', 'Tailwind', 'Cloudflare Tunnel', 'Vercel'],
    role: 'Solo builder',
    metrics: ['Real-time data via tunnel', 'Auto-refresh', 'Mobile responsive'],
    cta: { label: 'View Live', url: 'https://peytoncampbell.ca/dash/' },
  },
  {
    id: 15,
    title: 'Catan Settlement Optimizer',
    category: 'Tools',
    featured: false,
    description: 'Interactive 6-player Catan board optimizer with dynamic scarcity scoring, port concentration engine, resource rarity ledger, and weighted probability analysis. Generates random boards and ranks optimal settlement placements.',
    tech: ['JavaScript', 'Canvas API', 'Algorithms'],
    role: 'Solo builder',
    metrics: ['Dynamic scarcity scoring', 'Port concentration engine', 'Resource rarity ledger', 'Weighted probability analysis'],
    cta: { label: 'Try It', url: 'https://peytoncampbell.ca/catan/' },
  },
  {
    id: 1,
    title: 'Topspin360',
    category: 'Production',
    featured: false,
    description:
      'iOS app migration and full development. Dedicated neck-strength training tool for athletes; shipped analytics and improved crash-free sessions.',
    tech: ['Swift', 'iOS', 'Mobile Architecture'],
    role: 'Mobile lead',
    metrics: ['Crash-free sessions +8%', 'Avg session length +12%', 'User NPS +0.6'],
    cta: { label: 'App Store', url: 'https://apps.apple.com/ca/app/topspin360/id1281507774' },
  },
  {
    id: 2,
    title: 'Score Controller',
    category: 'Production',
    featured: false,
    description:
      'Real-time mobile control system for OES scoreboards, enabling remote game data management with offline-first sync.',
    tech: ['iOS', 'Bluetooth/WiFi', 'Real-time Systems'],
    role: 'Full stack / Mobile',
    metrics: ['Action latency -150ms', 'Crash-free sessions +8%', 'Onboarding time -30%'],
    cta: { label: 'App Store', url: 'https://apps.apple.com/us/app/score-controller/id1563410119' },
  },
  {
    id: 3,
    title: 'Player Performance Predictor',
    category: 'ML/AI',
    featured: false,
    description:
      'Roster construction engine with WAR predictions (R^2 0.59) using XGBoost, feature engineering, and Optuna tuning.',
    tech: ['Python', 'XGBoost', 'Optuna', 'Pandas'],
    role: 'Data science',
    metrics: ['R^2 0.59 on WAR', 'Hyperparameter search via Optuna', '1k lineup sims/run'],
    cta: { label: 'View repo', url: 'https://github.com/peytoncampbell' },
  },
  {
    id: 4,
    title: 'Customer Sentiment Analyzer',
    category: 'ML/AI',
    featured: false,
    description:
      'Multi-channel sentiment classifier fine-tuned on support tickets; delivered 85% accuracy and a real-time insights dashboard.',
    tech: ['Transformers', 'Python', 'TensorFlow', 'NLP'],
    role: 'ML engineer',
    metrics: ['Accuracy 85%', 'Latency <300ms p95', 'Coverage: email + chat + reviews'],
    cta: { label: 'View repo', url: 'https://github.com/peytoncampbell' },
  },
];

export const TECH_STACK = [
  { name: 'Python', category: 'Languages' },
  { name: 'TypeScript', category: 'Languages' },
  { name: 'C# / .NET', category: 'Languages' },
  { name: 'React', category: 'Frontend' },
  { name: 'Next.js', category: 'Frontend' },
  { name: 'Tailwind', category: 'Frontend' },
  { name: 'scikit-learn', category: 'ML/AI' },
  { name: 'XGBoost', category: 'ML/AI' },
  { name: 'Claude API', category: 'ML/AI' },
  { name: 'Binance API', category: 'Trading' },
  { name: 'OKX API', category: 'Trading' },
  { name: 'Polymarket', category: 'Trading' },
  { name: 'Web3', category: 'Trading' },
  { name: 'PostgreSQL', category: 'Infrastructure' },
  { name: 'Cloudflare', category: 'Infrastructure' },
  { name: 'Vercel', category: 'Infrastructure' },
  { name: 'Playwright', category: 'Tools' },
  { name: 'Git', category: 'Tools' },
];

export const BUILDING_NOW = [
  {
    name: 'Whale Copy-Trading',
    status: 'Live',
    statusColor: 'green',
    detail: '4+ positions, $4532.72+ resolved profit, real USDC',
    icon: Rocket,
  },
  {
    name: 'Jarvis AI Agent',
    status: 'Live',
    statusColor: 'green',
    detail: 'OpenClaw-powered agent across Telegram/Signal/Discord',
    icon: Brain,
  },
  {
    name: 'Catan Optimizer',
    status: 'Live',
    statusColor: 'green',
    detail: 'Dynamic scarcity scoring, port engine, rarity ledger',
    icon: Bot,
  },
];

export const BLOG_POSTS = [
  {
    title: 'How I Built a Whale Copy-Trading System on Polymarket',
    date: 'Feb 2026',
    readTime: '8 min',
    excerpt: 'Architecture deep-dive: gasless relays, proxy wallets, on-chain trade detection, and turning whale alpha into real USDC profit.',
    tags: ['Python', 'Web3', 'Trading'],
    href: '#'
  },
  {
    title: 'Running 9 Services on a Single Machine with a Custom Supervisor',
    date: 'Feb 2026',
    readTime: '6 min',
    excerpt: 'How I built a process supervisor managing signal engines, traders, WebSocket listeners, and API servers — with health checks, auto-restart, and Windows Task Scheduler integration.',
    tags: ['Infrastructure', 'Python', 'DevOps'],
    href: '#'
  },
  {
    title: 'Building Jarvis: An AI Agent That Runs My Digital Life',
    date: 'Feb 2026',
    readTime: '5 min',
    excerpt: 'From Telegram to Discord to Signal — building a persistent-memory AI assistant with autonomous job applications, browser automation, and proactive monitoring.',
    tags: ['AI', 'TypeScript', 'Automation'],
    href: '#'
  }
];
