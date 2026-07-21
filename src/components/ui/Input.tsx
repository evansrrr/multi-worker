import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full px-3 py-2 bg-cf-dark-800 border rounded-lg 
            text-white placeholder-gray-500 
            focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent
            ${error ? 'border-red-500' : 'border-cf-dark-600'} 
            ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
