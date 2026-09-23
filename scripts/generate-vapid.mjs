// Генерация пары ключей VAPID для Web Push. Без внешних зависимостей.
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

const publicJwk = publicKey.export({ format: 'jwk' })
const privateJwk = privateKey.export({ format: 'jwk' })

function base64UrlToBytes(value) {
  return Buffer.from(value, 'base64url')
}

// Браузер ждёт несжатую точку: 0x04 || X || Y, закодированную в base64url.
const rawPublic = Buffer.concat([
  Buffer.from([4]),
  base64UrlToBytes(publicJwk.x),
  base64UrlToBytes(publicJwk.y),
]).toString('base64url')

console.log('Публичный ключ — в .env приложения и в секреты функции:')
console.log(`VITE_VAPID_PUBLIC_KEY=${rawPublic}`)
console.log(`VAPID_PUBLIC_KEY=${rawPublic}`)
console.log('')
console.log('Приватный ключ — ТОЛЬКО в секреты Edge Function, в репозиторий не коммитить:')
console.log(`VAPID_PRIVATE_KEY=${privateJwk.d}`)
console.log('')
console.log('Ещё нужны:')
console.log('VAPID_SUBJECT=mailto:ваша@почта')
console.log('REMINDERS_CRON_SECRET=<случайная строка, например из `openssl rand -hex 24`>')
