import { jsx as _jsx } from "react/jsx-runtime";
export function Panel({ as, variant = 'default', padding = 'md', children, ...props }) {
    const Component = as || 'div';
    const baseStyles = [
        'rounded-[var(--rb-radius-lg)]',
        'bg-[var(--rb-color-neutral-50)]',
    ];
    const variantStyles = {
        default: [],
        elevated: ['shadow-[var(--rb-shadow-lg)]'],
        outlined: ['border', 'border-[var(--rb-color-neutral-300)]'],
    };
    const paddingStyles = {
        none: [],
        sm: ['p-[var(--rb-spacing-2)]'],
        md: ['p-[var(--rb-spacing-4)]'],
        lg: ['p-[var(--rb-spacing-6)]'],
    };
    const className = [...baseStyles, ...variantStyles[variant], ...paddingStyles[padding]].join(' ');
    return (_jsx(Component, { className: className, ...props, children: children }));
}
