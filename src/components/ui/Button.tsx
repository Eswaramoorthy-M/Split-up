import { ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', fullWidth, className, ...rest }, ref) => (
    <button
      ref={ref}
      className={clsx('btn', `btn-${variant}`, size === 'lg' && 'btn-lg', fullWidth && 'btn-block', className)}
      {...rest}
    />
  )
)
Button.displayName = 'Button'
