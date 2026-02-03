import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Button - Accessible polymorphic button component
 */
export function Button({ as, variant = 'primary', size = 'md', disabled, children, ariaLabel, ...props }) {
    const Component = as || 'button';
    const role = Component === 'button' ? undefined : 'button';
    const baseStyles = [
        'inline-flex',
        'items-center',
        'justify-center',
        'font-medium',
        'rounded-[var(--rb-radius-md)]',
        'transition-colors',
        'duration-[var(--rb-duration-fast)]',
        'focus-visible:outline',
        'focus-visible:outline-2',
        'focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--rb-color-accent-500)]',
        'disabled:opacity-50',
        'disabled:cursor-not-allowed',
    ];
    const variantStyles = {
        primary: [
            'bg-[var(--rb-color-accent-500)]',
            'text-white',
            'hover:bg-[var(--rb-color-accent-600)]',
            'active:bg-[var(--rb-color-accent-700)]',
        ],
        secondary: [
            'bg-[var(--rb-color-neutral-200)]',
            'text-[var(--rb-color-neutral-900)]',
            'hover:bg-[var(--rb-color-neutral-300)]',
            'active:bg-[var(--rb-color-neutral-400)]',
        ],
        ghost: [
            'bg-transparent',
            'text-[var(--rb-color-neutral-700)]',
            'hover:bg-[var(--rb-color-neutral-100)]',
            'active:bg-[var(--rb-color-neutral-200)]',
        ],
        destructive: [
            'bg-[var(--rb-color-destructive-500)]',
            'text-white',
            'hover:bg-[var(--rb-color-destructive-600)]',
            'active:bg-[var(--rb-color-destructive-700)]',
        ],
    };
    const sizeStyles = {
        sm: ['text-[var(--rb-font-size-sm)]', 'px-[var(--rb-spacing-3)]', 'py-[var(--rb-spacing-1)]'],
        md: ['text-[var(--rb-font-size-base)]', 'px-[var(--rb-spacing-4)]', 'py-[var(--rb-spacing-2)]'],
        lg: ['text-[var(--rb-font-size-lg)]', 'px-[var(--rb-spacing-6)]', 'py-[var(--rb-spacing-3)]'],
    };
    const className = [...baseStyles, ...variantStyles[variant], ...sizeStyles[size]].join(' ');
    return (_jsx(Component, { className: className, disabled: disabled, "aria-disabled": disabled, role: role, "aria-label": ariaLabel, type: props.type || (Component === 'button' ? 'button' : undefined), ...props, children: children }));
}
