import { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-cf-orange hover:bg-cf-orange/90 text-white',
  secondary: 'bg-cf-dark-600 hover:bg-cf-dark-700 text-white border border-cf-dark-600',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
}

export default function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
