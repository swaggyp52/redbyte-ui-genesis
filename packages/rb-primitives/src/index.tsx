import React, { useEffect, useMemo, useRef, useState } from "react";

type MergeElementProps<E extends React.ElementType, P> = P &
  Omit<React.ComponentPropsWithoutRef<E>, keyof P | "as"> & { as?: E };

export type PolymorphicComponentProps<E extends React.ElementType, P = {}> = MergeElementProps<E, P>;

const baseFocusClasses =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--rb-color-accent-400,#24b1ff)]";

export type ButtonProps<E extends React.ElementType = "button"> = PolymorphicComponentProps<
  E,
  {
    variant?: "primary" | "ghost";
  }
>;

export const Button = React.forwardRef<HTMLElement, ButtonProps>(function Button(
  { as, children, className = "", variant = "primary", ...rest },
  forwardedRef,
) {
  const Component = (as ?? "button") as React.ElementType;
  const base =
    variant === "primary"
      ? "bg-[color:var(--rb-color-accent-500,#0097e6)] text-white hover:bg-[color:var(--rb-color-accent-400,#24b1ff)]"
      : "bg-transparent text-[color:var(--rb-color-text-100,#e2e8f5)] hover:bg-[color:var(--rb-color-surface-200,#111a36)]";
  return (
    <Component
      ref={forwardedRef as React.Ref<HTMLElement>}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-200 ${base} ${baseFocusClasses} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
});

export type PanelProps<E extends React.ElementType = "div"> = PolymorphicComponentProps<E, {}>;
export const Panel = React.forwardRef<HTMLElement, PanelProps>(function Panel(
  { as, children, className = "", ...rest },
  forwardedRef,
) {
  const Component = (as ?? "div") as React.ElementType;
  return (
    <Component
      ref={forwardedRef as React.Ref<HTMLElement>}
      className={`rounded-xl border border-[color:var(--rb-color-surface-400,#152a56)] bg-[color:var(--rb-color-surface-200,#111a36)]/70 p-4 shadow-lg ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
});

export type TextProps<E extends React.ElementType = "span"> = PolymorphicComponentProps<
  E,
  { weight?: "regular" | "medium" | "bold" }
>;
export const Text = React.forwardRef<HTMLElement, TextProps>(function Text(
  { as, children, className = "", weight = "regular", ...rest },
  forwardedRef,
) {
  const Component = (as ?? "span") as React.ElementType;
  const weightValue = { regular: 400, medium: 500, bold: 700 }[weight];
  return (
    <Component
      ref={forwardedRef as React.Ref<HTMLElement>}
      className={`text-[color:var(--rb-color-text-100,#e2e8f5)] ${className}`}
      style={{ fontWeight: weightValue }}
      {...rest}
    >
      {children}
    </Component>
  );
});

export interface TooltipProps {
  label: string;
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  const id = useMemo(() => `rb-tooltip-${Math.random().toString(36).slice(2)}`, []);

  const show = (): void => setOpen(true);
  const hide = (): void => setOpen(false);

  const child = React.cloneElement(children, {
    onFocus: (event: React.FocusEvent) => {
      children.props.onFocus?.(event);
      show();
    },
    onBlur: (event: React.FocusEvent) => {
      children.props.onBlur?.(event);
      hide();
    },
    onMouseEnter: (event: React.MouseEvent) => {
      children.props.onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event: React.MouseEvent) => {
      children.props.onMouseLeave?.(event);
      hide();
    },
    "aria-describedby": open ? id : undefined,
  });

  return (
    <span className="relative inline-flex items-center">
      {child}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-1 text-xs text-white shadow"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
};

export interface MenuItem {
  id: string;
  label: string;
  onSelect?: () => void;
}

export interface MenuProps {
  label: string;
  items: MenuItem[];
}

export const Menu: React.FC<MenuProps> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const close = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Escape") {
      close();
    } else if (event.key === "Enter" && open) {
      const item = items[activeIndex];
      item?.onSelect?.();
      close();
    }
  };

  useEffect(() => {
    if (open) {
      const list = listRef.current;
      const active = list?.querySelectorAll<HTMLLIElement>("li")[activeIndex];
      active?.focus();
    }
  }, [open, activeIndex]);

  return (
    <div className="relative inline-block" onKeyDown={onKeyDown}>
      <Button
        ref={(node) => {
          triggerRef.current = node as HTMLButtonElement | null;
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Button>
      {open ? (
        <ul
          ref={listRef}
          role="menu"
          className="absolute mt-2 w-48 rounded-md border border-[color:var(--rb-color-surface-400,#152a56)] bg-[color:var(--rb-color-surface-100,#0e1328)] p-1 shadow-lg"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                item.onSelect?.();
                close();
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer rounded-sm px-3 py-2 text-sm text-[color:var(--rb-color-text-100,#e2e8f5)] hover:bg-[color:var(--rb-color-surface-300,#132143)] ${
                index === activeIndex ? "bg-[color:var(--rb-color-surface-300,#132143)]" : ""
              }`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-md border border-[color:var(--rb-color-surface-400,#152a56)] bg-[color:var(--rb-color-surface-100,#0e1328)] px-3 py-2 text-sm text-[color:var(--rb-color-text-100,#e2e8f5)] ${baseFocusClasses} ${className}`}
      {...rest}
    />
  );
});

export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed?: boolean;
  onChange?: (next: boolean) => void;
}

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { pressed = false, onChange, children, className = "", ...rest },
  ref,
) {
  const [internal, setInternal] = useState(pressed);
  useEffect(() => setInternal(pressed), [pressed]);

  const nextState = (): void => {
    const next = !internal;
    setInternal(next);
    onChange?.(next);
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={internal}
      onClick={nextState}
      className={`rounded-full border border-[color:var(--rb-color-surface-400,#152a56)] px-4 py-2 text-sm text-[color:var(--rb-color-text-100,#e2e8f5)] ${
        internal ? "bg-[color:var(--rb-color-accent-500,#0097e6)] text-white" : ""
      } ${baseFocusClasses} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", options, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={`w-full rounded-md border border-[color:var(--rb-color-surface-400,#152a56)] bg-[color:var(--rb-color-surface-100,#0e1328)] px-3 py-2 text-sm text-[color:var(--rb-color-text-100,#e2e8f5)] ${baseFocusClasses} ${className}`}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
});
