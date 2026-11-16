import { useState } from 'react'
import { promptInstall, usePwa } from '@/pwa'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Icon, LogoMark } from '@/components/ui/Icon'

/**
 * "Install SplitUp" card. Chrome/Edge/Android get a one-tap install button;
 * iPhone/iPad (no install API) get Add-to-Home-Screen instructions.
 * Renders nothing once the app is installed or the browser can't install it.
 */
export function InstallAppCard() {
  const { canInstall, isStandalone, isIos } = usePwa()
  const [showIosSteps, setShowIosSteps] = useState(false)

  if (isStandalone || (!canInstall && !isIos)) return null

  return (
    <Card className="install-card">
      <div className="install-card-head">
        <LogoMark size={40} />
        <div className="flex-1">
          <p className="fw-semibold">Install SplitUp</p>
          <p className="muted text-sm">Open it from your home screen like a regular app, full screen and faster.</p>
        </div>
      </div>
      {canInstall ? (
        <Button type="button" fullWidth onClick={() => { void promptInstall() }}>
          <Icon name="plus" size={17} />Install app
        </Button>
      ) : showIosSteps ? (
        <ol className="install-steps text-sm">
          <li>Tap the <strong>Share</strong> button in Safari’s toolbar.</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Tap <strong>Add</strong>. SplitUp appears on your home screen.</li>
        </ol>
      ) : (
        <Button type="button" variant="secondary" fullWidth onClick={() => setShowIosSteps(true)}>
          How to install on iPhone
        </Button>
      )}
    </Card>
  )
}
