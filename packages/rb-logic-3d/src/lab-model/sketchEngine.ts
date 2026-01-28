import { PART_DEFINITIONS } from './parts';
import type { LabGraph } from './types';

type Value = number | string | boolean;

type TokenType = 'identifier' | 'number' | 'string' | 'operator' | 'punct' | 'keyword';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

type Statement =
  | { type: 'block'; statements: Statement[] }
  | { type: 'var'; name: string; initializer?: Expression }
  | { type: 'assign'; name: string; value: Expression }
  | { type: 'expr'; expression: Expression }
  | { type: 'if'; condition: Expression; thenBranch: Statement; elseBranch?: Statement }
  | { type: 'while'; condition: Expression; body: Statement }
  | { type: 'return'; value?: Expression };

type Expression =
  | { type: 'literal'; value: Value }
  | { type: 'identifier'; name: string }
  | { type: 'binary'; op: string; left: Expression; right: Expression }
  | { type: 'unary'; op: string; value: Expression }
  | { type: 'call'; name: string; args: Expression[] };

type Instruction =
  | { op: 'PUSH_CONST'; value: Value }
  | { op: 'PUSH_VAR'; name: string }
  | { op: 'STORE_VAR'; name: string }
  | { op: 'BIN_OP'; operator: string }
  | { op: 'UNARY_OP'; operator: string }
  | { op: 'CALL'; name: string; argc: number }
  | { op: 'JUMP'; to: number }
  | { op: 'JUMP_IF_FALSE'; to: number }
  | { op: 'RETURN' }
  | { op: 'POP' };

interface SketchProgram {
  setup: Instruction[];
  loop: Instruction[];
}

interface ParserResult {
  program?: SketchProgram;
  errors: string[];
}

interface RuntimeState {
  phase: 'setup' | 'loop';
  ip: number;
  stack: Value[];
  vars: Record<string, Value>;
  sleepUntilTick: number;
  halted: boolean;
}

export interface SketchRuntimeOptions {
  tickMs: number;
  stepBudget: number;
}

export interface SketchRuntimeHost {
  tick: number;
  graph: LabGraph;
  pinStates: Record<string, number>;
  emitSerial: (text: string) => void;
  emitError: (message: string) => void;
  onPinWrite: (pinKey: string, value: number) => void;
}

export interface SketchLoadResult {
  ok: boolean;
  error?: string;
  hash?: string;
}

export const hashSketchSource = (source: string): string => {
  const normalized = source.replace(/\r\n/g, '\n').trimEnd();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const KEYWORDS = new Set(['if', 'else', 'while', 'return', 'int', 'bool', 'void', 'true', 'false']);
const OPERATORS = ['==', '!=', '<=', '>=', '&&', '||', '+', '-', '*', '/', '%', '<', '>', '=', '!'];
const PUNCT = new Set(['(', ')', '{', '}', ';', ',', '.']);

const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  const normalized = source.replace(/\r\n/g, '\n');
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = () => {
    const char = normalized[i++];
    if (char === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    return char;
  };

  while (i < normalized.length) {
    const startCol = col;
    const char = normalized[i];

    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') {
      advance();
      continue;
    }

    if (char === '/' && normalized[i + 1] === '/') {
      while (i < normalized.length && normalized[i] !== '\n') {
        advance();
      }
      continue;
    }
    if (char === '/' && normalized[i + 1] === '*') {
      advance();
      advance();
      while (i < normalized.length && !(normalized[i] === '*' && normalized[i + 1] === '/')) {
        advance();
      }
      if (i < normalized.length) {
        advance();
        advance();
      }
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let value = '';
      while (i < normalized.length && /[A-Za-z0-9_]/.test(normalized[i])) {
        value += advance();
      }
      if (normalized[i] === '.' && /[A-Za-z_]/.test(normalized[i + 1] ?? '')) {
        value += advance();
        while (i < normalized.length && /[A-Za-z0-9_]/.test(normalized[i])) {
          value += advance();
        }
      }
      const type = KEYWORDS.has(value) ? 'keyword' : 'identifier';
      tokens.push({ type, value, line, col: startCol });
      continue;
    }

    if (/\d/.test(char)) {
      let value = '';
      while (i < normalized.length && /[\d.]/.test(normalized[i])) {
        value += advance();
      }
      tokens.push({ type: 'number', value, line, col: startCol });
      continue;
    }

    if (char === '"') {
      advance();
      let value = '';
      while (i < normalized.length && normalized[i] !== '"') {
        const next = advance();
        if (next === '\\' && i < normalized.length) {
          const escaped = advance();
          value += escaped;
        } else {
          value += next;
        }
      }
      if (normalized[i] === '"') {
        advance();
      }
      tokens.push({ type: 'string', value, line, col: startCol });
      continue;
    }

    const twoChar = normalized.slice(i, i + 2);
    if (OPERATORS.includes(twoChar)) {
      advance();
      advance();
      tokens.push({ type: 'operator', value: twoChar, line, col: startCol });
      continue;
    }
    if (OPERATORS.includes(char)) {
      advance();
      tokens.push({ type: 'operator', value: char, line, col: startCol });
      continue;
    }
    if (PUNCT.has(char)) {
      advance();
      tokens.push({ type: 'punct', value: char, line, col: startCol });
      continue;
    }

    advance();
  }

  return tokens;
};

class Parser {
  private tokens: Token[];
  private index = 0;
  private errors: string[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ParserResult {
    const functions: Record<string, Statement> = {};
    while (!this.isAtEnd()) {
      const fn = this.parseFunction();
      if (fn) {
        functions[fn.name] = fn.body;
      } else {
        break;
      }
    }

    const setup = functions.setup ?? { type: 'block', statements: [] };
    const loop = functions.loop ?? { type: 'block', statements: [] };
    const program: SketchProgram = {
      setup: compileStatements(asBlock(setup)),
      loop: compileStatements(asBlock(loop)),
    };

    return { program, errors: this.errors };
  }

  private parseFunction(): { name: string; body: Statement } | null {
    const start = this.peek();
    if (!start) return null;
    if (start.type === 'keyword' && start.value === 'void') {
      this.advance();
    }
    const nameToken = this.consume('identifier', 'Expected function name');
    if (!nameToken) return null;
    this.consumeValue('(', 'Expected "(" after function name');
    this.consumeValue(')', 'Expected ")" after function parameters');
    const body = this.parseBlock();
    if (!body) return null;
    return { name: nameToken.value, body };
  }

  private parseBlock(): Statement | null {
    if (!this.consumeValue('{', 'Expected "{" to start block')) return null;
    const statements: Statement[] = [];
    while (!this.isAtEnd() && !this.checkValue('}')) {
      const stmt = this.parseStatement();
      if (stmt) {
        statements.push(stmt);
      } else {
        break;
      }
    }
    this.consumeValue('}', 'Expected "}" to close block');
    return { type: 'block', statements };
  }

  private parseStatement(): Statement | null {
    if (this.checkValue('{')) {
      return this.parseBlock();
    }
    if (this.matchKeyword('if')) {
      return this.parseIf();
    }
    if (this.matchKeyword('while')) {
      return this.parseWhile();
    }
    if (this.matchKeyword('return')) {
      const value = this.checkValue(';') ? undefined : this.parseExpression();
      this.consumeValue(';', 'Expected ";" after return');
      return { type: 'return', value };
    }

    if (this.matchKeyword('int') || this.matchKeyword('bool')) {
      const name = this.consume('identifier', 'Expected variable name');
      let initializer: Expression | undefined;
      if (this.matchValue('=')) {
        initializer = this.parseExpression();
      }
      this.consumeValue(';', 'Expected ";" after variable declaration');
      if (!name) return null;
      return { type: 'var', name: name.value, initializer };
    }

    const expr = this.parseExpression();
    if (!expr) return null;
    if (expr.type === 'identifier' && this.matchValue('=')) {
      const value = this.parseExpression();
      this.consumeValue(';', 'Expected ";" after assignment');
      return { type: 'assign', name: expr.name, value: value! };
    }
    this.consumeValue(';', 'Expected ";" after expression');
    return { type: 'expr', expression: expr };
  }

  private parseIf(): Statement | null {
    this.consumeValue('(', 'Expected "(" after if');
    const condition = this.parseExpression();
    this.consumeValue(')', 'Expected ")" after if condition');
    const thenBranch = this.parseStatement();
    let elseBranch: Statement | undefined;
    if (this.matchKeyword('else')) {
      elseBranch = this.parseStatement() ?? undefined;
    }
    if (!condition || !thenBranch) return null;
    return { type: 'if', condition, thenBranch, elseBranch };
  }

  private parseWhile(): Statement | null {
    this.consumeValue('(', 'Expected "(" after while');
    const condition = this.parseExpression();
    this.consumeValue(')', 'Expected ")" after while condition');
    const body = this.parseStatement();
    if (!condition || !body) return null;
    return { type: 'while', condition, body };
  }

  private parseExpression(): Expression | null {
    return this.parseOr();
  }

  private parseOr(): Expression | null {
    let expr = this.parseAnd();
    while (this.matchOperator('||')) {
      const op = this.previous().value;
      const right = this.parseAnd();
      if (!expr || !right) return expr;
      expr = { type: 'binary', op, left: expr, right };
    }
    return expr;
  }

  private parseAnd(): Expression | null {
    let expr = this.parseEquality();
    while (this.matchOperator('&&')) {
      const op = this.previous().value;
      const right = this.parseEquality();
      if (!expr || !right) return expr;
      expr = { type: 'binary', op, left: expr, right };
    }
    return expr;
  }

  private parseEquality(): Expression | null {
    let expr = this.parseComparison();
    while (this.matchOperator('==') || this.matchOperator('!=')) {
      const op = this.previous().value;
      const right = this.parseComparison();
      if (!expr || !right) return expr;
      expr = { type: 'binary', op, left: expr, right };
    }
    return expr;
  }

  private parseComparison(): Expression | null {
    let expr = this.parseTerm();
    while (
      this.matchOperator('<') ||
      this.matchOperator('>') ||
      this.matchOperator('<=') ||
      this.matchOperator('>=')
    ) {
      const op = this.previous().value;
      const right = this.parseTerm();
      if (!expr || !right) return expr;
      expr = { type: 'binary', op, left: expr, right };
    }
    return expr;
  }

  private parseTerm(): Expression | null {
    let expr = this.parseFactor();
    while (this.matchOperator('+') || this.matchOperator('-')) {
      const op = this.previous().value;
      const right = this.parseFactor();
      if (!expr || !right) return expr;
      expr = { type: 'binary', op, left: expr, right };
    }
    return expr;
  }

  private parseFactor(): Expression | null {
    let expr = this.parseUnary();
    while (this.matchOperator('*') || this.matchOperator('/') || this.matchOperator('%')) {
      const op = this.previous().value;
      const right = this.parseUnary();
      if (!expr || !right) return expr;
      expr = { type: 'binary', op, left: expr, right };
    }
    return expr;
  }

  private parseUnary(): Expression | null {
    if (this.matchOperator('!') || this.matchOperator('-')) {
      const op = this.previous().value;
      const value = this.parseUnary();
      if (!value) return null;
      return { type: 'unary', op, value };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expression | null {
    if (this.matchType('number')) {
      return { type: 'literal', value: Number(this.previous().value) };
    }
    if (this.matchType('string')) {
      return { type: 'literal', value: this.previous().value };
    }
    if (this.matchKeyword('true')) {
      return { type: 'literal', value: true };
    }
    if (this.matchKeyword('false')) {
      return { type: 'literal', value: false };
    }
    if (this.matchType('identifier')) {
      const name = this.previous().value;
      if (this.matchValue('(')) {
        const args: Expression[] = [];
        if (!this.checkValue(')')) {
          do {
            const arg = this.parseExpression();
            if (arg) args.push(arg);
          } while (this.matchValue(','));
        }
        this.consumeValue(')', 'Expected ")" after arguments');
        return { type: 'call', name, args };
      }
      return { type: 'identifier', name };
    }
    if (this.matchValue('(')) {
      const expr = this.parseExpression();
      this.consumeValue(')', 'Expected ")" after expression');
      return expr;
    }
    const token = this.peek();
    if (token) {
      this.errors.push(`Unexpected token ${token.value} at ${token.line}:${token.col}`);
    }
    return null;
  }

  private matchType(type: TokenType): boolean {
    if (!this.checkType(type)) return false;
    this.advance();
    return true;
  }

  private matchKeyword(value: string): boolean {
    if (!this.checkKeyword(value)) return false;
    this.advance();
    return true;
  }

  private matchOperator(value: string): boolean {
    if (!this.checkOperator(value)) return false;
    this.advance();
    return true;
  }

  private matchValue(value: string): boolean {
    if (!this.checkValue(value)) return false;
    this.advance();
    return true;
  }

  private checkType(type: TokenType): boolean {
    return !this.isAtEnd() && this.peek()!.type === type;
  }

  private checkKeyword(value: string): boolean {
    return !this.isAtEnd() && this.peek()!.type === 'keyword' && this.peek()!.value === value;
  }

  private checkOperator(value: string): boolean {
    return !this.isAtEnd() && this.peek()!.type === 'operator' && this.peek()!.value === value;
  }

  private checkValue(value: string): boolean {
    return !this.isAtEnd() && this.peek()!.value === value;
  }

  private consume(type: TokenType, message: string): Token | null {
    if (this.checkType(type)) return this.advance();
    this.error(message);
    return null;
  }

  private consumeValue(value: string, message: string): Token | null {
    if (this.checkValue(value)) return this.advance();
    this.error(message);
    return null;
  }

  private error(message: string) {
    const token = this.peek();
    if (token) {
      this.errors.push(`${message} at ${token.line}:${token.col}`);
    } else {
      this.errors.push(`${message} at end of file`);
    }
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.index += 1;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.index >= this.tokens.length;
  }

  private peek(): Token | null {
    return this.tokens[this.index] ?? null;
  }

  private previous(): Token {
    return this.tokens[this.index - 1];
  }
}

const asBlock = (statement: Statement): Statement => {
  if (statement.type === 'block') return statement;
  return { type: 'block', statements: [statement] };
};

const compileStatements = (block: Statement): Instruction[] => {
  const instructions: Instruction[] = [];
  for (const stmt of (block as { statements: Statement[] }).statements) {
    compileStatement(stmt, instructions);
  }
  return instructions;
};

const compileStatement = (stmt: Statement, out: Instruction[]) => {
  switch (stmt.type) {
    case 'block':
      stmt.statements.forEach((inner) => compileStatement(inner, out));
      break;
    case 'var':
      if (stmt.initializer) {
        compileExpression(stmt.initializer, out);
      } else {
        out.push({ op: 'PUSH_CONST', value: 0 });
      }
      out.push({ op: 'STORE_VAR', name: stmt.name });
      break;
    case 'assign':
      compileExpression(stmt.value, out);
      out.push({ op: 'STORE_VAR', name: stmt.name });
      break;
    case 'expr':
      compileExpression(stmt.expression, out);
      out.push({ op: 'POP' });
      break;
    case 'return':
      if (stmt.value) {
        compileExpression(stmt.value, out);
        out.push({ op: 'POP' });
      }
      out.push({ op: 'RETURN' });
      break;
    case 'if': {
      compileExpression(stmt.condition, out);
      const jumpIfFalseIndex = out.length;
      out.push({ op: 'JUMP_IF_FALSE', to: -1 });
      compileStatement(stmt.thenBranch, out);
      if (stmt.elseBranch) {
        const jumpIndex = out.length;
        out.push({ op: 'JUMP', to: -1 });
        out[jumpIfFalseIndex] = { op: 'JUMP_IF_FALSE', to: out.length };
        compileStatement(stmt.elseBranch, out);
        out[jumpIndex] = { op: 'JUMP', to: out.length };
      } else {
        out[jumpIfFalseIndex] = { op: 'JUMP_IF_FALSE', to: out.length };
      }
      break;
    }
    case 'while': {
      const loopStart = out.length;
      compileExpression(stmt.condition, out);
      const jumpIfFalseIndex = out.length;
      out.push({ op: 'JUMP_IF_FALSE', to: -1 });
      compileStatement(stmt.body, out);
      out.push({ op: 'JUMP', to: loopStart });
      out[jumpIfFalseIndex] = { op: 'JUMP_IF_FALSE', to: out.length };
      break;
    }
    default:
      break;
  }
};

const compileExpression = (expr: Expression, out: Instruction[]) => {
  switch (expr.type) {
    case 'literal':
      out.push({ op: 'PUSH_CONST', value: expr.value });
      break;
    case 'identifier':
      out.push({ op: 'PUSH_VAR', name: expr.name });
      break;
    case 'unary':
      compileExpression(expr.value, out);
      out.push({ op: 'UNARY_OP', operator: expr.op });
      break;
    case 'binary':
      compileExpression(expr.left, out);
      compileExpression(expr.right, out);
      out.push({ op: 'BIN_OP', operator: expr.op });
      break;
    case 'call':
      expr.args.forEach((arg) => compileExpression(arg, out));
      out.push({ op: 'CALL', name: expr.name, argc: expr.args.length });
      break;
    default:
      break;
  }
};

const resolveValue = (value: Value): number => {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  if (!Number.isFinite(value)) return 0;
  return value;
};

const resolveIdentifierValue = (name: string): Value => {
  if (name === 'HIGH') return 1;
  if (name === 'LOW') return 0;
  if (name === 'OUTPUT') return 1;
  if (name === 'INPUT') return 0;
  if (name === 'INPUT_PULLUP') return 2;
  if (name === 'LED_BUILTIN') return 13;
  if (/^D\d+$/.test(name)) {
    return Number(name.slice(1));
  }
  if (/^A\d+$/.test(name)) {
    return Number(name.slice(1));
  }
  return 0;
};

const resolvePinId = (value: Value): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  const numeric = resolveValue(value);
  if (Number.isFinite(numeric)) {
    return `D${Math.round(numeric)}`;
  }
  return String(value);
};

const resolveArduinoPinKey = (graph: LabGraph, pinId: string): string | null => {
  const arduino = graph.nodes.find((node) => node.type === 'arduino-nano');
  if (!arduino) return null;
  const definition = PART_DEFINITIONS['arduino-nano'];
  if (!definition.pins.some((pin) => pin.id === pinId)) return null;
  return `${arduino.id}:${pinId}`;
};

export const compileSketch = (source: string): ParserResult => {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parse();
};

export class SketchRuntime {
  private options: SketchRuntimeOptions;
  private program: SketchProgram | null = null;
  private state: RuntimeState = {
    phase: 'setup',
    ip: 0,
    stack: [],
    vars: {},
    sleepUntilTick: 0,
    halted: false,
  };

  constructor(options: SketchRuntimeOptions) {
    this.options = options;
  }

  load(source: string): SketchLoadResult {
    const result = compileSketch(source);
    if (!result.program || result.errors.length > 0) {
      this.program = null;
      this.state.halted = true;
      return { ok: false, error: result.errors.join('\n') || 'Failed to compile sketch.' };
    }
    this.program = result.program;
    this.reset();
    return { ok: true, hash: hashSketchSource(source) };
  }

  reset() {
    this.state = {
      phase: 'setup',
      ip: 0,
      stack: [],
      vars: {},
      sleepUntilTick: 0,
      halted: false,
    };
  }

  hasProgram(): boolean {
    return this.program !== null;
  }

  step(host: SketchRuntimeHost) {
    if (!this.program || this.state.halted) return;
    if (host.tick < this.state.sleepUntilTick) return;

    let steps = 0;
    while (steps < this.options.stepBudget) {
      const instructions = this.state.phase === 'setup' ? this.program.setup : this.program.loop;
      if (this.state.ip >= instructions.length) {
        if (this.state.phase === 'setup') {
          this.state.phase = 'loop';
          this.state.ip = 0;
          if (this.program.loop.length === 0) return;
          continue;
        }
        this.state.ip = 0;
        continue;
      }

      const instr = instructions[this.state.ip];
      steps += 1;

      switch (instr.op) {
        case 'PUSH_CONST':
          this.state.stack.push(instr.value);
          this.state.ip += 1;
          break;
        case 'PUSH_VAR': {
          const value = this.state.vars[instr.name];
          if (value === undefined) {
            this.state.stack.push(resolveIdentifierValue(instr.name));
          } else {
            this.state.stack.push(value);
          }
          this.state.ip += 1;
          break;
        }
        case 'STORE_VAR': {
          const value = this.state.stack.pop();
          this.state.vars[instr.name] = value ?? 0;
          this.state.ip += 1;
          break;
        }
        case 'BIN_OP': {
          const right = this.state.stack.pop() ?? 0;
          const left = this.state.stack.pop() ?? 0;
          this.state.stack.push(applyBinary(instr.operator, left, right));
          this.state.ip += 1;
          break;
        }
        case 'UNARY_OP': {
          const value = this.state.stack.pop() ?? 0;
          this.state.stack.push(applyUnary(instr.operator, value));
          this.state.ip += 1;
          break;
        }
        case 'CALL': {
          const args = this.state.stack.splice(-instr.argc, instr.argc);
          const callResult = this.executeCall(instr.name, args, host);
          if (callResult.sleepUntilTick !== undefined) {
            this.state.sleepUntilTick = callResult.sleepUntilTick;
          }
          if (callResult.error) {
            host.emitError(callResult.error);
            this.state.halted = true;
            return;
          }
          if (callResult.didYield) {
            this.state.ip += 1;
            return;
          }
          if (callResult.returnValue !== undefined) {
            this.state.stack.push(callResult.returnValue);
          } else {
            this.state.stack.push(0);
          }
          this.state.ip += 1;
          break;
        }
        case 'JUMP_IF_FALSE': {
          const value = this.state.stack.pop() ?? 0;
          if (!resolveValue(value)) {
            this.state.ip = instr.to;
          } else {
            this.state.ip += 1;
          }
          break;
        }
        case 'JUMP':
          this.state.ip = instr.to;
          break;
        case 'RETURN':
          if (this.state.phase === 'setup') {
            this.state.phase = 'loop';
            this.state.ip = 0;
          } else {
            this.state.ip = instructions.length;
          }
          break;
        case 'POP':
          this.state.stack.pop();
          this.state.ip += 1;
          break;
        default:
          this.state.ip += 1;
          break;
      }
    }

    host.emitError(`Sketch step budget exceeded (${this.options.stepBudget} ops).`);
    this.state.halted = true;
  }

  private executeCall(name: string, args: Value[], host: SketchRuntimeHost): {
    returnValue?: Value;
    sleepUntilTick?: number;
    didYield?: boolean;
    error?: string;
  } {
    if (name === 'pinMode') {
      return { returnValue: 0 };
    }
    if (name === 'digitalWrite') {
      const pin = resolvePinId(args[0] ?? 0);
      const value = resolveValue(args[1] ?? 0);
      const pinKey = resolveArduinoPinKey(host.graph, pin);
      if (!pinKey) {
        return { error: `digitalWrite: unknown pin ${pin}` };
      }
      host.onPinWrite(pinKey, value ? 1 : 0);
      return { returnValue: 0 };
    }
    if (name === 'digitalRead') {
      const pin = resolvePinId(args[0] ?? 0);
      const pinKey = resolveArduinoPinKey(host.graph, pin);
      if (!pinKey) {
        return { error: `digitalRead: unknown pin ${pin}` };
      }
      const value = host.pinStates[pinKey] ?? 0;
      return { returnValue: value };
    }
    if (name === 'delay') {
      const ms = Math.max(0, resolveValue(args[0] ?? 0));
      const ticks = Math.max(1, Math.ceil(ms / this.options.tickMs));
      return { sleepUntilTick: host.tick + ticks, didYield: true };
    }
    if (name === 'millis') {
      return { returnValue: host.tick * this.options.tickMs };
    }
    if (name === 'Serial.begin') {
      return { returnValue: 0 };
    }
    if (name === 'Serial.print' || name === 'Serial.println') {
      const text = String(args[0] ?? '');
      host.emitSerial(name === 'Serial.println' ? `${text}\n` : text);
      return { returnValue: 0 };
    }

    return { error: `Unknown function ${name}` };
  }
}

const applyBinary = (op: string, left: Value, right: Value): Value => {
  const l = resolveValue(left);
  const r = resolveValue(right);
  switch (op) {
    case '+':
      return l + r;
    case '-':
      return l - r;
    case '*':
      return l * r;
    case '/':
      return r === 0 ? 0 : l / r;
    case '%':
      return r === 0 ? 0 : l % r;
    case '==':
      return l === r ? 1 : 0;
    case '!=':
      return l !== r ? 1 : 0;
    case '<':
      return l < r ? 1 : 0;
    case '>':
      return l > r ? 1 : 0;
    case '<=':
      return l <= r ? 1 : 0;
    case '>=':
      return l >= r ? 1 : 0;
    case '&&':
      return l && r ? 1 : 0;
    case '||':
      return l || r ? 1 : 0;
    default:
      return 0;
  }
};

const applyUnary = (op: string, value: Value): Value => {
  const v = resolveValue(value);
  switch (op) {
    case '-':
      return -v;
    case '!':
      return v ? 0 : 1;
    default:
      return v;
  }
};
