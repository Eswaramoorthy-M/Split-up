// Supabase Edge Function: send-push
//
// Sends a free Web Push (VAPID) notification to every device a user has
// registered. It is meant to be called by a Supabase Database Webhook on
// INSERT into public.notifications, so the existing notification triggers
// automatically become OS notifications too.
//
// Required function secrets (Dashboard → Project Settings → Edge Functions):
//   VAPID_PUBLIC_KEY   ─ public half of your VAPID key pair
//   VAPID_PRIVATE_KEY  ─ private half (never put this in the frontend)
//   VAPID_SUBJECT      ─ e.g. mailto:you@example.com
// Optional:
//   PUSH_WEBHOOK_SECRET ─ if set, requests must send the same value in the
//                         x-webhook-secret header (protects this public URL).
//
// Deploy with JWT verification OFF, because a database webhook has no user JWT:
//   supabase functions deploy send-push --no-verify-jwt
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface NotificationRecord {
  id: string
  user_id: string
  group_id: string | null
  type: string
  title: string
  message: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // 1) Optional shared secret so the public function URL cannot be abused.
    const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
    if (secret) {
      const sent = req.headers.get('x-webhook-secret')
        ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (sent !== secret) return json({ error: 'Unauthorized' }, 401)
    }

    // 2) Read the inserted notification row from the database webhook payload.
    const body = await req.json().catch(() => null) as { record?: NotificationRecord } | null
    const record = body?.record
    if (!record?.user_id) return json({ error: 'Missing notification record' }, 400)

    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@splitup.app'
    if (!publicKey || !privateKey) {
      return json({ error: 'VAPID keys are not configured on this function.' }, 500)
    }

    webpush.setVapidDetails(subject, publicKey, privateKey)

    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey)

    const { data: subscriptions, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', record.user_id)

    if (error) return json({ error: error.message }, 500)
    if (!subscriptions?.length) return json({ ok: true, sent: 0, total: 0 })

    const payload = JSON.stringify({
      title: record.title || 'SplitUp',
      body: record.message ?? '',
      url: '/notifications',
      tag: `notification-${record.id}`,
      type: record.type,
      groupId: record.group_id
    })

    let sent = 0
    const staleIds: string[] = []

    await Promise.all(subscriptions.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 }
        )
        sent += 1
      } catch (err) {
        // 404 / 410 means the browser unsubscribed or the endpoint expired.
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) staleIds.push(sub.id)
      }
    }))

    if (staleIds.length) {
      await admin.from('push_subscriptions').delete().in('id', staleIds)
    }

    return json({ ok: true, sent, removed: staleIds.length, total: subscriptions.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, 500)
  }
})
