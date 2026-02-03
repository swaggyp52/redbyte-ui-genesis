import { jsx as _jsx } from "react/jsx-runtime";
export const MenuItem = ({ children, label, onClick, disabled }) => (_jsx("button", { role: "menuitem", onClick: onClick, disabled: disabled, "aria-disabled": disabled, className: "w-full text-left px-[var(--rb-spacing-3)] py-[var(--rb-spacing-2)] text-[var(--rb-font-size-base)] hover:bg-[var(--rb-color-neutral-200)] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:bg-[var(--rb-color-accent-100)] transition-colors duration-[var(--rb-duration-fast)]", children: children || label }));
export const MenuSeparator = () => (_jsx("div", { className: "h-px bg-[var(--rb-color-neutral-200)] my-[var(--rb-spacing-1)]", role: "separator" }));
// Default export combined with named exports
const MenuComponent = ({ items = [], children, className, label = 'Menu' }) => {
    // Use children if present, otherwise fallback to items map
    const content = children || (Array.isArray(items) ? items.map((item, index) => (_jsx(MenuItem, { ...item }, index))) : null);
    if (!content) {
        if (import.meta.env.DEV) {
            // Only warn if truly empty (no items AND no children)
            console.warn('[Menu] No items or children provided');
        }
        return null;
    }
    return (_jsx("div", { role: "menu", "aria-label": label, className: `bg-[var(--rb-color-neutral-50)] rounded-[var(--rb-radius-md)] shadow-[var(--rb-shadow-lg)] py-[var(--rb-spacing-1)] ${className || ''}`, children: content }));
};
// Attach subcomponents
MenuComponent.Item = MenuItem;
MenuComponent.Separator = MenuSeparator;
export const Menu = MenuComponent;
