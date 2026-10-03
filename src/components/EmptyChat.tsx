import { ChatsCircle } from '@phosphor-icons/react'
import styles from './EmptyChat.module.css'

export function EmptyChat() {
  return (
    <section className={styles.empty}>
      <div className={styles.badge}>
        <ChatsCircle size={20} weight="fill" />
        Выберите чат или создайте новый по номеру телефона
      </div>
    </section>
  )
}
