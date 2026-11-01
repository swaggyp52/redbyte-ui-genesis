import React from 'react';
import type { BoardModel, BoardPart } from './boardModel';

/**
 * Physical perspective: the Basys3 drawn once, from the board catalog's own coordinates, with
 * the project's XDC bindings (boardModel). LEDs light only from a recording (never from
 * exploration, never as a photograph of a lit board); switches and buttons show the input
 * values of the Moment. The legend says what the board shows: a recorded tick (simulation, not
 * a board observation), live switches while exploring, or why recorded values were withdrawn.
 */
export interface BoardLensProps {
  readonly model: BoardModel;
  /** Recorded value of each mapped resource at the Moment (LEDs light only from these). */
  readonly recorded: ReadonlyMap<string, 0 | 1 | null> | null;
  /** Input level of mapped switches and buttons at the Moment (recorded or live). */
  readonly inputs: ReadonlyMap<string, 0 | 1 | null>;
  readonly selectedNodeId: string | null;
  readonly legend: React.ReactNode;
  readonly onSelectNode: (nodeId: string) => void;
}

const BUTTON_WORDS: Readonly<Record<string, string>> = {
  BTNC: 'centre button', BTNU: 'up button', BTNL: 'left button', BTNR: 'right button', BTND: 'down button',
};

function MappedLabel({ part }: { part: BoardPart }) {
  if (!part.mapped) return null;
  const { label } = part.mapped;
  return (
    <>
      {label.leader ? <line className="mrd-board-leader" x1={label.leader[0]} y1={label.leader[1]} x2={label.leader[2]} y2={label.leader[3]} /> : null}
      <text className="mrd-board-mapped-label" x={label.x} y={label.y} textAnchor={label.anchor}>{label.text}</text>
    </>
  );
}

/** Board parts that carry a signal are controls: reachable by Tab, named, and activated by Enter or Space. */
function partControl(name: string, onActivate: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': name,
    onClick: onActivate,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onActivate();
    },
  };
}

export const BoardLens: React.FC<BoardLensProps> = ({ model, recorded, inputs, selectedNodeId, legend, onSelectNode }) => {
  const { parts, clock } = model;
  // LEDs and switches print their number; the row caption names the family (LD, SW), so 16
  // labels fit a row at the 12px floor. The full name stays in each part's title.
  const rowCaption = (category: 'led' | 'switch', caption: string, dy: number) => {
    const row = parts.filter((part) => part.category === category);
    if (row.length === 0) return null;
    const left = Math.min(...row.map((part) => part.x));
    return <text className="mrd-board-silk mrd-board-row" x={left - 14} y={row[0].y + dy} textAnchor="end">{caption}</text>;
  };
  const buttonKey = parts.filter((part) => part.category === 'button' && part.mapped)
    .map((part) => `${part.mapped!.signal} = ${BUTTON_WORDS[part.alias] ?? part.alias} (${part.alias} · ${part.packagePin})`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <svg className="mrd-board" viewBox="0 0 620 260" role="group" aria-label="Basys3 board" data-testid="meridian-board" preserveAspectRatio="xMidYMid meet" style={{ flex: '1 1 auto', minWidth: 560, minHeight: 234 }}>
        <rect className="mrd-board-plane" x={4} y={4} width={612} height={252} rx={10} />
        <rect className="mrd-board-chip" x={286} y={92} width={92} height={74} rx={3} />
        <text className="mrd-board-silk" x={332} y={124} textAnchor="middle">XC7A35T</text>
        <text className="mrd-board-silk" x={332} y={141} textAnchor="middle">CPG236</text>
        <g data-board-resource="CLK100MHZ" className={clock ? 'mrd-board-mapped' : undefined}
          {...(clock ? partControl(`${clock.signal} on the 100 MHz oscillator, CLK100MHZ, pin W5`, () => onSelectNode(clock.nodeId)) : {})}>
          <title>100 MHz oscillator CLK100MHZ · W5</title>
          <rect className="mrd-board-focus" x={446} y={96} width={136} height={46} rx={5} />
          <rect className="mrd-board-chip" x={452} y={102} width={124} height={34} rx={3} />
          <text className="mrd-board-silk" x={514} y={115} textAnchor="middle">100 MHz osc</text>
          <text className="mrd-board-silk" x={514} y={132} textAnchor="middle">W5{clock ? ` · ${clock.signal}` : ''}</text>
          {clock && selectedNodeId === clock.nodeId ? <rect className="mrd-board-select" x={448} y={98} width={132} height={42} rx={4} /> : null}
        </g>
        {rowCaption('led', 'LD', 19)}
        {rowCaption('switch', 'SW', 24)}
        {parts.map((part) => {
          const { x, y, mapped } = part;
          const alias = part.alias.toUpperCase();
          const selected = mapped && selectedNodeId === mapped.nodeId;
          const common = {
            'data-board-resource': part.alias,
            'data-mapped': mapped ? mapped.signal : undefined,
            'data-package-pin': part.packagePin,
            className: mapped ? 'mrd-board-mapped' : undefined,
            ...(mapped ? partControl(`${mapped.signal} on ${part.name}, pin ${part.packagePin}`, () => onSelectNode(mapped.nodeId)) : {}),
          };
          const focus = mapped ? <rect className="mrd-board-focus" x={x - 18} y={y - 18} width={36} height={36} rx={4} /> : null;
          const title = <title>{`${part.name} · ${part.packagePin}${mapped ? ` · ${mapped.signal}` : ''}`}</title>;
          if (part.category === 'led') {
            const value = mapped ? recorded?.get(alias) ?? null : null;
            const state = !mapped || recorded === null ? 'off' : value === 1 ? '1' : value === 0 ? '0' : 'none';
            return (
              <g key={part.alias} {...common} data-value={state}>
                {title}
                {focus}
                <circle className="mrd-board-led" data-value={state} cx={x} cy={y} r={7} />
                <text className="mrd-board-silk" x={x} y={y + 19} textAnchor="middle">{part.alias.replace(/^LD/, '')}</text>
                <MappedLabel part={part} />
                {selected ? <circle className="mrd-board-select" cx={x} cy={y} r={11} /> : null}
              </g>
            );
          }
          if (part.category === 'switch') {
            const value = mapped ? inputs.get(alias) ?? null : null;
            return (
              <g key={part.alias} {...common} data-value={value === null ? 'none' : String(value)}>
                {title}
                {focus}
                <rect className="mrd-board-switch-track" x={x - 6} y={y - 12} width={12} height={24} rx={2} />
                <rect className="mrd-board-switch-knob" x={x - 4} y={value === 1 ? y - 10 : y + 1} width={8} height={9} rx={1} opacity={value === null ? 0.4 : 1} />
                <text className="mrd-board-silk" x={x} y={y + 24} textAnchor="middle">{part.alias.replace(/^SW/, '')}</text>
                <MappedLabel part={part} />
                {selected ? <rect className="mrd-board-select" x={x - 9} y={y - 15} width={18} height={30} rx={3} /> : null}
              </g>
            );
          }
          const value = mapped ? inputs.get(alias) ?? null : null;
          return (
            <g key={part.alias} {...common} data-value={value === null ? 'none' : String(value)}>
              {title}
              {focus}
              {mapped ? <circle className="mrd-board-mapped-ring" cx={x} cy={y} r={14} /> : null}
              <circle className="mrd-board-button" data-value={value === 1 ? '1' : '0'} cx={x} cy={y} r={11} />
              <text className="mrd-board-silk mrd-board-button-letter" x={x} y={y + 4} textAnchor="middle">{part.alias.replace(/^BTN/, '')}</text>
              <MappedLabel part={part} />
              {selected ? <circle className="mrd-board-select" cx={x} cy={y} r={17} /> : null}
            </g>
          );
        })}
      </svg>
      <div className="mrd-board-legend" data-testid="meridian-board-legend">
        <span>{legend}</span>
        {buttonKey.length ? <span className="mrd-board-key" data-testid="meridian-board-key">{buttonKey.join(' · ')}</span> : null}
        {model.mismatched.length ? (
          <span className="mrd-board-key" data-tone="caution">{`not drawn: ${model.mismatched.map((binding) => `${binding.label} → ${binding.name}${binding.packagePin ? ` · ${binding.packagePin}` : ''}`).join(', ')} (pin does not match the Basys3)`}</span>
        ) : null}
        {model.unplaced.length ? <span className="mrd-board-key">{`also bound, not drawn here: ${model.unplaced.map((binding) => `${binding.label} → ${binding.name}`).join(', ')}`}</span> : null}
      </div>
    </div>
  );
};
