import type { Project } from './content'

const line = 'pv-line'
const faint = 'pv-faint'
const accent = 'pv-accent'

function Configurator() {
  return (
    <>
      <rect x="46" y="44" width="428" height="212" rx="2" className={faint} />
      <rect x="62" y="60" width="150" height="180" rx="1" className={line} />
      <rect x="228" y="60" width="230" height="96" rx="1" className={line} />
      <rect x="228" y="172" width="106" height="68" rx="1" className={line} />
      <rect x="350" y="172" width="108" height="68" rx="1" className={line} />
      <rect x="76" y="76" width="54" height="22" rx="1" className={accent} />
      <rect x="138" y="76" width="58" height="22" rx="1" className={line} />
      <rect x="76" y="110" width="36" height="116" rx="1" className={faint} />
      <rect x="122" y="110" width="74" height="116" rx="1" className={faint} />
      <path d="M246 78h194M246 96h194M246 114h194M246 132h194" className={faint} />
      <path d="M246 78v72M278 78v72M310 78v72M342 78v72M374 78v72M406 78v72M438 78v72" className={faint} />
      <path d="M240 148h206" className={line} />
      <path d="M240 84h206v116H240z" className={accent} strokeDasharray="3 5" />
      <path d="M251 190h68M366 190h76M251 204h42M366 204h58" className={line} />
      <circle cx="442" cy="90" r="3" className={`${accent} pv-dot`} />
      <text x="62" y="274" className="pv-label">SCOREBOARD / LAYOUT</text>
      <text x="384" y="274" className="pv-label">A1—A8</text>
    </>
  )
}

function Controller() {
  return (
    <>
      <rect x="46" y="44" width="428" height="212" rx="2" className={faint} />
      <path d="M118 78c34 16 54 40 54 84s-20 68-54 84" className={faint} strokeDasharray="2 7" />
      <path d="M94 96c22 12 34 32 34 66s-12 54-34 66" className={faint} strokeDasharray="2 7" />
      <rect x="202" y="64" width="120" height="176" rx="9" className={line} />
      <rect x="216" y="78" width="92" height="148" rx="4" className={faint} />
      <rect x="228" y="92" width="68" height="38" rx="2" className={line} />
      <path d="M238 114h18M270 114h16" className={accent} strokeWidth="3" />
      <rect x="228" y="144" width="30" height="24" rx="1" className={line} />
      <rect x="266" y="144" width="30" height="24" rx="1" className={line} />
      <circle cx="262" cy="195" r="18" className={line} />
      <circle cx="262" cy="195" r="8" className={accent} />
      <path d="M334 86h36M334 102h58M334 118h44" className={faint} />
      <path d="M370 164l20 20 42-58" className={`${accent} pv-check`} />
      <text x="62" y="274" className="pv-label">REMOTE / OFFLINE FIRST</text>
      <text x="386" y="274" className="pv-label">SYNC</text>
    </>
  )
}

function Provisioning() {
  return (
    <>
      <rect x="46" y="44" width="428" height="212" rx="2" className={faint} />
      <rect x="64" y="62" width="126" height="176" rx="1" className={line} />
      <path d="M78 82h98M78 96h72M78 110h88" className={faint} />
      <path d="M78 148h42M78 162h62M78 176h48" className={accent} />
      <path d="M190 106h54M190 194h54" className={faint} strokeDasharray="3 5" />
      <rect x="244" y="82" width="76" height="48" rx="1" className={line} />
      <rect x="244" y="170" width="76" height="48" rx="1" className={line} />
      <path d="M320 106h54M320 194h54" className={faint} strokeDasharray="3 5" />
      <rect x="374" y="76" width="76" height="60" rx="1" className={line} />
      <rect x="374" y="164" width="76" height="60" rx="1" className={line} />
      <path d="M392 96h40M392 108h24M392 184h40M392 196h16" className={faint} />
      <circle cx="282" cy="106" r="4" className={accent} />
      <circle cx="282" cy="194" r="4" className={accent} />
      <path d="M332 106h16M332 194h16M404 106h16M404 194h16" className={faint} />
      <path d="M412 84v44" className={accent} strokeDasharray="2 4" />
      <text x="62" y="274" className="pv-label">DEVICE OPERATIONS</text>
      <text x="384" y="274" className="pv-label">01 / 04</text>
    </>
  )
}

function TestJig() {
  return (
    <>
      <rect x="46" y="44" width="428" height="212" rx="2" className={faint} />
      <path d="M64 68h392" className={faint} />
      <path d="M80 100h64M160 100h64M240 100h64M320 100h64M400 100h40" className={faint} />
      <path d="M80 136h64M160 136h64M240 136h64M320 136h64M400 136h40" className={faint} />
      <path d="M80 172h64M160 172h64M240 172h64M320 172h64M400 172h40" className={faint} />
      <path d="M80 208h56" className={line} />
      <path d="M88 212v-22M96 212v-34M104 212v-14M112 212v-28M120 212v-20M128 212v-38" className={accent} strokeWidth="2" />
      <path d="M174 206l10 10 20-26" className={`${accent} pv-check`} />
      <path d="M270 206l10 10 20-26" className={`${accent} pv-check`} />
      <circle cx="398" cy="208" r="14" className={line} />
      <circle cx="398" cy="208" r="5" className={accent} />
      <text x="62" y="274" className="pv-label">SIGNAL / VALIDATE / SHIP</text>
      <text x="392" y="274" className="pv-label">PASS 02</text>
    </>
  )
}

function Catan() {
  const centers = [
    [188, 96],
    [232, 96],
    [276, 96],
    [210, 134],
    [254, 134],
    [298, 134],
    [232, 172],
    [276, 172],
  ]
  return (
    <>
      <rect x="46" y="44" width="428" height="212" rx="2" className={faint} />
      {centers.map(([cx, cy], index) => (
        <path
          key={`${cx}-${cy}`}
          d={`M${cx} ${cy - 30}l26 15v30l-26 15-26-15v-30z`}
          className={index === 3 ? accent : line}
        />
      ))}
      {centers.slice(0, 3).map(([cx, cy], index) => (
        <circle key={index} cx={cx} cy={cy} r="3.5" className={accent} />
      ))}
      <path d="M226 148l22-14 18 10" className={`${accent} pv-route`} />
      <circle cx="230" cy="152" r="7" className={accent} />
      <circle cx="230" cy="152" r="12" className={faint} />
      <path d="M338 82h78M338 100h54M338 118h68" className={faint} />
      <path d="M338 156h94M338 174h60M338 192h80" className={faint} />
      <text x="338" y="140" className="pv-label">SCARCITY / PORTS</text>
      <text x="62" y="274" className="pv-label">BOARD / PROBABILITY</text>
      <text x="390" y="274" className="pv-label">6 PLAYERS</text>
    </>
  )
}

export function ProjectVisual({ id }: { id: Project['id'] }) {
  const content =
    id === 'configurator' ? (
      <Configurator />
    ) : id === 'controller' ? (
      <Controller />
    ) : id === 'provisioning' ? (
      <Provisioning />
    ) : id === 'test-jig' ? (
      <TestJig />
    ) : (
      <Catan />
    )

  return (
    <svg
      className={`project-visual project-visual-${id}`}
      viewBox="0 0 520 300"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {content}
    </svg>
  )
}
