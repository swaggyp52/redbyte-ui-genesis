import { describe, expect, it } from 'vitest';
import type { SignalSample } from '../utils/signalMeasurements';
import { detectTrigger } from '../utils/signalMeasurements';
import { getOscilloscopeHoverInfo } from '../utils/oscilloscopeHover';

describe('numeric instruments with four-state digital signals', () => {
  it.each(['X', 'Z'] as const)('does not fabricate a numeric hover or level transition for %s', (value) => {
    const samples: SignalSample[] = [{timestamp:0,value:0},{timestamp:1,value},{timestamp:2,value:1}];
    expect(detectTrigger(samples,'level','rising',0.5)).toBeNull();
    expect(getOscilloscopeHoverInfo({x:50,y:50,width:100,height:100,timeScale:2,voltageScale:1,windowEndTime:2,
      probes:[{id:'p',label:'Probe',color:'red',enabled:true}],probeData:new Map([['p',{samples}]])})).toBeNull();
  });
  it('retains numeric level detection', () => {
    expect(detectTrigger([{timestamp:0,value:0.2},{timestamp:1,value:0.8}],'level','rising',0.5)).toBe(1);
  });
});
