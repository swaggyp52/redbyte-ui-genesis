import type { EngineEvaluationObservation, Node, PortRef } from '@redbyte/rb-logic-core';
import type { ElaboratedNodeSource } from './projectHierarchy';

export interface JourneyPresentedValue {
  value: number | string | null;
  text: string;
  availability: 'recorded' | 'unknown' | 'unrecorded';
}
export interface JourneyPresentedPort {
  key: string;
  label: string;
  /** Exact recorded ports belonging to this built-in relationship. */
  ports: string[];
  value: JourneyPresentedValue;
  previousValue?: JourneyPresentedValue;
  driver?: PortRef;
  origin?: EngineEvaluationObservation['inputReads'][number]['origin'];
  role: 'input' | 'output' | 'state' | 'complement' | 'metadata';
  selected: boolean;
  conflict?: boolean;
}
export interface SignalJourneyPresentationInput {
  node: Node;
  source?: ElaboratedNodeSource;
  selected: { nodeId: string; port: string };
  observation?: EngineEvaluationObservation;
  /** Existing retained sample/phase readouts; this adapter never runs a device. */
  values?: ReadonlyMap<string, unknown>;
  publishedValue?: unknown;
  /** Supply actual recorded geometry ports for custom devices. */
  inputPorts?: readonly string[];
  outputPorts?: readonly string[];
  publication?: 'published-sample' | 'evaluation' | 'awaiting-common-publication';
  revision?: string;
}
export interface SignalJourneyPresentation {
  node: {
    nodeId: string;
    title: string;
    kind: string;
    stage: string;
    instancePath: string[];
    displayPath: string[];
  };
  mode: 'input' | 'output';
  phase: {
    kind: 'published-sample' | 'evaluated' | 'awaiting-common-publication' | 'recorded-phase' | 'unavailable';
    label: string;
    explanation: string;
  };
  inputs: JourneyPresentedPort[];
  rule: { text: string; expression?: string };
  outputs: JourneyPresentedPort[];
  outcome: { kind: 'changed' | 'unchanged' | 'unavailable'; text: string };
  sequential?: {
    kind: 'capture' | 'hold' | 'reset' | 'set' | 'unavailable';
    label: string;
    data: JourneyPresentedPort[];
    clock?: JourneyPresentedPort;
    enable?: JourneyPresentedPort;
    reset?: JourneyPresentedPort;
    priorState: JourneyPresentedValue;
    nextState: JourneyPresentedValue;
    reason: string;
  };
  notices: string[];
  /** Exact execution and identity metadata is for details, not the student rule. */
  details: {
    nodeType: string;
    nodeLabel?: string;
    selected: SignalJourneyPresentationInput['selected'];
    source?: ElaboratedNodeSource;
    revision?: string;
    observation?: EngineEvaluationObservation;
    localObservationAvailable: boolean;
    scheduler?: Pick<EngineEvaluationObservation, 'order' | 'evaluationOrder' | 'evaluationPhase' | 'commitPhase' | 'context'>;
  };
}

const REGISTER = new Set(['Register1', 'RegisterBus', 'StateBank']);
const CLOCKED = new Set([...REGISTER, 'DFlipFlop', 'TFlipFlop', 'JKFlipFlop']);
const KIND: Record<string, string> = {
  AND: 'AND gate', OR: 'OR gate', XOR: 'XOR gate', NOT: 'NOT gate', NAND: 'NAND gate', NOR: 'NOR gate', XNOR: 'XNOR gate',
  AND3: 'Three-input AND gate', OR3: 'Three-input OR gate', XOR3: 'Three-input XOR gate', NAND3: 'Three-input NAND gate', NOR3: 'Three-input NOR gate',
  INPUT: 'Input', Switch: 'Input switch', OUTPUT: 'Output', Lamp: 'Output indicator', Wire: 'Wire',
  PowerSource: 'High source', Ground: 'Low source', FullAdder: 'Full adder', MUX4: 'Four-input multiplexer',
  DFlipFlop: 'D flip-flop', Register1: 'Register', RegisterBus: 'Register word', StateBank: 'State bank',
  TFlipFlop: 'Toggle flip-flop', JKFlipFlop: 'JK flip-flop', DLatch: 'D latch', RSLatch: 'RS latch', Clock: 'Clock source', Delay: 'Delay',
};
const CLOCK_PORTS = ['CLK', 'clk', 'clock', 'C'];
const D_PORTS = ['D', 'd', 'in'];
const REGISTER_RESET = ['RST', 'rst', 'RESET', 'reset', 'CLR', 'clr', 'SET', 'set'];
const CLEAR_PORTS = ['CLR', 'clr', 'RST', 'rst', 'RESET', 'reset'];
const ENABLE_PORTS = ['EN', 'en', 'ENABLE', 'enable'];
const MAX_PORTS = 128;

/** Formatting preserves unknown and absent values; neither becomes zero. */
export function presentJourneyValue(raw: unknown): JourneyPresentedValue {
  if (typeof raw === 'number' && Number.isFinite(raw)) return { value: raw, text: String(raw), availability: 'recorded' };
  if (typeof raw === 'string' && raw.length && raw !== '?' && raw !== 'unrecorded') {
    return { value: raw, text: raw, availability: /^[01XZ]+$/i.test(raw) && /[XZ]/i.test(raw) ? 'unknown' : 'recorded' };
  }
  return { value: null, text: 'unrecorded', availability: 'unrecorded' };
}

function widthOf(node: Node): number {
  const fallback = node.type === 'Register1' ? 1 : 8;
  const value = node.config?.width;
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.min(32, Math.floor(value)) : fallback;
}
function numberRead(event: EngineEvaluationObservation, names: readonly string[]): number | undefined {
  for (const name of names) if (typeof event.inputs[name] === 'number' && Number.isFinite(event.inputs[name])) return event.inputs[name] as number;
  return undefined;
}
function inputRoles(node: Node): Array<{ key: string; label: string; names: string[]; numeric?: boolean }> {
  const type = node.type;
  if (CLOCKED.has(type)) {
    const data = type === 'JKFlipFlop' ? [{ key: 'J', label: 'Set input J', names: ['J', 'j'], numeric: true },
      { key: 'K', label: 'Clear input K', names: ['K', 'k'], numeric: true }]
      : [{ key: type === 'TFlipFlop' ? 'T' : 'D', label: type === 'TFlipFlop' ? 'Toggle input T' : 'Data input D',
        names: type === 'TFlipFlop' ? ['T', 't', 'in'] : REGISTER.has(type) && type !== 'Register1' ? ['D'] : D_PORTS, numeric: true }];
    if (REGISTER.has(type) && type !== 'Register1') for (let bit = 0; bit < widthOf(node); bit++) {
      data.push({ key: `D[${bit}]`, label: `Data bit D[${bit}]`, names: [`D[${bit}]`, `D${bit}`, `D_${bit}`], numeric: true });
    }
    return [...data, { key: 'CLK', label: 'Clock', names: CLOCK_PORTS, numeric: true },
      ...(['DFlipFlop', ...REGISTER].includes(type) ? [{ key: 'EN', label: 'Enable', names: REGISTER.has(type) ? [...ENABLE_PORTS, 'CE', 'ce'] : ENABLE_PORTS, numeric: true }] : []),
      { key: 'RST', label: 'Reset', names: REGISTER.has(type) ? REGISTER_RESET : type === 'DFlipFlop' ? REGISTER_RESET.slice(0, 6) : CLEAR_PORTS, numeric: true }];
  }
  if (/^(AND|OR|XOR|NAND|NOR|XNOR)$/.test(type)) return [
    { key: 'A', label: 'Input A', names: ['in1', 'a'] }, { key: 'B', label: 'Input B', names: ['in2', 'b'] }];
  if (/^(AND3|OR3|NAND3|NOR3|XOR3)$/.test(type)) return ['a', 'b', 'c'].map(name => ({ key: name.toUpperCase(), label: `Input ${name.toUpperCase()}`, names: [name] }));
  if (['NOT', 'Wire', 'Lamp', 'OUTPUT', 'Delay'].includes(type)) return [{ key: 'in', label: 'Input', names: ['in'] }];
  if (type === 'FullAdder') return ['a', 'b', 'cin'].map(name => ({ key: name, label: name === 'cin' ? 'Carry input' : `Input ${name.toUpperCase()}`, names: [name] }));
  return [];
}

function makeInputs(input: SignalJourneyPresentationInput, event?: EngineEvaluationObservation): JourneyPresentedPort[] {
  const names = new Set([...Object.keys(event?.inputs ?? {}), ...(input.inputPorts ?? []), ...inputRoles(input.node).flatMap(role => role.names)]);
  const raw = (name: string): unknown => event && Object.prototype.hasOwnProperty.call(event.inputs, name)
    ? event.inputs[name] : input.values?.get(`${input.node.id}.${name}`);
  const used = new Set<string>();
  const rows: JourneyPresentedPort[] = [];
  const append = (key: string, label: string, name: string, value: unknown) => {
    used.add(name);
    const read = event?.inputReads.find(item => item.portName === name);
    rows.push({ key, label, ports: [name], value: presentJourneyValue(value), role: 'input', selected: input.selected.nodeId === input.node.id && input.selected.port === name,
      ...(read ? { driver: { ...read.driver }, origin: read.origin } : {}) });
  };
  for (const role of inputRoles(input.node)) {
    const name = role.names.find(candidate => raw(candidate) != null && (!event || !role.numeric || typeof raw(candidate) === 'number'))
      ?? role.names.find(candidate => raw(candidate) != null) ?? role.names[0];
    // Optional controls and packed-data bit alternatives are shown only when recorded.
    if (['EN', 'RST'].includes(role.key) && raw(name) == null || /^D\[/.test(role.key) && raw(name) == null) continue;
    append(role.key, role.label, name, raw(name));
  }
  for (const name of names) if (!used.has(name) && (event && name in event.inputs || input.inputPorts?.includes(name))) append(name, `Input ${name}`, name, raw(name));
  return rows.slice(0, MAX_PORTS);
}

function outputGroups(node: Node): Array<{ key: string; label: string; names: string[]; role: JourneyPresentedPort['role'] }> {
  if (!CLOCKED.has(node.type)) return [];
  const register = REGISTER.has(node.type), width = register ? widthOf(node) : 1;
  const scalar = node.type === 'Register1';
  const state = ['Q', 'q', 'out'], complement = ['Q_inv', 'qn'];
  if (register && !scalar) state.push('value');
  if (register && width === 1) { state.push('value', 'Q0', 'q0', 'Q[0]', 'q[0]'); complement.push('Q_inv0'); }
  if (register && scalar && width > 1) { state.push('Q0', 'q0', 'Q[0]', 'q[0]'); complement.push('Q_inv0'); }
  const groups = [{ key: 'Q', label: width > 1 && !scalar ? 'Stored word Q' : 'Stored state Q', names: state, role: 'state' as const },
    { key: 'Q_inv', label: 'Complement of Q', names: complement, role: 'complement' as const }];
  const result: ReturnType<typeof outputGroups> = [...groups];
  if (register && scalar && width > 1) result.push({ key: 'value', label: 'Stored word', names: ['value'], role: 'state' });
  if (register && width > 1) for (let bit = 0; bit < width; bit++) {
    if (scalar && bit === 0) continue;
    result.push({ key: `Q[${bit}]`, label: `State bit Q[${bit}]`, names: [`Q${bit}`, `q${bit}`, `Q[${bit}]`, `q[${bit}]`], role: 'state' },
      { key: `Q_inv${bit}`, label: `Complement of Q[${bit}]`, names: [`Q_inv${bit}`], role: 'complement' });
  }
  if (register) result.push({ key: 'width', label: 'Word width', names: ['width'], role: 'metadata' });
  return result;
}

function makeOutputs(input: SignalJourneyPresentationInput, event?: EngineEvaluationObservation): JourneyPresentedPort[] {
  const names = new Set([...Object.keys(event?.outputs ?? {}), ...(input.outputPorts ?? [])]);
  const raw = (name: string): unknown => event && Object.prototype.hasOwnProperty.call(event.outputs, name) ? event.outputs[name]
    : input.values?.get(`${input.node.id}.${name}`) ?? (input.publication === 'published-sample' && input.selected.nodeId === input.node.id && input.selected.port === name ? input.publishedValue : undefined);
  const groups = outputGroups(input.node);
  if (!groups.length) {
    if (!names.size && ['AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR', 'XNOR', 'AND3', 'OR3', 'XOR3', 'NAND3', 'NOR3', 'INPUT', 'OUTPUT', 'Switch', 'Wire', 'Lamp', 'Ground', 'PowerSource'].includes(input.node.type)) names.add('out');
    groups.push(...[...names].map(name => ({ key: name, label: name === 'out' ? 'Output' : `Output ${name}`, names: [name], role: 'output' as const })));
  }
  const used = new Set(groups.flatMap(group => group.names));
  groups.push(...[...names].filter(name => !used.has(name)).map(name => ({ key: name, label: `Output ${name}`, names: [name], role: 'output' as const })));
  return groups.slice(0, MAX_PORTS).map(group => {
    const recorded = group.names.map(name => ({ name, value: raw(name) })).filter(item => item.value != null);
    const conflict = recorded.some(item => presentJourneyValue(item.value).text !== presentJourneyValue(recorded[0].value).text);
    const previous = group.names.find(name => event && Object.prototype.hasOwnProperty.call(event.previousOutputs, name));
    return { key: group.key, label: group.label, ports: [...new Set(group.names)], role: group.role,
      value: presentJourneyValue(conflict ? undefined : recorded[0]?.value), ...(conflict ? { conflict: true } : {}),
      ...(event ? { previousValue: presentJourneyValue(previous ? event.previousOutputs[previous] : undefined) } : {}),
      selected: input.selected.nodeId === input.node.id && group.names.includes(input.selected.port) };
  });
}

function logicRule(node: Node, inputs: JourneyPresentedPort[], outputs: JourneyPresentedPort[]): SignalJourneyPresentation['rule'] {
  const type = node.type, output = outputs.find(row => row.key === 'out')?.value;
  const bit = (value: JourneyPresentedValue) => value.availability === 'recorded' && (value.value === 0 || value.value === 1 || value.value === '0' || value.value === '1') ? Number(value.value) : undefined;
  const operator = type.replace(/3$/, '');
  const knownGate = /^(AND|OR|XOR|NOT|NAND|NOR|XNOR)$/.test(operator);
  if (knownGate) {
    const values = inputs.filter(row => ['A', 'B', 'C', 'in'].includes(row.key)).map(row => bit(row.value));
    const required = type === 'NOT' ? 1 : type.endsWith('3') ? 3 : 2;
    const rule = { AND: 'The output is 1 when every input is 1.', OR: 'The output is 1 when any input is 1.',
      XOR: type.endsWith('3') ? 'The output is 1 when an odd number of inputs are 1.' : 'The output is 1 when the inputs differ.',
      NOT: 'The output is the opposite of the input.', NAND: 'The output is the opposite of AND.', NOR: 'The output is the opposite of OR.', XNOR: 'The output is 1 when the inputs match.' }[operator];
    if (values.length !== required || values.some(value => value === undefined) || !output || bit(output) === undefined) return { text: `${rule} A complete input/output relationship is not recorded here.` };
    const bits = values as number[];
    // This checks only that the displayed Boolean relationship matches the recording;
    // it neither executes a device nor creates or changes expected checks.
    const result = operator === 'AND' ? Number(bits.every(Boolean)) : operator === 'NAND' ? Number(!bits.every(Boolean))
      : operator === 'OR' ? Number(bits.some(Boolean)) : operator === 'NOR' ? Number(!bits.some(Boolean))
        : operator === 'NOT' ? 1 - bits[0] : operator === 'XNOR' ? Number(bits[0] === bits[1]) : bits.reduce((a, b) => a ^ b, 0);
    const expression = operator === 'NOT' ? `NOT ${bits[0]}` : bits.join(` ${operator} `);
    if (result !== bit(output)) return { text: `${rule} Recorded output ${output.text} does not match this built-in relationship for the recorded inputs.` };
    return { text: `${expression} = ${output.text}.`, expression: `${expression} = ${output.text}` };
  }
  if (['Wire', 'Lamp', 'OUTPUT'].includes(type)) return { text: `The recorded input passes to the output${output?.availability === 'recorded' ? `: ${inputs[0]?.value.text ?? 'unrecorded'} → ${output.text}` : ''}.` };
  if (type === 'INPUT' || type === 'Switch') return { text: `This source supplies the recorded value ${output?.text ?? 'unrecorded'}.` };
  if (type === 'FullAdder') return { text: `Adds input A, input B, and carry-in. Recorded outputs: ${outputs.map(row => `${row.key}=${row.value.text}`).join(', ') || 'unrecorded'}.` };
  if (CLOCKED.has(type)) return { text: 'Stored state changes only when this device’s recorded capture or reset condition applies.' };
  return { text: 'Recorded inputs and distinct outputs are shown. A direct rule for this device is unavailable.' };
}

function sequentialPresentation(node: Node, inputs: JourneyPresentedPort[], outputs: JourneyPresentedPort[], event?: EngineEvaluationObservation): SignalJourneyPresentation['sequential'] {
  if (!CLOCKED.has(node.type)) return undefined;
  const data = inputs.filter(row => row.key === 'D' || /^D\[/.test(row.key) || ['T', 'J', 'K'].includes(row.key));
  const base = { data, clock: inputs.find(row => row.key === 'CLK'), enable: inputs.find(row => row.key === 'EN'), reset: inputs.find(row => row.key === 'RST'),
    priorState: presentJourneyValue(event?.stateBefore.q), nextState: presentJourneyValue(event?.stateAfter.q) };
  const unavailable = (reason: string): NonNullable<SignalJourneyPresentation['sequential']> => ({ ...base, kind: 'unavailable', label: 'Capture evidence unavailable', reason });
  if (!event) return unavailable('These readouts do not include an actual evaluation of this storage device. No capture, hold, or reset is inferred.');
  if (!['evaluate', 'capture'].includes(event.evaluationPhase)) return unavailable('A storage evaluation boundary is not recorded for this object.');
  if (outputs.some(row => row.conflict) || event.invalidOutputPorts.length) return unavailable('The recorded outputs are inconsistent or include an invalid result; a storage action cannot be explained reliably.');
  const before = event.stateBefore.q, after = event.stateAfter.q;
  if (typeof before !== 'number' || !Number.isFinite(before) || typeof after !== 'number' || !Number.isFinite(after)) return unavailable('The prior or resulting stored state is unrecorded.');
  const result = (kind: NonNullable<SignalJourneyPresentation['sequential']>['kind'], label: string, reason: string): NonNullable<SignalJourneyPresentation['sequential']> => ({ ...base, kind, label, reason });
  const register = REGISTER.has(node.type), config = node.config ?? {};
  const resetNames = register ? REGISTER_RESET : node.type === 'DFlipFlop' ? REGISTER_RESET.slice(0, 6) : CLEAR_PORTS;
  if ([...CLOCK_PORTS, ...resetNames, ...(register ? [...ENABLE_PORTS, 'CE', 'ce'] : node.type === 'DFlipFlop' ? ENABLE_PORTS : [])].some(name =>
    name in event.inputs && (typeof event.inputs[name] !== 'number' || !Number.isFinite(event.inputs[name])))) return unavailable('A recorded clock or control value is unknown; a storage action cannot be inferred.');
  const reset = numberRead(event, resetNames);
  const resetKind = register ? String(config.resetKind ?? 'none').toLowerCase() : 'async_clear';
  const activeLowReset = register && String(config.resetPolarity).toLowerCase() === 'active_low';
  const resetActive = reset !== undefined && (activeLowReset ? reset === 0 : register ? reset !== 0 : reset === 1);
  const mask = widthOf(node) >= 31 ? 0x7fffffff : (1 << widthOf(node)) - 1;
  if (resetActive && resetKind === 'async_clear') return after === 0 ? result('reset', 'Reset stored state', `The recorded reset is active; stored state ${before} becomes 0.`) : unavailable('Recorded reset and resulting state disagree.');
  if (resetActive && resetKind === 'async_preset') return after === mask ? result('set', 'Preset stored state', `The recorded preset is active; stored state becomes ${after}.`) : unavailable('Recorded preset and resulting state disagree.');
  const clock = numberRead(event, CLOCK_PORTS), last = event.stateBefore.lastClk;
  if (clock === undefined || typeof last !== 'number' || !Number.isFinite(last)) return unavailable('The clock input or its prior level is unrecorded; an edge cannot be inferred.');
  const previousClock = register ? Number(last !== 0) : last, currentClock = register ? Number(clock !== 0) : clock;
  const falling = register && String(config.clockPolarity).toLowerCase() === 'falling_edge';
  const edge = falling ? previousClock === 1 && currentClock === 0 : previousClock === 0 && currentClock === 1;
  const edgeName = falling ? 'falling' : 'rising';
  if (!edge) return before === after ? result('hold', 'Hold stored state', `The clock has no ${edgeName} edge in this evaluation; stored state stays ${after}.`) : unavailable('State changed without a recorded capture or reset condition.');
  if (resetActive && resetKind === 'sync_reset') return after === 0 ? result('reset', 'Reset at clock edge', `Active reset forces stored state ${before} to 0 at the ${edgeName} edge.`) : unavailable('Recorded synchronous reset and resulting state disagree.');
  if (resetActive && resetKind === 'sync_set') return after === mask ? result('set', 'Set at clock edge', `Active set forces stored state to ${after} at the ${edgeName} edge.`) : unavailable('Recorded synchronous set and resulting state disagree.');
  if (register || node.type === 'DFlipFlop') {
    const enable = numberRead(event, register ? [...ENABLE_PORTS, 'CE', 'ce'] : ENABLE_PORTS);
    const fallback = register && config.hasEnable === true ? 0 : 1;
    const active = register ? String(config.enablePolarity).toLowerCase() === 'active_low' ? (enable ?? fallback) === 0 : (enable ?? fallback) !== 0 : (enable ?? fallback) === 1;
    if (!active) return before === after ? result('hold', 'Hold stored state', `Capture is disabled at this edge; stored state stays ${after}.`) : unavailable('State changed while the recorded capture control was disabled.');
    const directData = numberRead(event, D_PORTS);
    let expectedData: number | undefined;
    if (!register || node.type === 'Register1') expectedData = directData === undefined ? undefined : Number(directData !== 0);
    else if (typeof event.inputs.D === 'number' && Number.isFinite(event.inputs.D)) expectedData = (Math.floor(event.inputs.D) & mask) >>> 0;
    else {
      const bits = Array.from({ length: widthOf(node) }, (_, index) => numberRead(event, [`D[${index}]`, `D${index}`, `D_${index}`]));
      if (bits.every(value => value !== undefined)) expectedData = bits.reduce<number>((word, value, index) => word | (Number(value !== 0) << index), 0) & mask;
    }
    if (expectedData === undefined) return unavailable('The complete data read at this edge is unrecorded.');
    if (after !== expectedData) return unavailable('The recorded data and resulting state do not match this built-in capture relationship.');
    return result('capture', 'Capture data at clock edge', `The ${edgeName} clock edge captures the recorded data; stored state ${before} → ${after}.`);
  }
  if (node.type === 'TFlipFlop') {
    const toggle = numberRead(event, ['T', 't', 'in']);
    if (toggle === undefined) return unavailable('The toggle input is unrecorded.');
    return toggle === 1 ? after === (before === 0 ? 1 : 0) ? result('capture', 'Toggle at clock edge', `T=1 toggles stored state ${before} → ${after} at the rising edge.`) : unavailable('Recorded toggle and resulting state disagree.')
      : before === after ? result('hold', 'Hold stored state', `T is not asserted; stored state stays ${after}.`) : unavailable('The recorded toggle input and state change disagree.');
  }
  const j = numberRead(event, ['J', 'j']), k = numberRead(event, ['K', 'k']);
  if (j === undefined || k === undefined) return unavailable('J or K is unrecorded.');
  if (j === 1 && k === 0) return after === 1 ? result('set', 'Set at clock edge', `J=1 and K=0 set the stored state at the rising edge; ${before} → ${after}.`) : unavailable('Recorded JK set and resulting state disagree.');
  if (j === 0 && k === 1) return after === 0 ? result('reset', 'Clear at clock edge', `J=0 and K=1 clear the stored state at the rising edge; ${before} → ${after}.`) : unavailable('Recorded JK clear and resulting state disagree.');
  if (j === 1 && k === 1) return after === (before === 0 ? 1 : 0) ? result('capture', 'Toggle at clock edge', `J=1 and K=1 toggle the stored state at the rising edge; ${before} → ${after}.`) : unavailable('Recorded JK toggle and resulting state disagree.');
  return before === after ? result('hold', 'Hold stored state', `J and K do not request a change; stored state stays ${after}.`) : unavailable('Recorded JK controls and resulting state disagree.');
}

/** Pure wording over retained evidence. Equal values never establish aliases. */
export function presentSignalJourney(input: SignalJourneyPresentationInput): SignalJourneyPresentation {
  const node = input.node, observation = input.observation;
  const boundaryRecorded = observation && ['evaluate', 'before-capture', 'capture', 'after-capture'].includes(observation.evaluationPhase)
    && ['immediate', 'after-capture'].includes(observation.commitPhase);
  const event = input.publication === 'published-sample' ? undefined
    : observation?.nodeId === node.id && observation.nodeType === node.type && boundaryRecorded ? observation : undefined;
  const inputs = makeInputs(input, event), outputs = makeOutputs(input, event);
  const selectedInput = inputs.find(row => row.selected), mode = selectedInput ? 'input' : 'output';
  const kind = KIND[node.type] ?? 'Recorded device';
  const label = node.label?.trim();
  const rawIdentityLabel = label === node.id || label === input.source?.localNodeId
    || !!input.source && label === [...input.source.displayPath, input.source.localNodeId].join('.');
  const title = label && !rawIdentityLabel ? label : kind;
  const published = input.publication === 'published-sample';
  const pending = !published && !!event && (input.publication === 'awaiting-common-publication' || event.commitPhase === 'after-capture');
  const phase: SignalJourneyPresentation['phase'] = published
    ? { kind: 'published-sample', label: 'Published sample', explanation: 'Values at the recorded sample boundary. This view does not establish how a device captured or changed state.' }
    : pending ? { kind: 'awaiting-common-publication', label: 'Captured result · not yet published', explanation: 'This evaluation returned a result. Clocked devices publish their new state together after the common capture boundary.' }
      : event ? { kind: 'evaluated', label: 'Evaluated output', explanation: 'Inputs and returned outputs from this actual evaluation; this is logical execution, not physical propagation delay.' }
        : input.publication === 'evaluation' || observation ? { kind: 'recorded-phase', label: 'Values at paused evaluation', explanation: 'Local readouts at this paused evaluation. An actual evaluation of this object is unavailable.' }
          : { kind: 'unavailable', label: 'Evaluation unavailable', explanation: 'A published sample or actual evaluation boundary was not supplied. Available retained readouts remain visible.' };
  const sequential = sequentialPresentation(node, inputs, outputs, event);
  const rule = selectedInput ? { text: `${selectedInput.label} = ${selectedInput.value.text}${selectedInput.driver ? `, read from ${selectedInput.driver.nodeId}.${selectedInput.driver.portName}` : ''}. This is an input value, not the gate’s output.` }
    : sequential && sequential.kind !== 'unavailable' ? { text: sequential.reason } : logicRule(node, inputs, outputs);
  const stateKey = node.type === 'Register1' && widthOf(node) > 1 ? 'value' : 'Q';
  const comparable = outputs.filter(row => row.role === 'output' || CLOCKED.has(node.type) && row.key === stateKey);
  const complete = !!event && comparable.length > 0 && comparable.every(row => !row.conflict && row.value.availability === 'recorded' && row.previousValue?.availability === 'recorded');
  const unchanged = complete && comparable.every(row => row.value.text === row.previousValue!.text);
  const outcome: SignalJourneyPresentation['outcome'] = !complete ? { kind: 'unavailable', text: 'A complete previous/result output comparison is unavailable.' }
    : unchanged ? { kind: 'unchanged', text: comparable.length === 1 ? `The output stayed at ${comparable[0].value.text}.` : 'The outputs stayed the same.' }
      : { kind: 'changed', text: pending ? 'The evaluated result changes an output; common publication is still pending.' : 'This evaluation changes a recorded output.' };
  const notices: string[] = [];
  if (observation && !event && !published) notices.push('The selected object is not the captured evaluation. No change or storage action is inferred for it.');
  if (outputs.some(row => row.conflict)) notices.push('Recorded aliases disagree; their value remains unrecorded rather than choosing one.');
  if (event?.invalidOutputPorts.length) notices.push('The engine recorded invalid raw output values. Normalized outputs and raw values remain separate in details.');
  if (Object.keys(event?.outputs ?? {}).length > MAX_PORTS || Object.keys(event?.inputs ?? {}).length > MAX_PORTS) notices.push('Additional ports remain in recorded details.');
  return { node: { nodeId: node.id, title, kind, stage: input.source?.displayPath.length ? `In ${input.source.displayPath.join(' / ')}` : 'Top-level circuit',
    instancePath: [...(input.source?.instancePath ?? [])], displayPath: [...(input.source?.displayPath ?? [])] }, mode, phase, inputs, rule, outputs, outcome,
    ...(sequential ? { sequential } : {}), notices,
    details: { nodeType: node.type, nodeLabel: node.label, selected: { ...input.selected }, source: input.source, revision: input.revision,
      observation, localObservationAvailable: !!event, ...(observation ? { scheduler: { order: observation.order, evaluationOrder: observation.evaluationOrder,
        evaluationPhase: observation.evaluationPhase, commitPhase: observation.commitPhase, context: observation.context } } : {}) } };
}
