import React, { useState } from 'react';

export function Calculator() {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function evaluate() {
    try {
      // Very basic, not for untrusted input in real life
      // eslint-disable-next-line no-eval
      const value = eval(expression || '0');
      setResult(String(value));
      setError(null);
    } catch (err) {
      setError('Invalid expression');
      setResult(null);
    }
  }

  return (
    <div className='h-full flex flex-col gap-3'>
      <div className='text-xs text-slate-300'>
        Enter a simple math expression, then press <span className='font-mono'>=</span>.
      </div>
      <div className='flex gap-2'>
        <input
          className='flex-1 rounded-md bg-slate-800/80 border border-slate-600 px-2 py-1 text-xs outline-none focus:border-emerald-400'
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          placeholder='Example: (2 + 3) * 4'
        />
        <button
          onClick={evaluate}
          className='px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-900'
        >
          =
        </button>
      </div>
      {result !== null && (
        <div className='text-xs'>
          <span className='text-slate-400 mr-1'>Result:</span>
          <span className='font-mono text-emerald-300'>{result}</span>
        </div>
      )}
      {error && <div className='text-xs text-rose-400'>{error}</div>}
      <div className='mt-auto text-[10px] text-slate-500'>
        This is a simple demo calculator inside RedbyteOS.
      </div>
    </div>
  );
}
