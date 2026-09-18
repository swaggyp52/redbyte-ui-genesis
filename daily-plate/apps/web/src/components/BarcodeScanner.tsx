import { useEffect, useRef, useState } from 'react';

interface Props {
  onDetected: (code: string) => void;
  onManual: (code: string) => void;
  onClose: () => void;
}

/** Camera scanning with a manual-entry fallback. Frames never leave the browser. */
export function BarcodeScanner({ onDetected, onManual, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'starting' | 'scanning' | 'denied' | 'unavailable'>('starting');
  const [manual, setManual] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const { BarcodeFormat, DecodeHintType } = await import('@zxing/library');
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current, (result) => {
          if (result && !doneRef.current) {
            doneRef.current = true;
            onDetected(result.getText());
          }
        });
        stop = () => controls.stop();
        if (!cancelled) setState('scanning');
      } catch {
        if (!cancelled) setState('denied');
      }
    })();
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') {
        stop?.();
        stop = undefined;
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelled = true;
      stop?.();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [onDetected]);

  return (
    <div className="stack">
      {(state === 'starting' || state === 'scanning') && (
        <div className="scanner-frame">
          <video ref={videoRef} muted playsInline aria-label="Camera preview" />
        </div>
      )}
      {state === 'starting' && <p className="muted small">Starting the camera…</p>}
      {state === 'scanning' && <p className="muted small">Hold the barcode inside the frame.</p>}
      {state === 'denied' && <div className="banner banner-gold">The camera isn't available. Type the numbers under the barcode instead.</div>}
      {state === 'unavailable' && <div className="banner banner-gold">This browser can't use the camera here. Type the numbers under the barcode instead.</div>}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.replace(/\D/g, '').length >= 6) onManual(manual);
        }}
      >
        <input className="input grow" inputMode="numeric" placeholder="Barcode digits" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Barcode digits" />
        <button type="submit" className="btn btn-secondary">
          Look up
        </button>
      </form>
      <button type="button" className="btn btn-quiet" onClick={onClose}>
        Back to search
      </button>
    </div>
  );
}
