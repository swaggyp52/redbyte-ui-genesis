import { jsx as _jsx } from "react/jsx-runtime";
const variantStyles = {
    default: 'bg-slate-800 border-slate-700',
    info: 'bg-slate-800 border-slate-700',
    success: 'bg-blue-950 border-blue-800',
    reflect: 'bg-slate-800 border-slate-700',
};
/**
 * Callout - Highlighted content box
 * Used for key explanations, tips, and reflections
 */
export const Callout = ({ variant = 'default', children, className = '' }) => {
    const isReflect = variant === 'reflect';
    return (_jsx("div", { className: `p-4 rounded border ${variantStyles[variant]} ${className}`, children: isReflect ? (_jsx("div", { className: "italic text-gray-400", children: children })) : (_jsx("div", { className: "text-gray-200", children: children })) }));
};
