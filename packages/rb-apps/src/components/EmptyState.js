import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from '@redbyte/rb-icons';
export const EmptyState = ({ icon, title, description, action, className }) => {
    return (_jsxs("div", { className: `flex flex-col items-center justify-center text-center gap-3 px-6 py-8 ${className ?? ''}`, style: { color: 'var(--rb-muted)' }, children: [_jsx("div", { className: "h-12 w-12 rounded-2xl border flex items-center justify-center", style: {
                    background: 'var(--rb-surface-2)',
                    borderColor: 'var(--rb-border)',
                    color: 'var(--rb-text)',
                    boxShadow: 'var(--rb-shadow-1)',
                }, children: _jsx(Icon, { name: icon, size: 24 }) }), _jsx("div", { className: "text-sm font-semibold", style: { color: 'var(--rb-text)' }, children: title }), description && (_jsx("div", { className: "text-xs max-w-sm", style: { color: 'var(--rb-faint)' }, children: description })), action && _jsx("div", { className: "mt-2", children: action })] }));
};
