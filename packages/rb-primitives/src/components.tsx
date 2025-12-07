import React, { forwardRef, useId, useMemo, useRef, useState } from 'react';
import type { ElementType } from 'react';
import type { PolymorphicComponentProps, PolymorphicRef } from './polymorphic';

const focusRingStyle: React.CSSProperties = {
  outline: '2px solid var(--rb-color-accent-500, #6c7cff)',
  outlineOffset: '2px',
};

const baseSurfaceStyle: React.CSSProperties = {
  borderRadius: 'var(--rb-radius-md, 10px)',
  background: 'var(--rb-color-surface-900, #0d1017ff)',
  color: 'var(--rb-color-neutral-900, #e5e9f0)',
  border: '1px solid var(--rb-color-surface-700, #0d1017b8)',
};

type ButtonOwnProps = {
  variant?: 'primary' | 'ghost';
  icon?: React.ReactNode;
};

type ButtonProps<E extends ElementType> = PolymorphicComponentProps<E, ButtonOwnProps>;

export const Button = forwardRef(function Button<E extends ElementType = 'button'> (
  { as, children, onClick, variant = 'primary', icon, ...rest }: ButtonProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'button') as ElementType;
  const isNativeButton = Component === 'button';
  const [isActive, setActive] = useState(false);

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (event) => {
    if (!isNativeButton && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick?.(event as never);
    }
    if (event.key === ' ') {
      setActive(true);
    }
  };

  const handleKeyUp: React.KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.key === ' ') {
      setActive(false);
    }
  };

  const background =
    variant === 'primary'
      ? 'var(--rb-color-accent-700, #6c7cffb8)'
      : 'var(--rb-color-surface-700, #0d1017b8)';

  return (
    <Component
      ref={ref}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      role={isNativeButton ? undefined : 'button'}
      tabIndex={isNativeButton ? undefined : 0}
      style={{
        ...baseSurfaceStyle,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--rb-spacing-sm, 8px)',
        padding: '8px 14px',
        cursor: 'pointer',
        background,
        boxShadow: isActive ? 'inset 0 0 0 2px var(--rb-color-accent-500, #6c7cff)' : baseSurfaceStyle.border,
        transition: `background ${'var(--rb-motion-duration-fast, 150ms)'} ease`,
      }}
      {...rest}
    >
      {icon}
      <span style={{ fontWeight: 600 }}>{children}</span>
    </Component>
  );
});

Button.displayName = 'Button';

type PanelOwnProps = {
  interactive?: boolean;
};

type PanelProps<E extends ElementType> = PolymorphicComponentProps<E, PanelOwnProps>;

export const Panel = forwardRef(function Panel<E extends ElementType = 'div'> (
  { as, children, interactive = false, ...rest }: PanelProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'div') as ElementType;
  return (
    <Component
      ref={ref}
      style={{
        ...baseSurfaceStyle,
        padding: 'var(--rb-spacing-lg, 16px)',
        boxShadow: interactive ? 'var(--rb-shadow-md, 0 8px 24px rgba(0,0,0,0.18))' : undefined,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
});

Panel.displayName = 'Panel';

type TextOwnProps = {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  weight?: 'regular' | 'medium' | 'bold';
};

type TextProps<E extends ElementType> = PolymorphicComponentProps<E, TextOwnProps>;

export const Text = forwardRef(function Text<E extends ElementType = 'span'> (
  { as, children, size = 'md', weight = 'regular', ...rest }: TextProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'span') as ElementType;
  const fontSize = `var(--rb-typography-size-${size}, ${size === 'md' ? '16px' : '14px'})`;
  const fontWeight = `var(--rb-typography-weight-${weight}, ${weight === 'medium' ? '600' : weight === 'bold' ? '700' : '400'})`;
  return (
    <Component ref={ref} style={{ fontSize, fontWeight }} {...rest}>
      {children}
    </Component>
  );
});

Text.displayName = 'Text';

type TooltipOwnProps = {
  content: React.ReactNode;
};

type TooltipProps<E extends ElementType> = PolymorphicComponentProps<E, TooltipOwnProps>;

export const Tooltip = forwardRef(function Tooltip<E extends ElementType = 'span'> (
  { as, children, content, ...rest }: TooltipProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'span') as ElementType;
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <Component
      ref={ref}
      aria-describedby={tooltipId}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      {...rest}
    >
      {children}
      <div
        id={tooltipId}
        role="tooltip"
        aria-hidden={!open}
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(100% + 6px)',
          padding: '6px 10px',
          borderRadius: 'var(--rb-radius-sm, 6px)',
          background: 'var(--rb-color-neutral-900, #0d1017ff)',
          color: 'var(--rb-color-surface-50, #fff)',
          whiteSpace: 'nowrap',
          boxShadow: 'var(--rb-shadow-sm, 0 1px 2px rgba(0,0,0,0.18))',
          opacity: open ? 1 : 0,
          pointerEvents: 'none',
          transition: `opacity var(--rb-motion-duration-fast, 150ms) ease`,
          zIndex: 10,
        }}
      >
        {content}
      </div>
    </Component>
  );
});

Tooltip.displayName = 'Tooltip';

type MenuItem = { id: string; label: string; disabled?: boolean };

type MenuOwnProps = {
  items: MenuItem[];
  onSelect?: (id: string) => void;
};

type MenuProps<E extends ElementType> = PolymorphicComponentProps<E, MenuOwnProps>;

export const Menu = forwardRef(function Menu<E extends ElementType = 'div'> (
  { as, items, onSelect, ...rest }: MenuProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'div') as ElementType;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(items.length - 1, index + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item && !item.disabled) {
        onSelect?.(item.id);
      }
    }
  };

  return (
    <Component
      ref={ref}
      role="menu"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ ...baseSurfaceStyle, padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}
      {...rest}
    >
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            aria-disabled={item.disabled}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => !item.disabled && onSelect?.(item.id)}
            style={{
              ...focusRingStyle,
              outline: isActive ? focusRingStyle.outline : 'none',
              borderRadius: 'var(--rb-radius-sm, 6px)',
              padding: '8px 10px',
              textAlign: 'left',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              backgroundColor: isActive
                ? 'var(--rb-color-surface-700, #0d1017b8)'
                : 'transparent',
              color: item.disabled ? 'var(--rb-color-neutral-400, #a0a0a0)' : 'inherit',
            }}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </Component>
  );
});

Menu.displayName = 'Menu';

type InputOwnProps = {
  label?: string;
};

type InputProps<E extends ElementType> = PolymorphicComponentProps<E, InputOwnProps>;

export const Input = forwardRef(function Input<E extends ElementType = 'input'> (
  { as, label, id, ...rest }: InputProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'input') as ElementType;
  const inputId = id ?? useId();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && <Text as="span" size="sm" weight="medium">{label}</Text>}
      <Component
        ref={ref}
        id={inputId}
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--rb-radius-sm, 6px)',
          border: '1px solid var(--rb-color-surface-600, #1b2333)',
          background: 'var(--rb-color-surface-800, #0d1017db)',
          color: 'inherit',
        }}
        {...rest}
      />
    </label>
  );
});

Input.displayName = 'Input';

type ToggleOwnProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
};

type ToggleProps<E extends ElementType> = PolymorphicComponentProps<E, ToggleOwnProps>;

export const Toggle = forwardRef(function Toggle<E extends ElementType = 'button'> (
  { as, checked, defaultChecked, onChange, ...rest }: ToggleProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'button') as ElementType;
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
  const isControlled = typeof checked === 'boolean';
  const current = isControlled ? checked : internalChecked;

  const toggle = (): void => {
    const next = !current;
    if (!isControlled) {
      setInternalChecked(next);
    }
    onChange?.(next);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <Component
      ref={ref}
      role="switch"
      aria-checked={current}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        ...baseSurfaceStyle,
        width: '52px',
        height: '28px',
        padding: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: current ? 'flex-end' : 'flex-start',
        cursor: 'pointer',
        background: current
          ? 'var(--rb-color-accent-600, #6c7cff94)'
          : 'var(--rb-color-surface-700, #0d1017b8)',
      }}
      {...rest}
    >
      <span
        aria-hidden
        style={{
          width: '20px',
          height: '20px',
          background: 'white',
          borderRadius: '999px',
          boxShadow: 'var(--rb-shadow-sm, 0 1px 2px rgba(0,0,0,0.18))',
        }}
      />
    </Component>
  );
});

Toggle.displayName = 'Toggle';

type SelectOption = { label: string; value: string; disabled?: boolean };

type SelectOwnProps = {
  options: SelectOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
};

type SelectProps<E extends ElementType> = PolymorphicComponentProps<E, SelectOwnProps>;

export const Select = forwardRef(function Select<E extends ElementType = 'div'> (
  { as, options, placeholder = 'Select', value, defaultValue, onChange, ...rest }: SelectProps<E>,
  ref: PolymorphicRef<E>,
) {
  const Component = (as ?? 'div') as ElementType;
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? '');
  const [highlighted, setHighlighted] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const isControlled = typeof value === 'string';
  const currentValue = isControlled ? value : internalValue;
  const currentOption = useMemo(
    () => options.find((option) => option.value === currentValue),
    [currentValue, options],
  );

  const commitValue = (next: string): void => {
    if (!isControlled) {
      setInternalValue(next);
    }
    onChange?.(next);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const visibleLabel = currentOption?.label ?? placeholder;

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => Math.min(options.length - 1, index + 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => Math.max(0, index - 1));
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[highlighted];
      if (option && !option.disabled) {
        commitValue(option.value);
      }
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <Component style={{ position: 'relative', display: 'inline-block', minWidth: '200px' }} {...rest}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
        onKeyDown={handleKeyDown}
        style={{
          ...baseSurfaceStyle,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '10px 12px',
          cursor: 'pointer',
        }}
      >
        <span>{visibleLabel}</span>
        <span aria-hidden style={{ transform: open ? 'rotate(180deg)' : undefined }}>
          ▼
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          style={{
            ...baseSurfaceStyle,
            position: 'absolute',
            marginTop: '4px',
            width: '100%',
            maxHeight: '220px',
            overflowY: 'auto',
            padding: 0,
            listStyle: 'none',
            zIndex: 20,
          }}
        >
          {options.map((option, index) => {
            const isActive = index === highlighted;
            const selected = option.value === currentValue;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => !option.disabled && commitValue(option.value)}
                  disabled={option.disabled}
                  style={{
                    ...focusRingStyle,
                    outline: isActive ? focusRingStyle.outline : 'none',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    background: selected
                      ? 'var(--rb-color-accent-700, #6c7cffb8)'
                      : 'transparent',
                    color: option.disabled ? 'var(--rb-color-neutral-400, #a0a0a0)' : 'inherit',
                    cursor: option.disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Component>
  );
});

Select.displayName = 'Select';
