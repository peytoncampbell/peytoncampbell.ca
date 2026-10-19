const baseUrl = import.meta.env.BASE_URL

export const profile = {
  name: 'Peyton Campbell',
  role: 'Product engineer in Toronto',
  portrait: `${baseUrl}portrait-1200.webp`,
  location: 'Toronto, Ontario',
  email: 'campbellpeyton042@gmail.com',
  eyebrow: 'Product engineer · Toronto, Ontario',
  headline: 'I build software that earns its place in the workflow.',
  headlineLead: 'I build software that ',
  headlineEmphasis: 'earns its place',
  headlineTail: ' in the workflow.',
  subhead:
    'Founder of Coach AIST. Junior Software Developer at OES. I build product interfaces, cross-platform apps, and the tools that connect them.',
  secondary: "Off the clock, you'll find me here.",
  primaryCta: 'View selected work',
  secondaryCta: 'Cast a line',
  aboutLead: 'I build software that has to work on game day.',
  aboutSecondary:
    'Product engineer in Toronto. I build Coach AIST and ship scoreboard and hardware tools at OES. The work has to hold up in a gym, on a bench, and when the clock is running.',
  aboutPersonal:
    'Basketball at Western shaped how I work: prepare early, take coaching, and make the next play.',
  github: 'https://github.com/peytoncampbell',
  linkedin: 'https://www.linkedin.com/in/peyton-campbell/',
  resume: `${baseUrl}Peyton-Campbell-Resume.pdf`,
  contactNote:
    'Best fit: product engineering roles, internal tools, sports tech, IoT, and automation.',
} as const

export const sectionCopy = {
  workDek:
    'Five projects across product interfaces, connected hardware, and the tools in between.',
  experienceDek:
    'Building product software in Toronto — and staying close to the game.',
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
    title: 'Junior Software Developer',
    period: 'Aug 2025 — Present',
    bullets: [
      'Build and modernize product interfaces across web and cross-platform apps.',
      'Connect scoreboard hardware, APIs, and operator workflows.',
      'Automate production testing and validation with Python.',
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
  { label: 'Day job', value: 'Junior Software Developer at OES' },
  { label: 'Building', value: 'Coach AIST' },
  { label: 'Open to', value: 'Product engineering roles' },
] as const

export const offTheClock = {
  title: 'Off the clock',
  quote:
    'A small interactive detour. A place to think about systems, patience, and better tools.',
  body:
    'I played varsity basketball at Western and still spend time around the game. Fishing, Catan, and small interactive projects all ask the same question: what makes this system worth spending time with?',
  dedication:
    "The dock is based on my grandparents' cottage on Jessups Island, Lake Nipissing.",
  aside:
    'The dock is a small, living thing. Drag to look around, or step into the full experience.',
  interests: ['Basketball', 'Fishing', 'Catan', 'Small interactive things'],
} as const
