import Link from 'next/link'
import type { MouseEventHandler, ReactNode } from 'react'

export type ActionButtonVariant = 'orange' | 'ink'

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  orange: 'btn-3d-orange bg-ex-orange',
  ink: 'btn-3d-ink bg-ex-ink',
}

interface ActionButtonProps {
  variant?: ActionButtonVariant
  href?: string
  onClick?: MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit'
  height?: number
  fontSize?: number
  uppercase?: boolean
  className?: string
  children: ReactNode
}

export default function ActionButton({
  variant = 'orange',
  href,
  onClick,
  type = 'button',
  height = 66,
  fontSize = 18,
  uppercase = false,
  className = '',
  children,
}: ActionButtonProps) {
  const classes = [
    'flex items-center justify-center gap-2.5 w-full rounded-2xl text-white font-extrabold',
    uppercase ? 'uppercase tracking-wide' : '',
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const style = { height, fontSize }

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} className={classes} style={style}>
      {children}
    </button>
  )
}
