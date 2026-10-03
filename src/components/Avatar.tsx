import { User } from '@phosphor-icons/react'
import styles from './Avatar.module.css'

const GRADIENTS = [
  'linear-gradient(135deg, #2f9bff, #5a5bff)',
  'linear-gradient(135deg, #a23cff, #ff5ca8)',
  'linear-gradient(135deg, #ff9d3c, #ff5c5c)',
  'linear-gradient(135deg, #2ecf8f, #18a5c9)',
  'linear-gradient(135deg, #5a5bff, #a23cff)',
  'linear-gradient(135deg, #ffb340, #f2724b)',
]

interface Props {
  seed: string
  /** Имя собеседника; без него — иконка человека. */
  name?: string
  size?: number
}

export function Avatar({ seed, name, size = 48 }: Props) {
  const initials = name ? getInitials(name) : ''
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.38, background: pickGradient(seed) }}
      aria-hidden
    >
      {initials || <User size={size * 0.5} weight="fill" />}
    </span>
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function pickGradient(seed: string): string {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}
