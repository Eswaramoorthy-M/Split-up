import { InputHTMLAttributes, forwardRef, useState } from 'react'
import clsx from 'clsx'
import { Icon } from './Icon'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className, id, type = 'text', ...rest }, ref) => {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && showPassword ? 'text' : type

  return (
    <div className="field">
      {label && <label htmlFor={inputId} className="field-label">{label}</label>}
      <div className={clsx('input-wrap', isPassword && 'input-wrap-password')}>
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          className={clsx('input', isPassword && 'input-has-toggle', error && 'input-error', className)}
          {...rest}
        />
        {isPassword && !rest.disabled && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(v => !v)}
            onMouseDown={e => e.preventDefault()}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} />
          </button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
})
Input.displayName = 'Input'
