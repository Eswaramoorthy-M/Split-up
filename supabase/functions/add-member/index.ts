// Supabase Edge Function: add-member
//
// Lets a GROUP ADMIN create a login (email + password) for a new member and add
// them to the group in one step. It runs on Supabase's servers because creating
// someone else's account needs the service-role key, which must never be in
// the browser. SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// provided to Edge Functions automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    // 1) Who is calling? Must be a logged-in user.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'You are not logged in.' }, 401)

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: who, error: whoErr } = await asCaller.auth.getUser()
    if (whoErr || !who.user) return json({ error: 'You are not logged in.' }, 401)

    // 2) Validate the request.
    const body = await req.json().catch(() => ({}))
    const groupId = String(body.group_id ?? '')
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    if (!groupId) return json({ error: 'Missing group.' }, 400)
    if (name.length < 2 || name.length > 80) return json({ error: 'Enter the member\'s name.' }, 400)
    if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
    if (password.length < 8 || password.length > 72) return json({ error: 'Password must be 8 to 72 characters.' }, 400)

    // 3) The caller must be an ACTIVE ADMIN of this group (checked on the server).
    const admin = createClient(url, serviceKey)
    const { data: me, error: meErr } = await admin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', who.user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (meErr) return json({ error: meErr.message }, 500)
    if (me?.role !== 'admin') return json({ error: 'Only group admins can add members.' }, 403)

    // 4) Create the login (already confirmed, so no email is needed), or reuse
    //    the existing account if that email is already registered.
    let userId: string
    let created = false
    const { data: made, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (createErr || !made?.user) {
      const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
      if (!existing) return json({ error: createErr?.message ?? 'Could not create the account.' }, 400)
      userId = existing.id
    } else {
      userId = made.user.id
      created = true
    }

    // Make sure a profile row exists (normally created by a database trigger).
    await admin.from('profiles').upsert({ id: userId, name, email }, { onConflict: 'id', ignoreDuplicates: true })

    // 5) Add to the group. Never change the role of someone already in it.
    const { data: membership } = await admin
      .from('group_members')
      .select('id, is_active')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membership?.is_active) {
      return json({ error: 'That person is already a member of this group.' }, 409)
    }

    const { error: memberErr } = membership
      ? await admin.from('group_members').update({ is_active: true }).eq('id', membership.id)
      : await admin.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'member' })
    if (memberErr) return json({ error: memberErr.message }, 500)

    return json({ ok: true, created, user_id: userId })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Something went wrong.' }, 500)
  }
})
