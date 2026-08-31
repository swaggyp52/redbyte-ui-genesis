import React, { useMemo, useState } from 'react';

/**
 * Virtual Basys3 board — Browser E0.
 *
 * A live, interactive rendering of the Basys3 physical controls driven by the
 * SAME canonical simulation engine and board mapping as the rest of RedByte:
 * toggling a mapped switch drives its mapped logical input, and simulated
 * outputs illuminate their mapped LEDs. This is browser simulation of the
 * mapped design, NOT hardware proof — synthesis, bitstream generation,
 * programming, and physical behavior remain downstream and unproven.
 */

export interface VirtualBoardResourceMap {
  /** Logical signal label mapped to this resource alias (e.g. SW0 → "A[0]"). */
  signalLabel: string;
  /** Package pin for the resource (e.g. "V17"), when known. */
  pin: string | null;
}

export interface VirtualBasys3BoardProps {
  /** Live switch values, index 0..15 (SW0..SW15). */
  switches: ReadonlyArray<0 | 1>;
  /** Live LED values, index 0..15 (LD0..LD15). */
  leds: ReadonlyArray<0 | 1>;
  /** Live button values, index 0..4 (BTNC,BTNU,BTND,BTNL,BTNR). */
  buttons?: ReadonlyArray<0 | 1>;
  /** Which SW indices are mapped to a logical input (interactive). */
  mappedSwitches: ReadonlyArray<boolean>;
  /** Which LD indices are mapped to a logical output. */
  mappedLeds: ReadonlyArray<boolean>;
  /** alias (SW0/LD0/BTNC) → mapped logical signal + pin, for cross-probe. */
  resourceMap?: Record<string, VirtualBoardResourceMap>;
  onToggleSwitch?: (index: number) => void;
  onPressButton?: (index: number, pressed: boolean) => void;
  /** Called when a resource is focused, to cross-highlight Design/Analyzer. */
  onFocusResource?: (alias: string | null) => void;
}

const BTN_LABELS = ['BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR'] as const;

export const VirtualBasys3Board: React.FC<VirtualBasys3BoardProps> = ({
  switches,
  leds,
  buttons = [0, 0, 0, 0, 0],
  mappedSwitches,
  mappedLeds,
  resourceMap = {},
  onToggleSwitch,
  onPressButton,
  onFocusResource,
}) => {
  const [focused, setFocused] = useState<string | null>(null);

  // Basys3 physical order is MSB-left: SW15 … SW0, LD15 … LD0.
  const columns = useMemo(() => Array.from({ length: 16 }, (_, i) => 15 - i), []);

  const focus = (alias: string | null) => {
    setFocused(alias);
    onFocusResource?.(alias);
  };

  const describe = (alias: string): string => {
    const entry = resourceMap[alias];
    if (!entry) return `${alias} · unmapped`;
    const pin = entry.pin ? ` · ${entry.pin}` : '';
    return `${alias} → ${entry.signalLabel}${pin}`;
  };

  const mappedCount =
    mappedSwitches.filter(Boolean).length + mappedLeds.filter(Boolean).length;

  return (
    <section
      className="rb-vboard"
      data-testid="ide-virtual-board"
      aria-label="Virtual Basys3 board (browser simulation)"
    >
      <header className="rb-vboard__head">
        <div>
          <p className="rb-vboard__eyebrow">Virtual board · Browser E0</p>
          <h3 className="rb-vboard__title">Basys3 — browser simulation</h3>
        </div>
        <p className="rb-vboard__note" data-testid="ide-virtual-board-boundary">
          Browser simulation of the mapped design. Not synthesis, bitstream, or
          hardware proof.
        </p>
      </header>

      <div className="rb-vboard__readout" data-testid="ide-virtual-board-readout" aria-live="polite">
        {focused ? describe(focused) : `${mappedCount} mapped control${mappedCount === 1 ? '' : 's'}`}
      </div>

      {/* LEDs (outputs) */}
      <div className="rb-vboard__row rb-vboard__leds" role="group" aria-label="LEDs">
        {columns.map((i) => {
          const alias = `LD${i}`;
          const on = leds[i] === 1;
          const mapped = mappedLeds[i];
          return (
            <div
              key={alias}
              className="rb-vboard__led-cell"
              onMouseEnter={() => focus(alias)}
              onMouseLeave={() => focus(null)}
            >
              <span
                data-testid={`ide-virtual-board-led-${i}`}
                data-on={on ? '1' : '0'}
                data-mapped={mapped ? '1' : '0'}
                className={[
                  'rb-vboard__led',
                  on ? 'is-on' : '',
                  mapped ? 'is-mapped' : '',
                  focused === alias ? 'is-focused' : '',
                ].filter(Boolean).join(' ')}
              />
              <span className="rb-vboard__cap">{i}</span>
            </div>
          );
        })}
      </div>

      {/* Switches (inputs) */}
      <div className="rb-vboard__row rb-vboard__switches" role="group" aria-label="Switches">
        {columns.map((i) => {
          const alias = `SW${i}`;
          const up = switches[i] === 1;
          const mapped = mappedSwitches[i];
          return (
            <div
              key={alias}
              className="rb-vboard__sw-cell"
              onMouseEnter={() => focus(alias)}
              onMouseLeave={() => focus(null)}
            >
              <button
                type="button"
                data-testid={`ide-virtual-board-sw-${i}`}
                data-on={up ? '1' : '0'}
                data-mapped={mapped ? '1' : '0'}
                className={[
                  'rb-vboard__sw',
                  up ? 'is-up' : 'is-down',
                  mapped ? 'is-mapped' : '',
                  focused === alias ? 'is-focused' : '',
                ].filter(Boolean).join(' ')}
                disabled={!mapped}
                aria-pressed={up}
                aria-label={`Switch ${alias}${mapped ? `, mapped to ${resourceMap[alias]?.signalLabel ?? 'input'}` : ', unmapped'}`}
                title={describe(alias)}
                onClick={() => mapped && onToggleSwitch?.(i)}
              >
                <span className="rb-vboard__sw-knob" />
              </button>
              <span className="rb-vboard__cap">{i}</span>
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="rb-vboard__row rb-vboard__buttons" role="group" aria-label="Push buttons">
        {BTN_LABELS.map((label, i) => {
          const pressed = buttons[i] === 1;
          const mapped = Boolean(resourceMap[label]);
          return (
            <button
              key={label}
              type="button"
              data-testid={`ide-virtual-board-btn-${label}`}
              data-on={pressed ? '1' : '0'}
              className={[
                'rb-vboard__btn',
                pressed ? 'is-pressed' : '',
                mapped ? 'is-mapped' : '',
              ].filter(Boolean).join(' ')}
              disabled={!mapped}
              title={describe(label)}
              onMouseDown={() => mapped && onPressButton?.(i, true)}
              onMouseUp={() => mapped && onPressButton?.(i, false)}
              onMouseLeave={() => pressed && onPressButton?.(i, false)}
            >
              {label.replace('BTN', '')}
            </button>
          );
        })}
      </div>
    </section>
  );
};
