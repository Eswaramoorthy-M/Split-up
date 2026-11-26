import { FormEvent, HTMLAttributes, ReactNode, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { isValidUpiId, normalizeUpiId } from '@/lib/upi'
import { guardReveal } from '@/lib/motionFallback'
import { gsap, ScrollTrigger, useGSAP } from '../animation'

type Message = { ok: boolean; text: string }
type ButtonPhase = 'idle' | 'loading' | 'success'

function passwordStrength(value: string): number {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^A-Za-z0-9]/.test(value)) score += 1
  return Math.min(score, 4)
}

function RevealText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className} aria-label={text}>
      {text.split('').map((char, index) => (
        <span key={`${char}-${index}`} className="profile-reveal-char" data-reveal-char aria-hidden="true">
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </span>
  )
}

function Field({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="profile-field" {...rest}>
      <span className="profile-field__halo" aria-hidden="true" />
      {children}
    </div>
  )
}

function SectionHeading({ icon, title, subtitle }: { icon: IconName; title: string; subtitle?: string }) {
  return (
    <div className="profile-section-head">
      <span className="profile-section-icon"><Icon name={icon} size={19} /></span>
      <div>
        <h2 className="profile-section-title">{title}</h2>
        {subtitle && <p className="profile-section-sub">{subtitle}</p>}
      </div>
    </div>
  )
}

function ButtonContent({ label }: { label: string }) {
  return (
    <span className="profile-btn-content">
      <span className="profile-btn-label">{label}</span>
      <span className="profile-btn-spinner" aria-hidden="true" />
      <svg className="profile-btn-check" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
    </span>
  )
}

function useVisibleMessage(message: Message | null) {
  const [visible, setVisible] = useState<Message | null>(message)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(message)
      setLeaving(false)
      return
    }
    if (!visible) return
    setLeaving(true)
    const timer = window.setTimeout(() => {
      setVisible(null)
      setLeaving(false)
    }, 240)
    return () => window.clearTimeout(timer)
  }, [message, visible])

  return { visible, leaving }
}

function animateButtonPhase(button: HTMLElement, phase: ButtonPhase, motion: boolean) {
  const label = button.querySelector<HTMLElement>('.profile-btn-label')
  const spinner = button.querySelector<HTMLElement>('.profile-btn-spinner')
  const check = button.querySelector<HTMLElement>('.profile-btn-check')
  const path = button.querySelector<SVGPathElement>('.profile-btn-check path')
  if (!label || !spinner || !check || !path) return

  const length = path.getTotalLength()
  gsap.killTweensOf([label, spinner, check, path])
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })

  if (!motion) {
    gsap.set(label, { opacity: phase === 'idle' ? 1 : 0 })
    gsap.set(spinner, { opacity: phase === 'loading' ? 1 : 0, rotation: 0 })
    gsap.set(check, { opacity: phase === 'success' ? 1 : 0 })
    gsap.set(path, { strokeDashoffset: phase === 'success' ? 0 : length })
    return
  }

  if (phase === 'loading') {
    gsap.set(check, { opacity: 0 })
    gsap.set(path, { strokeDashoffset: length })
    gsap.to(label, { opacity: 0, duration: 0.15, ease: 'power2.out', overwrite: 'auto' })
    gsap.to(spinner, { opacity: 1, duration: 0.15, ease: 'power2.out', overwrite: 'auto' })
    gsap.to(spinner, { rotation: 360, duration: 0.8, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })
    return
  }

  gsap.killTweensOf(spinner)
  gsap.set(spinner, { opacity: 0, rotation: 0 })

  if (phase === 'success') {
    gsap.timeline({ defaults: { ease: 'power2.out' } })
      .to(label, { opacity: 0, duration: 0.12 })
      .to(check, { opacity: 1, duration: 0.15 }, '<')
      .to(path, { strokeDashoffset: 0, duration: 0.42, ease: 'power3.out' })
      .to(check, { opacity: 0, duration: 0.18 }, '+=0.35')
      .to(label, { opacity: 1, duration: 0.2 }, '<')
    return
  }

  gsap.to(check, { opacity: 0, duration: 0.15, overwrite: 'auto' })
  gsap.to(label, { opacity: 1, duration: 0.2, overwrite: 'auto' })
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [mobile, setMobile] = useState(profile?.mobile ?? '')
  const [upiId, setUpiId] = useState(profile?.upi_id ?? '')
  const [upiError, setUpiError] = useState('')
  const [profileMessage, setProfileMessage] = useState<Message | null>(null)
  const [saving, setSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<Message | null>(null)

  const [savePhase, setSavePhase] = useState<ButtonPhase>('idle')
  const [pwPhase, setPwPhase] = useState<ButtonPhase>('idle')
  const rootRef = useRef<HTMLDivElement>(null)

  const profileBanner = useVisibleMessage(profileMessage)
  const passwordBanner = useVisibleMessage(pwMessage)

  const strength = passwordStrength(newPassword)
  const strengthWidth = strength * 25
  const strengthLabel = ['Add a password', 'Fair', 'Good', 'Strong', 'Excellent'][strength]
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword
  const passwordsDiffer = confirmPassword.length > 0 && newPassword !== confirmPassword

  useEffect(() => {
    if (saving) {
      setSavePhase('loading')
      return
    }
    if (profileMessage?.ok) {
      setSavePhase('success')
      const timer = window.setTimeout(() => setSavePhase('idle'), 1250)
      return () => window.clearTimeout(timer)
    }
    setSavePhase('idle')
  }, [saving, profileMessage])

  useEffect(() => {
    if (pwSaving) {
      setPwPhase('loading')
      return
    }
    if (pwMessage?.ok) {
      setPwPhase('success')
      const timer = window.setTimeout(() => setPwPhase('idle'), 1250)
      return () => window.clearTimeout(timer)
    }
    setPwPhase('idle')
  }, [pwSaving, pwMessage])

  const { contextSafe } = useGSAP(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia()
    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      hover: '(hover: hover) and (min-width: 1024px)'
    }, context => {
      const { motion, hover } = context.conditions ?? {}
      const heading = root.querySelector<HTMLElement>('[data-profile-heading]')
      const hero = root.querySelector<HTMLElement>('[data-profile-hero]')
      const avatar = root.querySelector<HTMLElement>('[data-profile-avatar]')
      const ring = root.querySelector<HTMLElement>('[data-profile-ring]')
      const chars = gsap.utils.toArray<HTMLElement>('[data-reveal-char]', root)
      const sections = gsap.utils.toArray<HTMLElement>('[data-section]:not([data-scroll-card])', root)
      const scrollCards = gsap.utils.toArray<HTMLElement>('[data-scroll-card]', root)
      const blobs = gsap.utils.toArray<HTMLElement>('[data-profile-blob]', root)
      const revealTargets = [heading, hero, avatar, ...chars, ...sections, ...scrollCards].filter(Boolean) as HTMLElement[]

      if (!motion) {
        gsap.set(revealTargets, { clearProps: 'all' })
        gsap.set(revealTargets, { opacity: 1, x: 0, y: 0, scale: 1 })
        if (ring) gsap.set(ring, { rotation: 0 })
        return
      }

      if (heading) gsap.set(heading, { opacity: 0, y: -12 })
      if (hero) gsap.set(hero, { opacity: 0, y: 18 })
      if (avatar) gsap.set(avatar, { opacity: 0, scale: 0.72, transformOrigin: '50% 50%' })
      if (chars.length) gsap.set(chars, { opacity: 0, yPercent: 110 })
      if (sections.length) gsap.set(sections, { opacity: 0, y: 24 })
      if (scrollCards.length) gsap.set(scrollCards, { opacity: 0, y: 24 })

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      if (heading) intro.to(heading, { opacity: 1, y: 0, duration: 0.45 })
      if (hero) intro.to(hero, { opacity: 1, y: 0, duration: 0.55 }, '-=0.22')
      if (avatar) intro.to(avatar, { opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(1.7)' }, '-=0.34')
      if (chars.length) intro.to(chars, { opacity: 1, yPercent: 0, duration: 0.42, stagger: 0.014 }, '-=0.36')
      if (sections.length) intro.to(sections, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, '-=0.22')

      scrollCards.forEach(card => {
        gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 92%', once: true } })
          .to(card, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' })
      })

      blobs.forEach((blob, index) => {
        gsap.to(blob, {
          x: index % 2 ? -24 : 28,
          y: index % 2 ? 18 : -16,
          scale: 1.12,
          duration: 7 + index * 1.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        })
      })
      if (ring) {
        gsap.to(ring, { rotation: 360, duration: 18, repeat: -1, ease: 'none', transformOrigin: '50% 50%' })
      }

      const cleanups: Array<() => void> = []
      gsap.utils.toArray<HTMLButtonElement>('[data-profile-btn]', root).forEach(button => {
        const enter = () => gsap.to(button, { y: -2, duration: 0.22, ease: 'power2.out', overwrite: 'auto' })
        const leave = () => gsap.to(button, { y: 0, scale: 1, duration: 0.24, ease: 'power2.out', overwrite: 'auto' })
        const down = () => gsap.to(button, { scale: 0.97, duration: 0.1, ease: 'power2.out', overwrite: 'auto' })
        const up = () => gsap.to(button, { scale: 1, y: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
        button.addEventListener('mouseenter', enter)
        button.addEventListener('mouseleave', leave)
        button.addEventListener('mousedown', down)
        button.addEventListener('mouseup', up)
        cleanups.push(() => {
          button.removeEventListener('mouseenter', enter)
          button.removeEventListener('mouseleave', leave)
          button.removeEventListener('mousedown', down)
          button.removeEventListener('mouseup', up)
        })
      })

      if (!hover || !hero || !avatar) return () => cleanups.forEach(off => off())

      const onPointerMove = (event: PointerEvent) => {
        const rect = hero.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 10
        gsap.to(avatar, { x, y, duration: 0.5, ease: 'power2.out', overwrite: 'auto' })
      }
      const onPointerLeave = () => {
        gsap.to(avatar, { x: 0, y: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
      }
      hero.addEventListener('pointermove', onPointerMove)
      hero.addEventListener('pointerleave', onPointerLeave)

      return () => {
        cleanups.forEach(off => off())
        hero.removeEventListener('pointermove', onPointerMove)
        hero.removeEventListener('pointerleave', onPointerLeave)
        gsap.set(avatar, { x: 0, y: 0 })
      }
    })

    ScrollTrigger.refresh()
  }, { scope: rootRef })

  // If the first frame is delayed on a cold PWA launch, force the intro to its
  // final state instead of leaving the page hidden behind opacity: 0.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const revealTargets = () => [
      root.querySelector<HTMLElement>('[data-profile-heading]'),
      root.querySelector<HTMLElement>('[data-profile-hero]'),
      root.querySelector<HTMLElement>('[data-profile-avatar]'),
      ...gsap.utils.toArray<HTMLElement>('[data-reveal-char]', root),
      ...gsap.utils.toArray<HTMLElement>('[data-section]:not([data-scroll-card])', root)
    ].filter(Boolean) as HTMLElement[]

    return guardReveal(revealTargets, () => {
      const targets = revealTargets()
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 1, x: 0, y: 0, yPercent: 0, scale: 1 })
      const ring = root.querySelector<HTMLElement>('[data-profile-ring]')
      if (ring) gsap.set(ring, { rotation: 0 })
      root.classList.remove('profile-enter')
    }, 3000)
  }, [])

  const runFieldFocus = contextSafe((field: HTMLElement, focused: boolean) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const label = field.querySelector<HTMLElement>('.field-label')
    const halo = field.querySelector<HTMLElement>('.profile-field__halo')
    if (label) {
      gsap.to(label, {
        x: focused ? 2 : 0,
        y: focused ? -2 : 0,
        duration: focused ? 0.2 : 0.24,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    }
    if (halo) {
      gsap.to(halo, {
        opacity: focused ? 1 : 0,
        scale: focused ? 1 : 0.98,
        duration: 0.22,
        ease: 'power2.out',
        overwrite: 'auto'
      })
    }
  })

  // Width follows the score; colour transitions are handled by CSS tokens.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const { motion } = context.conditions ?? {}
      const fill = root.querySelector<HTMLElement>('[data-strength-fill]')
      if (!fill) return
      const target = Number(fill.dataset.strengthWidth ?? 0)
      if (!motion) {
        gsap.set(fill, { width: `${target}%` })
        return
      }
      gsap.to(fill, { width: `${target}%`, duration: 0.45, ease: 'power2.out', overwrite: 'auto' })
    })
  }, { scope: rootRef, dependencies: [strength], revertOnUpdate: false })

  // A quick horizontal nudge on the field that failed validation.
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const { motion } = context.conditions ?? {}
      const targets = [
        ...(upiError ? gsap.utils.toArray<HTMLElement>('[data-upi-field]', root) : []),
        ...(pwMessage && !pwMessage.ok ? gsap.utils.toArray<HTMLElement>('[data-password-field]', root) : [])
      ]
      if (!motion) {
        gsap.set(targets, { x: 0 })
        return
      }
      targets.forEach(field => {
        gsap.fromTo(field, { x: 0 }, {
          keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 0 }],
          duration: 0.38,
          ease: 'power2.out',
          overwrite: 'auto'
        })
      })
    })
  }, { scope: rootRef, dependencies: [upiError, pwMessage], revertOnUpdate: true })

  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const { motion } = context.conditions ?? {}
      gsap.utils.toArray<HTMLElement>('[data-phase-btn]', root).forEach(button => {
        animateButtonPhase(button, (button.dataset.phase as ButtonPhase) ?? 'idle', Boolean(motion))
      })
    })
  }, { scope: rootRef, dependencies: [savePhase, pwPhase], revertOnUpdate: false })

  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const { motion } = context.conditions ?? {}
      gsap.utils.toArray<HTMLElement>('[data-profile-banner]', root).forEach(banner => {
        const leaving = banner.dataset.bannerLeaving === 'true'
        if (!motion) {
          gsap.set(banner, leaving ? { height: 0, opacity: 0, y: -6 } : { height: 'auto', opacity: 1, y: 0 })
          return
        }
        if (leaving) {
          gsap.to(banner, {
            height: 0, opacity: 0, y: -6, duration: 0.22, ease: 'power2.in', overwrite: 'auto'
          })
          return
        }
        gsap.fromTo(banner,
          { height: 0, opacity: 0, y: -6 },
          { height: 'auto', opacity: 1, y: 0, duration: 0.34, ease: 'power2.out', overwrite: 'auto' }
        )
      })
    })
  }, {
    scope: rootRef,
    dependencies: [profileBanner.visible, profileBanner.leaving, passwordBanner.visible, passwordBanner.leaving],
    revertOnUpdate: true
  })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return

    // Validate before saving so a malformed UPI ID never reaches the database,
    // where it would fail silently inside the user's UPI app later.
    const normalizedUpi = normalizeUpiId(upiId)
    if (normalizedUpi && !isValidUpiId(normalizedUpi)) {
      setUpiError('Enter a valid UPI ID, like name@okhdfcbank or 9876543210@ybl.')
      return
    }
    setUpiError('')
    setProfileMessage(null)
    setSaving(true)

    const { error } = await supabase.from('profiles').update({
      name: name.trim(),
      mobile: mobile.trim() || null,
      upi_id: normalizedUpi || null
    }).eq('id', profile.id)

    if (error) {
      setSaving(false)
      setProfileMessage({ ok: false, text: error.message })
      return
    }

    setUpiId(normalizedUpi)
    await refreshProfile()
    setSaving(false)
    setProfileMessage({ ok: true, text: 'Profile saved.' })
  }

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwMessage(null)
    if (newPassword.length < 8) { setPwMessage({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    if (newPassword !== confirmPassword) { setPwMessage({ ok: false, text: 'The two passwords do not match.' }); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) { setPwMessage({ ok: false, text: error.message }); return }
    setNewPassword(''); setConfirmPassword('')
    setPwMessage({ ok: true, text: 'Password changed.' })
  }

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Log out of SplitUp?',
      message: 'You can sign back in any time.',
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      tone: 'danger'
    })
    if (confirmed) await signOut()
  }

  const initial = profile?.name?.[0]?.toUpperCase() ?? '?'
  const displayName = profile?.name ?? 'Your profile'
  const displayEmail = profile?.email ?? 'No email on file'
  const hasUpi = Boolean(upiId.trim())

  return (
    <div className="profile-page profile-enter" ref={rootRef}>
      <header className="page-head profile-page-head" data-profile-heading>
        <div>
          <p className="page-kicker">Your account</p>
          <h1 className="page-title">Profile</h1>
        </div>
      </header>

      <section className="profile-hero" data-profile-hero aria-label="Profile summary">
        <div className="profile-hero__mesh" aria-hidden="true">
          <span className="profile-blob profile-blob--a" data-profile-blob />
          <span className="profile-blob profile-blob--b" data-profile-blob />
          <span className="profile-blob profile-blob--c" data-profile-blob />
        </div>
        <div className="profile-hero__content">
          <div className="profile-avatar-shell" data-profile-avatar>
            <span className="profile-avatar-ring" data-profile-ring aria-hidden="true" />
            <span className="profile-avatar" aria-hidden="true">{initial}</span>
          </div>
          <div className="profile-identity">
            <span className="profile-eyebrow">SplitUp member</span>
            <h2 className="profile-name"><RevealText text={displayName} /></h2>
            <p className="profile-email"><RevealText text={displayEmail} /></p>
            <div className="profile-chips">
              <span className={clsx('profile-chip', hasUpi ? 'profile-chip--linked' : 'profile-chip--empty')}>
                <Icon name={hasUpi ? 'checkCircle' : 'wallet'} size={14} />
                {hasUpi ? 'UPI linked' : 'UPI not set'}
              </span>
              <span className="profile-chip"><Icon name="shield" size={14} />Secure account</span>
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={onSubmit} className="profile-form">
        <Card className="profile-section" data-section>
          <SectionHeading icon="user" title="Personal details" subtitle="How your group sees you." />
          <div className="profile-grid">
            <Field onFocus={e => runFieldFocus(e.currentTarget, true)} onBlur={e => runFieldFocus(e.currentTarget, false)}>
              <Input label="Name" startIcon="user" value={name} onChange={e => setName(e.target.value)} />
            </Field>
            <Field onFocus={e => runFieldFocus(e.currentTarget, true)} onBlur={e => runFieldFocus(e.currentTarget, false)}>
              <Input label="Mobile number" startIcon="phone" value={mobile} onChange={e => setMobile(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="profile-section" data-section>
          <SectionHeading icon="wallet" title="Payment (UPI)" subtitle="Optional, but handy for settlements." />
          <Field
            data-upi-field
            onFocus={e => runFieldFocus(e.currentTarget, true)}
            onBlur={e => runFieldFocus(e.currentTarget, false)}
          >
            <Input
              label="UPI ID"
              startIcon="wallet"
              value={upiId}
              onChange={e => { setUpiId(e.target.value); if (upiError) setUpiError('') }}
              error={upiError || undefined}
              placeholder="name@okhdfcbank"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </Field>
          <div className="profile-callout">
            <Icon name="shield" size={17} className="profile-callout__icon" />
            <p>Money moves bank-to-bank. SplitUp never touches it — leave blank to remove your UPI ID.</p>
          </div>
        </Card>

        {profileBanner.visible && (
          <div className="profile-banner-wrap">
            <p
              className={clsx('profile-banner', profileBanner.visible.ok ? 'banner banner-ok' : 'banner banner-error')}
              data-profile-banner
              data-banner-leaving={profileBanner.leaving}
              role={profileBanner.visible.ok ? 'status' : 'alert'}
            >
              <Icon name={profileBanner.visible.ok ? 'checkCircle' : 'alert'} size={16} />
              {profileBanner.visible.text}
            </p>
          </div>
        )}

        <div className="profile-actions">
          <Button
            type="submit"
            disabled={saving}
            data-profile-btn
            data-phase-btn
            data-phase={savePhase}
            className="profile-btn profile-save-btn"
          >
            <ButtonContent label="Save changes" />
          </Button>
        </div>
      </form>

      <form onSubmit={onChangePassword} className="profile-form profile-form--password">
        <Card className="profile-section" data-section>
          <SectionHeading icon="lock" title="Security" subtitle="Use at least eight characters." />
          <Field
            data-password-field
            onFocus={e => runFieldFocus(e.currentTarget, true)}
            onBlur={e => runFieldFocus(e.currentTarget, false)}
          >
            <Input
              label="New password"
              startIcon="lock"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </Field>
          <Field
            data-password-field
            onFocus={e => runFieldFocus(e.currentTarget, true)}
            onBlur={e => runFieldFocus(e.currentTarget, false)}
          >
            <Input
              label="Confirm new password"
              startIcon="lock"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </Field>
          <div className="profile-strength" aria-live="polite">
            <div className="profile-strength__track">
              <span
                className="profile-strength__fill"
                data-strength-fill
                data-strength={strength}
                data-strength-width={strengthWidth}
              />
            </div>
            <div className="profile-strength__meta">
              <span>{strengthLabel}</span>
              <span className={clsx(
                'profile-strength__match',
                passwordsMatch && 'profile-strength__match--ok',
                passwordsDiffer && 'profile-strength__match--bad'
              )}>
                <Icon name={passwordsMatch ? 'check' : passwordsDiffer ? 'alert' : 'info'} size={13} />
                {passwordsMatch ? 'Passwords match' : passwordsDiffer ? 'Passwords differ' : 'Confirm to check'}
              </span>
            </div>
          </div>
        </Card>

        {passwordBanner.visible && (
          <div className="profile-banner-wrap">
            <p
              className={clsx('profile-banner', passwordBanner.visible.ok ? 'banner banner-ok' : 'banner banner-error')}
              data-profile-banner
              data-banner-leaving={passwordBanner.leaving}
              role={passwordBanner.visible.ok ? 'status' : 'alert'}
            >
              <Icon name={passwordBanner.visible.ok ? 'checkCircle' : 'alert'} size={16} />
              {passwordBanner.visible.text}
            </p>
          </div>
        )}

        <div className="profile-actions">
          <Button
            type="submit"
            variant="secondary"
            disabled={pwSaving}
            data-profile-btn
            data-phase-btn
            data-phase={pwPhase}
            className="profile-btn profile-password-btn"
          >
            <ButtonContent label="Change password" />
          </Button>
        </div>
      </form>

      <Card className="profile-section profile-account-card" data-section data-scroll-card>
        <SectionHeading icon="logout" title="Account" subtitle="Sign out of this device." />
        <div className="profile-actions">
          <Button
            variant="danger"
            data-profile-btn
            className="profile-btn profile-logout-btn"
            onClick={() => void handleLogout()}
          >
            <span className="profile-btn-content"><Icon name="logout" size={17} />Log out</span>
          </Button>
        </div>
      </Card>
    </div>
  )
}
