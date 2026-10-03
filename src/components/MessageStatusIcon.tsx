import { Check, Checks, Clock, WarningCircle } from '@phosphor-icons/react'
import type { MessageStatus } from '../state/chats'
import styles from './MessageStatusIcon.module.css'

const LABELS: Record<MessageStatus, string> = {
  pending: 'Отправляется',
  sent: 'Отправлено',
  delivered: 'Доставлено',
  read: 'Прочитано',
  failed: 'Не отправлено',
}

interface Props {
  status: MessageStatus
  className?: string
}

export function MessageStatusIcon({ status, className }: Props) {
  const props = {
    size: 16,
    className: className ? `${styles.icon} ${className}` : styles.icon,
    'data-status': status,
    role: 'img',
    'aria-label': LABELS[status],
  }
  switch (status) {
    case 'pending':
      return <Clock {...props} />
    case 'sent':
      return <Check {...props} weight="bold" />
    case 'delivered':
    case 'read':
      return <Checks {...props} weight="bold" />
    case 'failed':
      return <WarningCircle {...props} weight="fill" />
  }
}
