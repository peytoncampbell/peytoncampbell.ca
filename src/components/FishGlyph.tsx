import { useId } from 'react'
import { SPECIES, type SpeciesId } from '../game/species'

interface FishGlyphProps {
  speciesId: SpeciesId
  width?: number
  className?: string
  faded?: boolean
}

export function FishGlyph({ speciesId, width = 64, className, faded = false }: FishGlyphProps) {
  const species = SPECIES[speciesId]
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gradientId = `fish-body-${rawId}`
  const clipId = `fish-clip-${rawId}`
  const bodyPath =
    'M20 25 C27 12.5 49.5 11.5 65.5 20.8 C68.5 22.4 70 24 71.5 25 C68.4 29.8 60 35.6 49 36.6 C35 37.8 24 33.2 20 25 Z'
  const tailPath = 'M20.4 25 L6.8 14.2 C9.8 20.1 9.8 29.9 6.8 35.8 Z'
  const dorsalPath = 'M35 14.2 C38.5 7 44.8 4.8 51 8.2 C46 10.6 41.8 13.2 39.8 16.2 Z'
  const pattern = species.pattern

  return (
    <svg
      width={width}
      height={Math.round(width * 0.6)}
      viewBox="0 0 80 48"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ opacity: faded ? 0.5 : 1 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="38" y1="12" x2="42" y2="39" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={species.palette.back} />
          <stop offset="48%" stopColor={species.palette.mid} />
          <stop offset="100%" stopColor={species.palette.belly} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d={bodyPath} />
        </clipPath>
      </defs>
      <path d={tailPath} fill={species.palette.fin} opacity="0.9" />
      <path d={dorsalPath} fill={species.palette.fin} opacity="0.9" />
      <path d={bodyPath} fill={`url(#${gradientId})`} />
      <g clipPath={`url(#${clipId})`}>
        {pattern === 'bars' &&
          [31, 41, 51, 61].map((x, index) => (
            <rect
              key={x}
              x={x}
              y={12}
              width={index % 2 === 0 ? 3.2 : 2}
              height={24}
              fill={species.palette.accent}
              opacity={0.38}
            />
          ))}
        {pattern === 'stripe' && (
          <path
            d="M24 27.5 C38 29.6 52 29.8 68 25.8"
            stroke={species.palette.accent}
            strokeWidth="3.4"
            fill="none"
            opacity="0.5"
          />
        )}
        {pattern === 'spots' && (
          <>
            {[
              [32, 21, 1.6],
              [37, 29, 1.9],
              [44, 17, 1.4],
              [47, 33, 1.5],
              [54, 22, 1.8],
              [58, 30, 1.4],
              [51, 27, 1.1],
            ].map(([cx, cy, r], index) => (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r={r}
                fill={species.palette.belly}
                opacity="0.72"
              />
            ))}
          </>
        )}
        {pattern === 'mottled' && (
          <>
            <ellipse cx="36" cy="22" rx="5" ry="3" fill={species.palette.accent} opacity="0.35" />
            <ellipse cx="49" cy="19" rx="4" ry="2.4" fill={species.palette.accent} opacity="0.3" />
            <ellipse cx="54" cy="29" rx="5" ry="2.5" fill={species.palette.accent} opacity="0.28" />
          </>
        )}
        {pattern === 'gold' && (
          <>
            <path
              d="M25 27 C39 28.5 52 27.8 67 24.4"
              stroke={species.palette.accent}
              strokeWidth="2.6"
              fill="none"
              opacity="0.6"
            />
            <circle cx="46" cy="21" r="1.3" fill={species.palette.belly} opacity="0.8" />
            <circle cx="55" cy="18" r="1" fill={species.palette.belly} opacity="0.8" />
          </>
        )}
        <path
          d="M27 31 C39 34.2 52 33.8 65 29"
          stroke={species.palette.belly}
          strokeWidth="5"
          fill="none"
          opacity="0.18"
        />
      </g>
      <path
        d={bodyPath}
        fill="none"
        stroke="#0d1413"
        strokeOpacity="0.18"
        strokeWidth="0.8"
      />
      <path
        d="M57.5 25.4 C55 31 50 33.4 45.5 34.2"
        fill="none"
        stroke={species.palette.accent}
        strokeWidth="1"
        opacity="0.45"
      />
      <circle cx="62" cy="23.3" r="1.9" fill="#171b18" />
      <circle cx="62.5" cy="22.8" r="0.55" fill="#f3eee0" opacity="0.8" />
      {speciesId === 'catfish' && (
        <g
          stroke={species.palette.fin}
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        >
          <path d="M67 27.5c4 .6 6.5 2.7 7.5 6" />
          <path d="M66 29.5c3.5 1.8 5.5 4.3 6 7.5" />
          <path d="M67 25c3.4-1.4 6.2-1.4 8.5 0" />
          <path d="M65.5 31.5c2.3 2.5 3.4 5.2 3.6 8" />
        </g>
      )}
      {speciesId === 'pike' && (
        <g fill={species.palette.belly} opacity="0.8">
          <path d="M66 24.2l5 .9-4.8 1.1z" />
        </g>
      )}
    </svg>
  )
}
