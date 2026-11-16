// Random password for a new member. Skips look-alike characters (0/O, 1/l/I)
// so it is easy to read out or type from a message.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generatePassword(length = 10): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => CHARS[b % CHARS.length]).join('')
}
