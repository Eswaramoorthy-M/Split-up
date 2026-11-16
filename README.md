# SplitUp — Group Expense Management

A mobile-first web app for sharing monthly expenses in a small group
(friends, family, roommates). Add an expense in seconds; the app works out
balances and who should pay whom. React + TypeScript + Vite + plain CSS on
the front end; Supabase (Postgres, Auth, Storage, RLS) behind it; hosted on
Cloudflare. Runs on free tiers.

## Screens

Login · Register · Forgot password · Welcome (join with a code or create a group) ·
Group list · Dashboard · Add expense · Expense list · Expense details · Edit expense ·
**Manage expenses** · Settle up · Settlement details · **Pay with UPI** ·
**UPI transactions (admin)** · Members · Member details ·
Monthly report · Categories · Notifications · Group settings · Profile

### Manage expenses (More → Manage expenses, or "Manage all" on the Expenses tab)

- **All expenses** tab: every expense in the group for a chosen month (or all
  months), with search and filters (category, who paid, "added by me").
  Tap a row to see the **payment breakdown**: each member's share, a share bar,
  and whether they owe or get money back for that expense.
- **Who can change what**
  - The person who added an expense can edit or delete it.
  - **Admins can edit, delete and re-split every expense.**
  - Other members can view and share, not change.
  - Closed months are read-only for everyone until an admin reopens them.
- **Edit** opens the full form (amount, description, category, date, payer,
  participants, split). **Edit breakdown** is a quick sheet to change who paid
  and how the expense is split between members.
- **Member breakdown** tab: one card per member with total paid, total share,
  balance, and the exact expenses behind each number.

All of this is enforced by the database (RLS and triggers), not only by hidden buttons.

### Adding members (admin)

Members → **+ Add member**: enter name, email and a password (a random one is
suggested). The person can log in right away; no confirmation email is needed.
Share the login details by WhatsApp from the same screen. If the email already
has an account, it is just added to the group and its password is not changed.
Members can change their password under Profile.

This needs the `add-member` Edge Function (see Setup step 5), because creating
someone else's login requires a secret key that must never be in the app.

### Report (Reports tab)

Category-wise breakdown, total, payment breakup ("Arun to pay Eswar: ₹1,000")
and member summary for any month, with **Share on WhatsApp** / share / copy.

### Floating + button

Tap to add an expense. Press and drag to move it; the position is remembered on
that device. It hides on the add/edit forms. Keyboard: Shift + arrow keys move it.

### Install as an app (PWA)

SplitUp is a Progressive Web App. On Android/Chrome/Edge, More → **Install
SplitUp** adds it to the home screen; on iPhone/iPad the same card shows the
Safari *Share → Add to Home Screen* steps. Installed, it opens full screen
with its own icon, and the home-screen icon has shortcuts for Add expense,
Settle up and Monthly report (long-press it).

- **Offline:** the app shell and code are cached, so it opens instantly and
  without a connection. Data from Supabase is never cached (balances must be
  live), so an offline banner appears and saving waits for the connection.
- **Updates:** after each deploy, open apps show "A new version of SplitUp is
  ready → Update". Nothing reloads underneath someone mid-edit.
- Files: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/`,
  `src/pwa.ts`, `src/components/PwaPrompts.tsx`, `src/components/InstallAppCard.tsx`.
  The `pwa-sw` plugin in `vite.config.ts` stamps `sw.js` with a build id and
  the list of built files at `npm run build`; no extra package needed.
- The service worker only runs in production builds (`npm run build` +
  `npm run preview`, or the deployed site), not in `npm run dev`. Install
  needs HTTPS, which Cloudflare provides (localhost also works).

### Push notifications (free)

The app supports standard Web Push (VAPID) — no per-message cost, no Firebase,
no paid service. Any browser push relay (Chrome/FCM, Apple, Mozilla) is free.

- **In-app while open:** Supabase Realtime listens to `public.notifications`
  and shows a toast, and the Notifications page updates instantly
  (`src/lib/liveNotifications.ts`, `src/components/LiveNotificationToast.tsx`).
- **OS push while closed:** the `send-push` Edge Function sends to every device
  the user registered (`src/services/push.ts`, `public/sw.js`, migration `0008`).
  It is called by a Supabase Database Webhook on `notifications` INSERT, so the
  existing notification triggers automatically become push notifications.
- **iPhone/iPad:** Web Push requires iOS 16.4+ **and** the app must be added to
  the Home Screen. In a normal Safari tab there is no push.
- Permission is requested only when the person taps **Turn on** on the
  Notifications page (browsers reject automatic prompts).
- Setup steps are in **Setup step 6** below.

### UPI payments (free, direct person-to-person)

SplitUp can hand a settlement straight to the payer's UPI app, but it is **not
a payment gateway** and never touches the money.

- Each person can save a **UPI ID** under Profile. It is validated before saving
  (`name@okhdfcbank`, `9876543210@ybl`, …).
- On **Settle up**, a payer sees **Pay via UPI** for transfers where the receiver
  has added a UPI ID. It opens `upi://pay?…` with the payee, amount and note
  pre-filled; on desktop the same screen shows a **QR code** to scan.
- **Pay with UPI** (`/upi/pay`) is a dedicated screen: how much you owe and to
  whom, a **Pay via UPI** action, payments waiting for your confirmation (with
  **Confirm** / **Reject**), and your UPI history.
- **UPI transactions** (`/upi/transactions`, admin only) shows the whole group:
  total paid, awaiting confirmation and pending amounts, every member's UPI ID,
  and a filterable transaction history.
- Admins get two actions on that screen:
  - **Close & settle all** — marks every pending / awaiting payment as
    confirmed, so the group reads settled up.
  - **Reset all transactions** — permanently deletes the settlement history;
    suggestions restart from the expense data.
  Both call SECURITY DEFINER functions that check `is_group_admin()`, so a
  regular member cannot run them even by calling the API directly.
- UPI has no callback into a browser, so SplitUp cannot verify a bank transfer.
  When the payer returns from the UPI app, the payment is recorded as **paid**
  automatically (see `autoMarkPaidOnReturn`); the receiver then confirms or
  rejects it. Rejecting puts the amount back into the payer's "need to pay".
- Manual **Record** / **Mark as paid** are temporarily turned off on the Settle
  screen; the receiver can still **Confirm** a paid settlement.
- No gateway, merchant account, MDR or per-message fee is involved; UPI P2P is
  zero-fee by law.
- Files: `src/lib/upi.ts`, `src/components/UpiPaymentPrompt.tsx`,
  `src/features/settlements/pages/PayWithUpi.tsx`,
  `src/features/settlements/pages/UpiTransactions.tsx`,
  `src/features/profile/pages/Profile.tsx`, migrations
  `0009_upi_payments.sql`, `0011_upi_history.sql` and
  `0012_admin_settlement_actions.sql`.

### Feature flags (`src/config/features.ts`)

Settlement actions are controlled from one file. Edit the `FEATURES.settlements`
values, then rebuild/redeploy — no component changes needed:

| Flag | Controls |
|---|---|
| `record` | "Record" button on suggested transfers |
| `markAsPaid` | Manual "Mark as paid" on pending settlements |
| `upiPay` | "Pay via UPI" deep link / QR code |
| `upiConfirmPaid` | "Yes, I've paid" after returning from the UPI app |
| `autoMarkPaidOnReturn` | Record the payment as paid when the payer returns from the UPI app |
| `adminUpiDashboard` | Admin-only UPI transactions screen and menu link |
| `closeAllSettlements` | Admin "Close & settle all" action |
| `resetSettlements` | Admin "Reset all transactions" action |
| `confirmReceipt` | Receiver "Confirm" / "Confirm payment" |
| `rejectReceipt` | Receiver "Reject" / "Payment didn't arrive" |
| `cancel` | "Cancel" on a pending settlement |

Currently `record` and `markAsPaid` are `false`; the rest are `true`.
These flags only shape the UI — Row Level Security in Supabase is still the
real authorization boundary.

## Setup

1. **Supabase project** — create one at supabase.com.
2. **Run the SQL** — SQL Editor → New query, paste each file and Run, one at a
   time, **in order**:
   `0001_init.sql` → `0002_rls.sql` → `0003_functions.sql` → `0004_storage.sql` →
   `0005_fixes.sql` → `0006_manage_expenses.sql` → `0007_fix_delete_expense.sql` →
   `0008_push_notifications.sql` → `0009_upi_payments.sql` →
   `0010_fix_upi_id_constraint.sql` → `0011_upi_history.sql` →
   `0012_admin_settlement_actions.sql`
   (all in `supabase/migrations/`).
   Already ran 0001–0006? Run `0007_fix_delete_expense.sql`, then `0008_push_notifications.sql`,
   then `0009_upi_payments.sql`, then `0010_fix_upi_id_constraint.sql`, then
   `0011_upi_history.sql`, then `0012_admin_settlement_actions.sql`.
   Migration `0008` also turns on Realtime for the `notifications` table;
   `0009` adds `profiles.upi_id` and notifies admins when a settlement is paid;
   `0010` fixes the UPI ID check constraint for PostgreSQL's 255-repeat limit;
   `0011` adds UPI history fields and the receiver "reject" status;
   `0012` adds the admin-only close / reset settlement functions.
3. **Environment** — copy `.env.example` to `.env`, fill in your Project URL and
   anon/publishable key (Project Settings → API). Never use the service_role key.
4. `npm install` then `npm run dev` → http://localhost:5173
5. **Deploy the add-member function** (needed only for "Add member"):
   Supabase dashboard → **Edge Functions → Deploy a new function → Via Editor**,
   name it exactly `add-member`, paste the contents of
   `supabase/functions/add-member/index.ts`, and **Deploy**. Leave "Verify JWT" on.
   (CLI alternative: `supabase functions deploy add-member`.)

6. **Push notifications (optional, free)** — four small steps:
   1. Generate a VAPID key pair: `npm run vapid`.
      Put the **public** key in `.env` as `VITE_VAPID_PUBLIC_KEY`, then rebuild.
   2. Deploy `supabase/functions/send-push/index.ts` as an Edge Function named
      `send-push` **with JWT verification off** (a database webhook has no user JWT).
      CLI: `supabase functions deploy send-push --no-verify-jwt`.
   3. Add Edge Function secrets (Dashboard → Project Settings → Edge Functions →
      Secrets): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
      (e.g. `mailto:you@example.com`). Optionally add `PUSH_WEBHOOK_SECRET`.
   4. Create a **Database Webhook** (Dashboard → Database → Webhooks) on table
      `public.notifications`, event **INSERT**, type **HTTP Request**, URL
      `https://YOUR_PROJECT.supabase.co/functions/v1/send-push`. If you set
      `PUSH_WEBHOOK_SECRET`, add the header `x-webhook-secret: <same value>`.

   Then open **More → Notifications → Turn on**. On iPhone/iPad, install the app
   to the Home Screen first (iOS 16.4+).

## Deploy (Cloudflare Workers, no Git needed)

```bash
npm run build
npx wrangler login      # first time only
npx wrangler deploy     # or: npm run deploy
```
`wrangler.jsonc` serves `dist/` as a single-page app. Do **not** add a
`_redirects` file (Workers rejects it). Make sure `.env` has real values when you
build, because Vite bakes them in.

Then in Supabase → Authentication → URL Configuration: Site URL = your live
address (no wildcard), and add `https://YOUR-SITE/**` and
`http://localhost:5173/**` under Redirect URLs.

## Project structure

```
src/
├── components/       shared UI (Button, Card, Input, Modal, BottomNav, FAB…)
├── contexts/         AuthContext, GroupContext
├── features/
│   ├── auth/  groups/  dashboard/  settlements/  reports/  notifications/  profile/
│   ├── expenses/     add, edit, list, details, SplitEditor, MemberSelector
│   └── manage/       ManageExpenses page, ExpenseManageCard, BreakdownEditor, MemberBreakdown
├── layouts/          AppLayout
├── lib/              supabase client, money (cent-safe), permissions, members
├── services/         all Supabase calls
├── styles/           base.css, components.css, layout.css, pages.css (plain CSS)
└── types/
supabase/migrations/  0001 … 0012
supabase/functions/   add-member, send-push
scripts/              generate-vapid.mjs (`npm run vapid`)
```

## How money stays correct

- Amounts are `NUMERIC(12,2)` in Postgres. Balances and settlement suggestions
  come from database functions (`get_group_balances`, `get_settlement_suggestions`).
- The browser only does whole-cent arithmetic for previews; the database rejects
  any split whose shares do not add up to the expense **exactly**, and any
  percentage split that does not total 100%.
- Creating or editing an expense and its split is **one transaction**
  (`create_expense_full`, `update_expense_full`): it saves completely or not at all.
- An expense belongs to the month of its **date**, so back-dated expenses land in
  the right monthly cycle.

## Notes

- Not built yet: receipt upload UI (storage and policies exist), phone OTP,
  email notifications.
- Login is saved in the browser (localStorage) and restored on refresh; logging out clears it.
- Free Supabase projects pause after ~7 days without activity; open the app
  weekly or restore from the dashboard.
