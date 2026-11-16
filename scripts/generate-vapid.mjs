// Generates a free Web Push (VAPID) key pair with Node's built-in crypto.
// No accounts, packages or services involved. Run: npm run vapid
import { createECDH } from 'node:crypto'

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()

const publicKey = ecdh.getPublicKey('base64url')
const privateKey = ecdh.getPrivateKey('base64url')

console.log('')
console.log('VAPID key pair generated.')
console.log('')
console.log('1) Frontend — add the PUBLIC key to .env (safe to ship in the bundle):')
console.log(`   VITE_VAPID_PUBLIC_KEY=${publicKey}`)
console.log('')
console.log('2) Sender — set these as Supabase Edge Function secrets (keep the private key secret):')
console.log(`   VAPID_PUBLIC_KEY=${publicKey}`)
console.log(`   VAPID_PRIVATE_KEY=${privateKey}`)
console.log('   VAPID_SUBJECT=mailto:you@example.com')
console.log('')
