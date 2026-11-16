/**
 * UPI helpers — free person-to-person payments.
 *
 * SplitUp never handles money. We only build a standard `upi://pay?...` deep
 * link (or QR code) that opens the payer's own UPI app with the receiver's UPI
 * ID and amount pre-filled. Money moves bank-to-bank, so there is no gateway,
 * no MDR, and no merchant account.
 *
 * There is also no callback: a UPI app cannot tell the browser whether the
 * transfer succeeded. The payer confirms the result in the app.
 */

/**
 * handle@provider, e.g. `name@okhdfcbank`, `9876543210@ybl`.
 * Deliberately has no `{m,n}` bounds: PostgreSQL's regex engine caps those at
 * 255, and the database uses the same bound-free shape. Length is checked
 * separately (5–255 characters).
 */
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-][A-Za-z0-9._-]+@[A-Za-z][A-Za-z]+$/

/** UPI IDs are case-insensitive; store them lower-case so comparisons match. */
export function normalizeUpiId(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidUpiId(value: string): boolean {
  const id = value.trim()
  return id.length >= 5 && id.length <= 255 && UPI_ID_PATTERN.test(id)
}

export interface UpiLinkInput {
  upiId: string
  payeeName: string
  amount: number
  note?: string
  /** Optional reference (settlement id). Kept alphanumeric, max 35 chars. */
  transactionRef?: string
}

/**
 * Build a `upi://pay` link. Values are encoded with encodeURIComponent (not
 * URLSearchParams) so spaces become `%20`, which every UPI app understands.
 */
export function buildUpiLink(input: UpiLinkInput): string {
  const amount = Math.round(input.amount * 100) / 100
  const note = (input.note ?? 'SplitUp settlement').slice(0, 50)
  const ref = input.transactionRef?.replace(/[^A-Za-z0-9]/g, '').slice(0, 35)

  const parts = [
    `pa=${encodeURIComponent(input.upiId.trim())}`,
    `pn=${encodeURIComponent(input.payeeName.trim() || 'SplitUp member')}`,
    `am=${amount.toFixed(2)}`,
    'cu=INR',
    `tn=${encodeURIComponent(note)}`
  ]
  if (ref) parts.push(`tr=${ref}`)

  return `upi://pay?${parts.join('&')}`
}

/** True on phones/tablets, where a UPI app is likely installed. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * Open the UPI app. A synthetic anchor click works better than assigning
 * window.location: the page is not navigated away if no app handles the link.
 */
export function openUpiApp(link: string): void {
  const anchor = document.createElement('a')
  anchor.href = link
  anchor.rel = 'noopener noreferrer'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}
