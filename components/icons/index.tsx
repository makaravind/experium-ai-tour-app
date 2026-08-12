import type { CSSProperties } from 'react'

export interface IconProps {
  size?: number
  color?: string
  strokeWidth?: number
  className?: string
  style?: CSSProperties
}

// ─── stroke icons ─────────────────────────────────────────────────────────────

function Stroke({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
  className,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Leaf with stem — app logo / milestone badge */
export function LeafIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 2C7 7 5 11 5 15a7 7 0 0 0 14 0c0-4-2-8-7-13Z" />
      <path d="M12 22V9" />
    </Stroke>
  )
}

/** Leaf outline only — exhibit type chip */
export function LeafOutlineIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 2C7 7 5 11 5 15a7 7 0 0 0 14 0c0-4-2-8-7-13Z" />
    </Stroke>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
    </Stroke>
  )
}

export function ScanIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M4 12h16" />
    </Stroke>
  )
}

export function MapIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" />
      <path d="M9 3v16M15 5v16" />
    </Stroke>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3-3" />
    </Stroke>
  )
}

export function CompassIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="5" />
    </Stroke>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Stroke>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <path d="m6 9 6 6 6-6" />
    </Stroke>
  )
}

// ─── filled icons ─────────────────────────────────────────────────────────────

export function PlayIcon({ size = 24, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export function PauseIcon({ size = 24, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function StarIcon({ size = 24, color = 'currentColor', className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 17l-5.5 2.5 1-6.3L3 8.9 9 8z" />
    </svg>
  )
}

/** Map pin — fill is the state colour, stroke is always the white outline */
export function PinIcon({
  width = 40,
  height = 50,
  fill = 'currentColor',
  style,
}: {
  width?: number
  height?: number
  fill?: string
  style?: CSSProperties
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 30 38" style={style} aria-hidden="true">
      <path
        d="M15 1C7 1 1 7 1 15c0 9 14 22 14 22s14-13 14-22C29 7 23 1 15 1Z"
        fill={fill}
        stroke="#fff"
        strokeWidth="2.4"
      />
      <circle cx="15" cy="15" r="5" fill="#fff" />
    </svg>
  )
}
