import React, { useEffect, useRef, useState } from 'react';
import type { Bit } from '../ioBus';
import type { BoardSignal } from '../BoardSignalContext';
import styles from './HardwareBoard2D.module.css';

export interface HardwareBoard2DProps {
  sw: Bit[];           // length 16 — switch states
  ld: Bit[];           // length 16 — LED states
  btn: Bit[];          // length 5 — button states
  mappedSw: boolean[]; // length 16 — whether each SW has a nodeId mapping
  mappedLd: boolean[]; // length 16 — whether each LD has a nodeId mapping
  mismatchedLd?: boolean[]; // length 16 — red error overlay (bring-up mismatch)
  highlightedSw?: number[];  // indices to show cyan highlight ring
  highlightedLd?: number[];  // indices to show amber highlight ring
  onToggleSwitch(i: number): void;
  onSetSwitch?: (i: number, value: Bit) => void;
  onPressButton(i: number, down: boolean): void;
  activeSignal?: BoardSignal | null;
  onSelectSignal?: (sig: BoardSignal) => void;
  onHoverSignal?: (sig: BoardSignal | null) => void;
}

const BTN_POSITIONS: [number, number][] = [
  [155, 135], // BTNC (index 0)
  [155, 108], // BTNU (index 1)
  [155, 162], // BTND (index 2)
  [128, 135], // BTNL (index 3)
  [182, 135], // BTNR (index 4)
];
const BTN_LABELS = ['C', 'U', 'D', 'L', 'R'];

// How far a press must travel before it counts as sliding the switch rather than tapping it.
// Below this, a pointer gesture is an ordinary click and the switch simply toggles.
const SWITCH_DRAG_THRESHOLD_PX = 4;

export const HardwareBoard2D: React.FC<HardwareBoard2DProps> = ({
  sw,
  ld,
  btn,
  mappedSw,
  mappedLd,
  mismatchedLd,
  highlightedSw,
  highlightedLd,
  onToggleSwitch,
  onSetSwitch,
  onPressButton,
  activeSignal,
  onSelectSignal,
  onHoverSignal,
}) => {
  const [draggingSwitch, setDraggingSwitch] = useState<number | null>(null);

  useEffect(() => {
    if (draggingSwitch === null) return;
    const stopDrag = () => setDraggingSwitch(null);
    window.addEventListener('pointerup', stopDrag);
    return () => window.removeEventListener('pointerup', stopDrag);
  }, [draggingSwitch]);

  // One authority per gesture. A press used to set the switch absolutely from where it landed and
  // the click React dispatches right after it toggled the same switch again, undoing the press:
  // clicking the lower half of an ON switch was a silent no-op, and a centre click - the hitbox
  // midpoint is the on/off boundary - could never turn a switch off. So a plain click toggles, and
  // only a gesture that actually travels reads its value from the pointer, which is the slide
  // metaphor the drag handler was written for. The ref survives pointerup because the click follows
  // it; the next press on any switch resets it and the next click clears it.
  const switchGestureRef = useRef<{ index: number; startY: number; dragged: boolean } | null>(null);

  // Returns whether the pointer position actually decided this switch's value. When the host
  // supplies no `onSetSwitch`, it did not, and the click that follows must still toggle.
  const applyDraggedSwitchValue = (index: number, event: React.PointerEvent<SVGGElement>): boolean => {
    if (!onSetSwitch) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    const nextValue: Bit = event.clientY <= rect.top + rect.height / 2 ? 1 : 0;
    onSetSwitch(index, nextValue);
    return true;
  };

  return (
    <svg
      data-testid="ide-hardware-board-2d"
      className={styles.board}
      viewBox="0 0 620 260"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
    >
      <defs>
        {/* PCB background — radial gradient for depth */}
        <radialGradient id="pcbGrad" cx="50%" cy="40%" r="72%">
          <stop offset="0%"   stopColor="#0d2a18" />
          <stop offset="55%"  stopColor="#091a12" />
          <stop offset="100%" stopColor="#030b08" />
        </radialGradient>

        {/* PCB grid / trace texture */}
        <pattern id="pcbGrid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0 L0 0 0 12" fill="none" stroke="rgba(0,200,100,0.05)" strokeWidth="0.4" />
        </pattern>

        {/* Board inner-edge vignette */}
        <radialGradient id="boardVignette" cx="50%" cy="50%" r="60%">
          <stop offset="50%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>

        {/* PCB soldermask light sheen — simulates FR4 satin reflection */}
        <radialGradient id="pcbSheen" cx="28%" cy="25%" r="70%">
          <stop offset="0%"   stopColor="rgba(100,160,255,0.08)" />
          <stop offset="60%"  stopColor="rgba(60,110,220,0.03)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* LED lens radial gradients — on state (warm signal green) */}
        <radialGradient id="ledLensOn" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#c8ffe4" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#3dba6e" />
          <stop offset="100%" stopColor="#0a2e14" />
        </radialGradient>

        {/* LED lens radial gradients — off state */}
        <radialGradient id="ledLensOff" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#1e3e58" stopOpacity="0.8" />
          <stop offset="60%" stopColor="#0f2438" />
          <stop offset="100%" stopColor="#050d18" />
        </radialGradient>

        {/* LED lens — unmapped state */}
        <radialGradient id="ledLensUnmapped" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#111e2c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#050a12" stopOpacity="0.5" />
        </radialGradient>

        {/* Button radial */}
        <radialGradient id="btnGradOff" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#1e3050" />
          <stop offset="100%" stopColor="#0c1a30" />
        </radialGradient>
        <radialGradient id="btnGradOn" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff9090" />
          <stop offset="60%" stopColor="#e53e3e" />
          <stop offset="100%" stopColor="#7c1515" />
        </radialGradient>

        {/* Chip texture */}
        <linearGradient id="chipGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d2035" />
          <stop offset="100%" stopColor="#070f1c" />
        </linearGradient>

        {/* PCB grain / noise texture — 3% opacity organic texture */}
        <filter id="pcbGrain" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.72 0.68" numOctaves="4" seed="8" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="overlay" result="blended" />
          <feComposite in="blended" in2="SourceGraphic" operator="in" />
        </filter>

        {/* Grain pattern tile for the board surface */}
        <pattern id="pcbGrainTile" width="200" height="200" patternUnits="userSpaceOnUse">
          <rect width="200" height="200" fill="transparent" filter="url(#pcbGrain)" opacity="0.03" />
        </pattern>

        {/* Tighter specular highlight — simulates directional PCB sheen */}
        <radialGradient id="pcbSpecular" cx="22%" cy="18%" r="45%">
          <stop offset="0%"   stopColor="rgba(140,220,180,0.09)" />
          <stop offset="40%"  stopColor="rgba(80,160,120,0.04)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* Silkscreen blur — gentle softening for text legibility */}
        <filter id="silkBlur" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" />
        </filter>

        {/* LED lens — mismatch (red error state) */}
        <radialGradient id="ledLensMismatch" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff9090" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#cc2222" />
          <stop offset="100%" stopColor="#4a0808" />
        </radialGradient>
      </defs>

      {/* === Board body — flat instrument panel === */}
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="#0b1b3a" />
      {/* PCB trace grid overlay */}
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="url(#pcbGrid)" opacity="0.9" />
      {/* Grain texture */}
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8" fill="rgba(140,220,160,0.018)" filter="url(#pcbGrain)" />
      {/* Board edge stroke */}
      <rect x="10" y="10" width="600" height="240" rx="8" ry="8"
        fill="none" stroke="rgba(0,160,80,0.14)" strokeWidth="1.5" />
      {/* Outer mount-hole hint */}
      <rect x="4" y="4" width="612" height="252" rx="10" ry="10"
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Section dividers — silkscreen traces */}
      <line x1="18" y1="55" x2="602" y2="55" stroke="rgba(0,200,100,0.07)" strokeWidth="1" />
      <line x1="18" y1="175" x2="602" y2="175" stroke="rgba(0,200,100,0.07)" strokeWidth="1" />

      {/* === Silkscreen labels === */}
      <text x="18" y="14" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(210,220,240,0.18)" letterSpacing="1" style={{ pointerEvents: 'none' }}>LD15{'                                                    '}LD0</text>
      <text x="18" y="192" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(210,220,240,0.18)" letterSpacing="1" style={{ pointerEvents: 'none' }}>SW15{'                                                    '}SW0</text>
      <text x="18" y="118" fontFamily="IBM Plex Mono, monospace" fontSize="7"
        fill="rgba(210,220,240,0.18)" style={{ pointerEvents: 'none' }}>BTN</text>

      {/* === LEDs row === */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const cx = 10 + 20 + i * 36 + 18;
        const cy = 40;
        const isOn = ld[idx] === 1;
        const isMapped = mappedLd[idx];
        const isActiveLd = activeSignal?.type === 'ld' && activeSignal.index === idx;
        const isMismatch = mismatchedLd?.[idx] ?? false;

        const ledClassName = [
          styles.ledCircle,
          isActiveLd ? styles.active : '',
          isOn ? styles.ledOn : '',
          isMapped && !isOn ? styles.ledMapped : '',
          isMismatch ? styles.ledMismatch : '',
        ].filter(Boolean).join(' ');

        const lensGradId = isMismatch
          ? 'ledLensMismatch'
          : !isMapped
            ? 'ledLensUnmapped'
            : isOn
              ? 'ledLensOn'
              : 'ledLensOff';
        // Slice N4 — chrome rebuild: unmapped pins render at full opacity so the
        // board reads as "available, awaiting binding" instead of "greyed out, broken."
        // The existing `ledLensUnmapped` gradient already provides visual differentiation
        // from mapped/on states, so a subtle desaturation suffices instead of fading.
        const opacity = isMapped ? 1 : 0.78;

        return (
          <g key={`ld-${idx}`} opacity={opacity}>
            {/* LED body with lens gradient */}
            <circle
              data-testid={`ide-hw-ld-${idx}`}
              data-on={isOn ? '1' : '0'}
              data-active={isActiveLd ? 'true' : undefined}
              className={ledClassName}
              cx={cx}
              cy={cy}
              r={7}
              fill={`url(#${lensGradId})`}
              stroke={isMismatch ? 'rgba(220,50,50,0.8)' : isOn ? 'rgba(61,186,110,0.7)' : isMapped ? 'rgba(61,186,110,0.25)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={isOn || isMismatch ? '1.5' : '1'}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectSignal?.({ type: 'ld', index: idx })}
              onMouseEnter={() => onHoverSignal?.({ type: 'ld', index: idx })}
              onMouseLeave={() => onHoverSignal?.(null)}
            />
            {/* Bring-Up highlight ring */}
            {highlightedLd?.includes(idx) && (
              <circle
                cx={cx}
                cy={cy}
                r={12}
                fill="none"
                stroke="rgba(250,200,0,0.8)"
                strokeWidth="1.5"
                className={styles.ledHighlight}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Lens highlight (only when on or mapped) */}
            {(isOn || isMapped) && (
              <ellipse
                cx={cx - 2.5}
                cy={cy - 2.8}
                rx={2.2}
                ry={1.4}
                fill={isOn ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.15)'}
                transform={`rotate(-25, ${cx - 2.5}, ${cy - 2.8})`}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Expanded LED hitbox (invisible, pointer-catching) */}
            <circle
              cx={cx}
              cy={cy}
              r={20}
              fill="transparent"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              className={styles.ledHitbox}
              onClick={() => onSelectSignal?.({ type: 'ld', index: idx })}
              onMouseEnter={() => onHoverSignal?.({ type: 'ld', index: idx })}
              onMouseLeave={() => onHoverSignal?.(null)}
            />
            <text
              x={cx}
              y={58}
              fontSize={7}
              fontFamily="IBM Plex Mono, monospace"
              fill={isMapped ? 'rgba(180,230,220,0.4)' : 'rgba(255,255,255,0.15)'}
              textAnchor="middle"
              className={styles.ledLabel}
              style={{ pointerEvents: 'none' }}
            >
              {`LD${idx}`}
            </text>
          </g>
        );
      })}

      {/* === ARTIX-7 FPGA Chip === */}
      <g>
        {/* Chip body */}
        <rect x="238" y="78" width="144" height="104" rx="6" ry="6"
          fill="url(#chipGrad)" stroke="rgba(0,180,150,0.22)" strokeWidth="1.5" />
        {/* Chip inner bevel */}
        <rect x="242" y="82" width="136" height="96" rx="4" ry="4"
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {/* Pin dots — top edge */}
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={`pin-t-${i}`}
            cx={248 + i * 18} cy={83} r={1.8}
            fill="#0c2038" stroke="rgba(0,180,150,0.3)" strokeWidth="0.6" />
        ))}
        {/* Pin dots — bottom edge */}
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={`pin-b-${i}`}
            cx={248 + i * 18} cy={177} r={1.8}
            fill="#0c2038" stroke="rgba(0,180,150,0.3)" strokeWidth="0.6" />
        ))}
        {/* Pin dots — left edge */}
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={`pin-l-${i}`}
            cx={243} cy={93 + i * 18} r={1.8}
            fill="#0c2038" stroke="rgba(0,180,150,0.3)" strokeWidth="0.6" />
        ))}
        {/* Pin dots — right edge */}
        {Array.from({ length: 5 }, (_, i) => (
          <circle key={`pin-r-${i}`}
            cx={377} cy={93 + i * 18} r={1.8}
            fill="#0c2038" stroke="rgba(0,180,150,0.3)" strokeWidth="0.6" />
        ))}

        {/* Chip marking — engraved style */}
        <text x="310" y="117" fontFamily="IBM Plex Mono, monospace" fontSize="8"
          fill="rgba(0,180,150,0.35)" textAnchor="middle" letterSpacing="0.06em" style={{ pointerEvents: 'none' }}>
          ARTIX-7
        </text>
        <text x="310" y="130" fontFamily="IBM Plex Mono, monospace" fontSize="6.5"
          fill="rgba(0,180,150,0.22)" textAnchor="middle" letterSpacing="0.04em" style={{ pointerEvents: 'none' }}>
          XC7A35T-1CPG236C
        </text>
        {/* Orientation marker */}
        <circle cx="247" cy="87" r="2.5" fill="rgba(0,180,150,0.18)" />
      </g>

      {/* === Push buttons === */}
      {BTN_POSITIONS.map(([cx, cy], i) => {
        const isPressed = btn[i] === 1;
        const handleBtnInteraction = (isDown: boolean) => {
          onPressButton(i, isDown);
          if (!isDown) onHoverSignal?.(null);
        };
        return (
          <g key={`btn-${i}`}>
            {/* Expanded button hitbox (invisible, pointer-catching) */}
            <circle
              cx={cx}
              cy={cy}
              r={20}
              fill="transparent"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              className={styles.btnHitbox}
              onMouseDown={() => handleBtnInteraction(true)}
              onMouseUp={() => handleBtnInteraction(false)}
              onMouseEnter={() => onHoverSignal?.({ type: 'btn', index: i })}
              onMouseLeave={() => onHoverSignal?.(null)}
              onClick={() => onSelectSignal?.({ type: 'btn', index: i })}
            />
            {/* Button outer ring */}
            <circle cx={cx} cy={cy} r={12}
              fill={isPressed ? 'rgba(229,62,62,0.25)' : 'rgba(0,0,0,0.3)'}
              stroke={isPressed ? 'rgba(229,62,62,0.6)' : 'rgba(255,255,255,0.1)'}
              strokeWidth="1"
              style={{ pointerEvents: 'none' }} />
            {/* Button cap */}
            <circle
              data-testid={`ide-hw-btn-${i}`}
              className={styles.btnCircle}
              cx={cx}
              cy={cy}
              r={9}
              fill={isPressed ? 'url(#btnGradOn)' : 'url(#btnGradOff)'}
              stroke={isPressed ? 'rgba(229,62,62,0.8)' : 'rgba(255,255,255,0.12)'}
              strokeWidth="1"
              style={{ pointerEvents: 'none' }}
            />
            {/* Button highlight */}
            <ellipse cx={cx - 2} cy={cy - 3} rx={3} ry={2}
              fill={isPressed ? 'rgba(255,150,150,0.4)' : 'rgba(255,255,255,0.12)'}
              style={{ pointerEvents: 'none' }} />
            <text
              x={cx}
              y={cy + 22}
              fontSize={7}
              fontFamily="IBM Plex Mono, monospace"
              fill="rgba(180,230,220,0.35)"
              textAnchor="middle"
              className={styles.btnLabel}
              style={{ pointerEvents: 'none' }}
            >
              {BTN_LABELS[i]}
            </text>
          </g>
        );
      })}

      {/* === Slide switches row === */}
      {Array.from({ length: 16 }, (_, i) => {
        const idx = 15 - i;
        const centerX = 10 + 20 + i * 36 + 18;
        const trackX = centerX - 7;
        const trackY = 188;
        const trackW = 14;
        const trackH = 22;
        const isOn = sw[idx] === 1;
        const isMapped = mappedSw[idx];
        const handleY = isOn ? trackY + 1 : trackY + trackH - 11;
        const isActiveSw = activeSignal?.type === 'sw' && activeSignal.index === idx;

        const swGroupClassName = [
          styles.swGroup,
          isActiveSw ? styles.active : '',
          isOn ? styles.swOn : '',
        ].filter(Boolean).join(' ');

        return (
          <g
            key={`sw-${idx}`}
            data-testid={`ide-hw-sw-${idx}`}
            data-on={isOn ? '1' : '0'}
            data-active={isActiveSw ? 'true' : undefined}
            className={swGroupClassName}
            opacity={isMapped ? 1 : 0.82}
          >
            {/* Expanded switch hitbox (invisible, pointer-catching) */}
            <rect
              x={trackX - 8}
              y={trackY - 8}
              width={trackW + 16}
              height={trackH + 16}
              rx={6}
              fill="transparent"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              className={styles.swHitbox}
              onClick={() => {
                const gesture = switchGestureRef.current;
                switchGestureRef.current = null;
                // A drag already decided this switch value; toggling here would undo it.
                if (gesture?.index === idx && gesture.dragged) return;
                onToggleSwitch(idx);
              }}
              onPointerDown={(event) => {
                setDraggingSwitch(idx);
                switchGestureRef.current = { index: idx, startY: event.clientY, dragged: false };
              }}
              onPointerMove={(event) => {
                if (draggingSwitch !== idx) return;
                const gesture = switchGestureRef.current;
                if (!gesture || gesture.index !== idx) return;
                if (!gesture.dragged && Math.abs(event.clientY - gesture.startY) < SWITCH_DRAG_THRESHOLD_PX) {
                  return;
                }
                if (applyDraggedSwitchValue(idx, event)) gesture.dragged = true;
              }}
              onPointerUp={() => setDraggingSwitch(null)}
              onMouseEnter={() => onHoverSignal?.({ type: 'sw', index: idx })}
              onMouseLeave={() => onHoverSignal?.(null)}
            />
            {/* Switch track / housing */}
            <rect
              x={trackX}
              y={trackY}
              width={trackW}
              height={trackH}
              rx={4}
              fill={isOn ? 'rgba(46,196,182,0.18)' : '#070e1c'}
              stroke={isMapped ? (isOn ? 'rgba(46,196,182,0.7)' : 'rgba(46,196,182,0.3)') : 'rgba(255,255,255,0.08)'}
              strokeWidth="1"
              className={styles.switchTrack}
              style={{ pointerEvents: 'none' }}
            />
            {/* Bring-Up highlight ring */}
            {highlightedSw?.includes(idx) && (
              <rect
                x={trackX - 2}
                y={trackY - 2}
                width={trackW + 4}
                height={trackH + 4}
                rx={5}
                fill="none"
                stroke="rgba(56,189,248,0.85)"
                strokeWidth="1.5"
                className={styles.swHighlight}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Slider handle */}
            <rect
              className={`${styles.swHandle} ${styles.switchHandle}`}
              x={trackX + 2}
              y={handleY}
              width={trackW - 4}
              height={10}
              rx={2.5}
              fill={isOn ? '#2ec4b6' : '#1c2e42'}
              stroke={isOn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}
              strokeWidth="0.5"
              style={{ pointerEvents: 'none' }}
            />
            {/* Handle highlight */}
            <rect
              x={trackX + 3}
              y={handleY + 1.5}
              width={trackW - 8}
              height={3}
              rx={1}
              fill={isOn ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)'}
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={centerX}
              y={220}
              fontSize={7}
              fontFamily="IBM Plex Mono, monospace"
              textAnchor="middle"
              fill={isMapped ? 'rgba(180,230,220,0.4)' : 'rgba(255,255,255,0.12)'}
              className={styles.swLabel}
              style={{ pointerEvents: 'none' }}
            >
              {`SW${idx}`}
            </text>
          </g>
        );
      })}

    </svg>
  );
};
