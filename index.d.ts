export function start(dir: string, tag: string, options?: StartOptions & { mode: 'replay' }): NockDef[];
export function start(dir: string, tag: string, options?: StartOptions): NockDef[] | null | undefined;

export function stop(): NockDef[] | null | undefined;

export function reset(): void;

export function getMode(): Modes;

export function getModeEnum(): ModeMap;

export type Redefine = (nockDef: NockDef) => NockDef | Falsy;

export interface StartOptions {
  readonly mode?: Modes;
  readonly recordReqHeaders?: boolean;
  readonly redefine?: Redefine;
}

export interface ModeMap {
  readonly REPLAY: 'replay';
  readonly LIVE: 'live';
  readonly RECORD: 'record';
  readonly DEFAULT: 'replay';
}

export type Modes = ModeMap[keyof ModeMap];

export interface NockDef {
  readonly scope: string;
  readonly method: string;
  readonly path: string;
  readonly body: string | {} | null;
  readonly status: number;
  readonly response: string | Buffer | {};
  readonly rawHeaders: string[];
  readonly reqheaders?: string[];

  readonly [key: string]: any;
}

type Falsy = false | 0 | '' | null | undefined;

