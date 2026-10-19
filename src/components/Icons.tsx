interface IconProps {
  size?: number
  className?: string
}

import type { ReactNode } from 'react'

function Svg({
  size = 18,
  className,
  children,
  viewBox = '0 0 24 24',
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconSun = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="4.1" />
    <path d="M12 2.6v2.1M12 19.3v2.1M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5" />
  </Svg>
)

export const IconDusk = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 17.5h16M7 17.5a5 5 0 0 1 10 0" />
    <path d="M12 4v2.3M5.8 7.2l1.6 1.6M18.2 7.2l-1.6 1.6M3 21h18" />
  </Svg>
)

export const IconMoon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20.2 14.2A8.2 8.2 0 0 1 9.8 3.8a8.3 8.3 0 1 0 10.4 10.4Z" />
    <path d="M16.8 4.2v1.4M16.1 4.9h1.4" />
  </Svg>
)

export const IconWaves = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 9.5c2.1 0 2.1 1.6 4.2 1.6s2.1-1.6 4.2-1.6 2.1 1.6 4.2 1.6 2.1-1.6 4.2-1.6" />
    <path d="M3 15c2.1 0 2.1 1.6 4.2 1.6s2.1-1.6 4.2-1.6 2.1 1.6 4.2 1.6 2.1-1.6 4.2-1.6" />
  </Svg>
)

export const IconRain = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6.5 15.5a3.5 3.5 0 0 1-.4-7 5.2 5.2 0 0 1 10-1.2 3.6 3.6 0 0 1 .8 7.1" />
    <path d="M8 18.4l-.8 1.8M12 18.4l-.8 1.8M16 18.4l-.8 1.8" />
  </Svg>
)

export const IconMist = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 8.5h12.5M6.5 12h14M3 15.5h10.5M8 19h13" />
  </Svg>
)

export const IconCamera = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7.5h3l1.3-2h7.4l1.3 2h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 18.5H4A1.5 1.5 0 0 1 2.5 17V9A1.5 1.5 0 0 1 4 7.5Z" />
    <circle cx="12" cy="13" r="3.4" />
    <path d="M19 10.5h.01" />
  </Svg>
)

export const IconSound = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 9.5v5h3l4.2 3.4V6.1L7.5 9.5h-3Z" />
    <path d="M15.3 9a4.2 4.2 0 0 1 0 6M17.8 6.5a7.6 7.6 0 0 1 0 11" />
  </Svg>
)

export const IconMute = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 9.5v5h3l4.2 3.4V6.1L7.5 9.5h-3Z" />
    <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
  </Svg>
)

export const IconBook = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 5.2c3-1.3 5.6-1.3 8 0 2.4-1.3 5-1.3 8 0v13.4c-3-1.3-5.6-1.3-8 0-2.4-1.3-5-1.3-8 0V5.2Z" />
    <path d="M12 5.2V18.6" />
  </Svg>
)

export const IconSliders = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 4v5.2M5 13.8V20M12 4v8.2M12 16.8V20M19 4v2.2M19 10.8V20" />
    <circle cx="5" cy="11.5" r="1.6" />
    <circle cx="12" cy="14.5" r="1.6" />
    <circle cx="19" cy="8.5" r="1.6" />
  </Svg>
)

export const IconHelp = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.7 9.2a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.3 1-1.3 2" />
    <path d="M12 17.1h.01" />
  </Svg>
)

export const IconClose = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconHook = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 4c1.5-.9 3.2.2 3.2 1.9 0 2.8-2.7 5.1-2.7 8.4A4.2 4.2 0 0 0 9.7 18a4.2 4.2 0 0 0 4.2-4.2V5.5" />
    <path d="M9.6 6.8h4.4M4 4.2 6.8 6" />
  </Svg>
)

export const IconLeaf = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 4.5c-8.8-.6-14.8 3.7-14.8 9.2A5.3 5.3 0 0 0 10.5 19C16 19 19.6 13 20 4.5Z" />
    <path d="M4 21c2.2-5.6 6.4-9.5 12-12" />
  </Svg>
)

export const IconReset = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 9.2A8 8 0 1 1 4 14" />
    <path d="M4.2 4.6v4.8h4.8" />
  </Svg>
)

export const IconCompass = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.7 8.3 13.5 13.5 8.3 15.7l2.2-5.2 5.2-2.2Z" />
  </Svg>
)

export const IconSparkle = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.2c.6 4.9 2 6.3 6.9 6.9-4.9.6-6.3 2-6.9 6.9-.6-4.9-2-6.3-6.9-6.9 4.9-.6 6.3-2 6.9-6.9Z" />
    <path d="M18.5 16.5c.2 1.7.8 2.3 2.5 2.5-1.7.2-2.3.8-2.5 2.5-.2-1.7-.8-2.3-2.5-2.5 1.7-.2 2.3-.8 2.5-2.5Z" />
  </Svg>
)

export const IconWorm = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 15.5c0-2 1.7-3.5 3.8-3.5s3.8 1.5 3.8 3.5-1.7 3.5-3.8 3.5H7" />
    <path d="M8.3 12V6.8a2.4 2.4 0 0 1 4.8 0v6.4a2 2 0 0 0 4 0V8.5" />
    <path d="M16.5 4.2v.01M20 7.8v.01" />
  </Svg>
)

export const IconArrow = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 12h16M14.5 6.5 20 12l-5.5 5.5" />
  </Svg>
)

export const IconCheck = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4.5 12.5 9.5 17.5 20 6.5" />
  </Svg>
)
