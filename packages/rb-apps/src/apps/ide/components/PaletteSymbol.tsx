import React from 'react';

export interface PaletteSymbolProps {
  /** Component type as the circuit stores it, e.g. `AND`, `NOT`, `INPUT`, `Register1`. */
  readonly type: string;
  /** Short text shown inside a plain block when the type has no drawn symbol. */
  readonly fallback: string;
}

type Family = 'and' | 'or' | 'xor' | 'not' | 'buffer' | 'input' | 'output' | 'clock' | 'register' | 'const' | 'block';

function classify(type: string): { family: Family; inverted: boolean; inputs: 2 | 3 } {
  const name = type.toUpperCase();
  const inputs: 2 | 3 = /3$/.test(name) ? 3 : 2;
  const gate = name.replace(/\d+$/, '');
  if (gate === 'AND') return { family: 'and', inverted: false, inputs };
  if (gate === 'NAND') return { family: 'and', inverted: true, inputs };
  if (gate === 'OR') return { family: 'or', inverted: false, inputs };
  if (gate === 'NOR') return { family: 'or', inverted: true, inputs };
  if (gate === 'XOR') return { family: 'xor', inverted: false, inputs };
  if (gate === 'XNOR') return { family: 'xor', inverted: true, inputs };
  if (gate === 'NOT' || gate === 'INV') return { family: 'not', inverted: true, inputs: 2 };
  if (gate === 'BUFFER' || gate === 'BUF') return { family: 'buffer', inverted: false, inputs: 2 };
  if (gate === 'INPUT' || gate === 'SWITCH') return { family: 'input', inverted: false, inputs: 2 };
  if (gate === 'OUTPUT' || gate === 'LAMP') return { family: 'output', inverted: false, inputs: 2 };
  if (gate === 'CLOCK') return { family: 'clock', inverted: false, inputs: 2 };
  if (gate === 'GND' || gate === 'GROUND' || gate === 'VCC' || gate === 'CONST' || gate === 'CONSTANT') return { family: 'const', inverted: false, inputs: 2 };
  if (/FLIPFLOP|REGISTER|LATCH|STATEBANK|DFF|COUNTER/.test(name)) return { family: 'register', inverted: false, inputs: 2 };
  return { family: 'block', inverted: false, inputs: 2 };
}

/**
 * The symbol a part is drawn with on the sheet, small enough for a library row. It follows the
 * same ANSI outlines the schematic uses, so a student picks a gate by its shape - the thing
 * they will look for on the canvas - rather than by reading a three-letter tag.
 */
export const PaletteSymbol: React.FC<PaletteSymbolProps> = ({ type, fallback }) => {
  const { family, inverted, inputs } = classify(type);
  const tip = inverted && family !== 'not' ? 26 : 29;
  const inputYs = inputs === 3 ? [7, 12, 17] : [8.5, 15.5];
  let body: React.ReactNode;
  let leads: React.ReactNode = null;
  switch (family) {
    case 'and':
      body = <path d="M11 4 H19 A8 8 0 0 1 19 20 H11 Z" />;
      leads = inputYs.map((y) => <line key={y} x1={4} x2={11} y1={y} y2={y} />);
      break;
    case 'or':
      body = <path d="M9 4 Q14 12 9 20 Q21 20 27 12 Q21 4 9 4 Z" />;
      leads = inputYs.map((y) => <line key={y} x1={4} x2={11.5} y1={y} y2={y} />);
      break;
    case 'xor':
      body = (
        <>
          <path d="M11 4 Q16 12 11 20 Q22 20 27 12 Q22 4 11 4 Z" />
          <path d="M7.5 4 Q12.5 12 7.5 20" fill="none" />
        </>
      );
      leads = inputYs.map((y) => <line key={y} x1={3} x2={9.5} y1={y} y2={y} />);
      break;
    case 'not':
    case 'buffer':
      body = <path d="M11 4.5 L25 12 L11 19.5 Z" />;
      leads = <line x1={4} x2={11} y1={12} y2={12} />;
      break;
    case 'input':
      return (
        <svg className="rb-palette-symbol" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
          <path d="M5 6 H24 L31 12 L24 18 H5 Z" />
          <line x1={31} x2={37} y1={12} y2={12} />
        </svg>
      );
    case 'output':
      return (
        <svg className="rb-palette-symbol" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
          <line x1={3} x2={9} y1={12} y2={12} />
          <path d="M16 6 H35 V18 H16 L9 12 Z" />
        </svg>
      );
    case 'clock':
      return (
        <svg className="rb-palette-symbol" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
          <path d="M5 6 H24 L31 12 L24 18 H5 Z" />
          <path d="M9 15 V9 H13 V15 H17 V9 H21" fill="none" />
          <line x1={31} x2={37} y1={12} y2={12} />
        </svg>
      );
    case 'register':
      return (
        <svg className="rb-palette-symbol" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
          <rect x={10} y={3} width={20} height={18} />
          <path d="M10 13 L14 16 L10 19" fill="none" />
          <line x1={4} x2={10} y1={8} y2={8} />
          <line x1={4} x2={10} y1={16} y2={16} />
          <line x1={30} x2={36} y1={8} y2={8} />
        </svg>
      );
    case 'const':
      return (
        <svg className="rb-palette-symbol" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
          <line x1={20} x2={20} y1={4} y2={12} />
          <line x1={12} x2={28} y1={12} y2={12} />
          <line x1={15} x2={25} y1={16} y2={16} />
          <line x1={18} x2={22} y1={20} y2={20} />
        </svg>
      );
    default:
      return (
        <svg className="rb-palette-symbol rb-palette-symbol--block" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
          <rect x={6} y={3} width={28} height={18} />
          <text x={20} y={15.5} textAnchor="middle">{fallback.slice(0, 4)}</text>
        </svg>
      );
  }
  const bubble = inverted ? <circle cx={family === 'not' ? 27.5 : 29.5} cy={12} r={2.4} /> : null;
  const outFrom = inverted ? (family === 'not' ? 30 : 32) : family === 'buffer' ? 25 : tip - 2;
  return (
    <svg className="rb-palette-symbol" viewBox="0 0 40 24" aria-hidden="true" focusable="false">
      {leads}
      {body}
      {bubble}
      <line x1={outFrom} x2={37} y1={12} y2={12} />
    </svg>
  );
};
