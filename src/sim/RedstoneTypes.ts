export type RedstoneCellType =
  | "empty"
  | "wire"
  | "source"
  | "gate_and"
  | "gate_or"
  | "gate_not"
  | "output";

export interface RedstoneCell {
  type: RedstoneCellType;
  powered: boolean;
}

export type RedstoneGrid = RedstoneCell[][];

export interface RedstoneSimConfig {
  width: number;
  height: number;
}
