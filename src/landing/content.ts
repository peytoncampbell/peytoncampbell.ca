const baseUrl = import.meta.env.BASE_URL

export const profile = {
  name: 'Peyton Campbell',
  role: 'Full-stack software developer at OES',
  location: 'London, Ontario',
  email: 'campbellpeyton042@gmail.com',
  eyebrow: 'Full-stack developer · London, Ontario',
  headline: 'I build software that earns its place in the workflow.',
  headlineLead: 'I build software that ',
  headlineEmphasis: 'earns its place',
  headlineTail: ' in the workflow.',
  subhead:
    'Product interfaces, cross-platform apps, and internal tools for sports technology and IoT.',
  secondary: "Off the clock, you'll find me here.",
  primaryCta: 'View selected work',
  secondaryCta: 'Cast a line',
  aboutLead:
    'I work across web, mobile, and internal tooling for sports technology and IoT. I like problems where the interface has to meet real hardware, real operators, and real deadlines.',
  aboutSecondary:
    'Most of my work sits between the screen and the thing it controls — scoreboards, edge devices, test benches, and the people running them. I care about clear states, honest feedback, and tools that get out of the way.',
  focus: ['React / Next.js', '.NET MAUI', 'Python', 'IoT tooling', 'Sports technology'],
  github: 'https://github.com/peytoncampbell',
  linkedin: 'https://www.linkedin.com/in/peyton-campbell/',
  resume: `${baseUrl}Peyton-Campbell-Resume.pdf`,
  contactNote:
    'Best fit: full-stack product roles, internal tools, sports tech, IoT, and automation.',
} as const

export const sectionCopy = {
  workDek:
    'Five projects across product interfaces, connected hardware, and the tools in between.',
  experienceDek:
    'Building product software in London, Ontario — and staying close to the game.',
  contactDek:
    'The best way to reach me is email. I’m open to conversations about product work, internal tools, and teams building close to hardware.',
} as const

export const navItems = [
  { label: 'About', href: '#about' },
  { label: 'Work', href: '#work' },
  { label: 'Experience', href: '#experience' },
  { label: 'Contact', href: '#contact' },
] as const

export interface Project {
  id: 'configurator' | 'controller' | 'provisioning' | 'test-jig' | 'catan'
  title: string
  summary: string
  role: string
  context: string
  tech: string[]
  href?: string
  linkLabel?: string
}

export const projects: Project[] = [
  {
    id: 'configurator',
    title: 'Scoreboard Configurator & Admin Layout Editor',
    summary:
      'A browser-based configurator and layout editor that lets operators set up scoreboards without hand-editing configuration files.',
    role: 'Full-stack developer',
    context: 'OES · internal product',
    tech: ['React', '.NET', 'Layout tooling', 'Scoreboards'],
  },
  {
    id: 'controller',
    title: 'ScoreController',
    summary:
      'A real-time mobile control system for OES scoreboards, built for remote game data management and offline-first sync.',
    role: 'Full-stack / mobile',
    context: 'OES · shipped app',
    tech: ['iOS', 'Bluetooth / WiFi', 'Offline-first', 'Real-time'],
    href: 'https://apps.apple.com/us/app/score-controller/id1563410119',
    linkLabel: 'View on the App Store',
  },
  {
    id: 'provisioning',
    title: 'Provisioning Operations Console',
    summary:
      'An internal console for provisioning and managing connected scoreboard hardware, replacing repetitive manual setup with a single operations view.',
    role: 'Full-stack developer',
    context: 'OES · internal product',
    tech: ['React', '.NET', 'REST APIs', 'IoT provisioning'],
  },
  {
    id: 'test-jig',
    title: 'Python Production Test Jig',
    summary:
      'A Python test jig that exercises production hardware before it ships, turning a manual checklist into a repeatable validation step.',
    role: 'Tooling',
    context: 'OES · production tooling',
    tech: ['Python', 'Hardware I/O', 'Automation', 'Production testing'],
  },
  {
    id: 'catan',
    title: 'Catan Settlement Optimizer',
    summary:
      'A browser tool that scores Catan boards and ranks settlement placements against scarcity, ports, and resource probability.',
    role: 'Solo builder',
    context: 'Personal project',
    tech: ['JavaScript', 'Canvas API', 'Algorithms'],
    href: 'https://peytoncampbell.ca/catan/',
    linkLabel: 'Open the optimizer',
  },
]

export interface ExperienceEntry {
  company: string
  title: string
  period: string
  bullets: string[]
}

export const experience: ExperienceEntry[] = [
  {
    company: 'OES',
    title: 'Full Stack Software Developer',
    period: 'Aug 2025 — Present',
    bullets: [
      'Build and modernize product interfaces across web and cross-platform apps.',
      'Connect scoreboard hardware, APIs, and operator workflows.',
      'Automate production testing and validation with Python.',
    ],
  },
  {
    company: "Western Men's Basketball",
    title: 'Head of Data Analytics',
    period: 'Aug 2023 — Present',
    bullets: [
      'Lead analytics for the men’s basketball program.',
      'Build reporting and preparation tools for coaches.',
    ],
  },
]

export const education = [
  {
    school: 'Western University',
    credential: 'BSc Computer Science',
    period: '2020 — 2025',
  },
  {
    school: 'Fanshawe College',
    credential: 'AI & Machine Learning Certificate',
    period: '2025',
  },
] as const

export const facts = [
  { label: 'Based', value: 'London, Ontario' },
  { label: 'Day job', value: 'Full-stack at OES' },
  { label: 'Education', value: 'BSc Computer Science, Western University' },
  { label: 'Before', value: 'Varsity basketball player' },
  { label: 'Also', value: "Analytics for Western men's basketball" },
] as const

export const offTheClock = {
  title: 'Off the clock',
  quote:
    'A small interactive detour. A place to think about systems, patience, and better tools.',
  body:
    'I played varsity basketball at Western and still spend time around the game. Fishing, Catan, and small interactive projects all ask the same question: what makes this system worth spending time with?',
  aside:
    'The dock is a small, living thing. Drag to look around, or step into the full experience.',
  interests: ['Basketball', 'Fishing', 'Catan', 'Small interactive things'],
} as const
