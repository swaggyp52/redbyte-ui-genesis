import { jsx as _jsx } from "react/jsx-runtime";
export function Text({ as, size = 'base', weight = 'normal', color = 'default', children, ...props }) {
    const Component = as || 'span';
    const sizeStyles = {
        xs: 'text-[var(--rb-font-size-xs)]',
        sm: 'text-[var(--rb-font-size-sm)]',
        base: 'text-[var(--rb-font-size-base)]',
        lg: 'text-[var(--rb-font-size-lg)]',
        xl: 'text-[var(--rb-font-size-xl)]',
        '2xl': 'text-[var(--rb-font-size-2xl)]',
        '3xl': 'text-[var(--rb-font-size-3xl)]',
    };
    const weightStyles = {
        normal: 'font-[var(--rb-font-weight-normal)]',
        medium: 'font-[var(--rb-font-weight-medium)]',
        semibold: 'font-[var(--rb-font-weight-semibold)]',
        bold: 'font-[var(--rb-font-weight-bold)]',
    };
    const colorStyles = {
        default: 'text-[var(--rb-color-neutral-900)]',
        muted: 'text-[var(--rb-color-neutral-600)]',
        accent: 'text-[var(--rb-color-accent-500)]',
    };
    const className = [sizeStyles[size], weightStyles[weight], colorStyles[color]].join(' ');
    return (_jsx(Component, { className: className, ...props, children: children }));
}
