/**
 * Feature flags
 * ---------------------------------------------------------------------------
 * One place to turn settlement actions on or off. Change a value here, save,
 * and rebuild (`npm run build` / `npm run deploy`) — no component edits needed.
 *
 * These flags only control what the UI offers. Row Level Security in Supabase
 * remains the real authorization boundary.
 */

export interface SettlementFeatureFlags {
  /** "Record" button on suggested transfers (records a settlement without paying). */
  record: boolean
  /** Manual "Mark as paid" for a pending settlement (cash / off-app payments). */
  markAsPaid: boolean
  /** "Pay via UPI" deep link / QR code. */
  upiPay: boolean
  /** "Yes, I've paid" confirmation after returning from the UPI app. */
  upiConfirmPaid: boolean
  /** Mark paid automatically when the payer returns from the UPI app. */
  autoMarkPaidOnReturn: boolean
  /** Admin-only UPI transactions screen (paid/pending per member). */
  adminUpiDashboard: boolean
  /** Admin: close out all pending/paid settlements as confirmed. */
  closeAllSettlements: boolean
  /** Admin: delete the settlement history and recalculate suggestions. */
  resetSettlements: boolean
  /** Receiver confirmation ("Confirm" / "Confirm payment"). */
  confirmReceipt: boolean
  /** Receiver can reject a payment that never arrived. */
  rejectReceipt: boolean
  /** Cancel a pending settlement. */
  cancel: boolean
}

export const FEATURES: { settlements: SettlementFeatureFlags } = {
  settlements: {
    record: false,
    markAsPaid: false,
    upiPay: true,
    upiConfirmPaid: true,
    autoMarkPaidOnReturn: true,
    adminUpiDashboard: true,
    closeAllSettlements: true,
    resetSettlements: true,
    confirmReceipt: true,
    rejectReceipt: true,
    cancel: true
  }
}
