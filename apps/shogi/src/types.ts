export type PlayerId = 0 | 1;
export type Position = readonly [number, number];
export type Piece = Readonly<{ id: number; type: string; owner: PlayerId }>;
export type Location =
  | Readonly<{ kind: "board"; position: Position }>
  | Readonly<{ kind: "hand" }>
  | Readonly<{ kind: "void" }>;
export type Transfer = Readonly<{ pieceId: number; from: Location; to: Location }>;
export type Transaction = Readonly<{
  playerBefore: PlayerId;
  playerAfter: PlayerId;
  transfers: readonly Transfer[];
}>;
export type Effect = Readonly<{ type: "capture"; pieceId: number }>;
export type Result = Readonly<{ allow: boolean; effects?: readonly Effect[] }>;
export type Board = Readonly<{
  width: number; height: number;
  pieceAt: (position: Position) => Piece | null | undefined;
}>;
export type Context = Readonly<{
  board: Board; mover: Piece; from: Position; position: Position;
  distance: number; target: Piece | null; pieceTypeOf: (piece: Piece) => PieceType;
}>;
export type MovementRule = Readonly<{
  vector: Position;
  range: Readonly<{ min: number; max: number | null }>;
  pass: (context: Context) => Result;
  land: (context: Context) => Result;
}>;
export type SequenceStage = Readonly<{ movements: readonly MovementRule[] }>;
export type SequenceRule = Readonly<{ stages: readonly SequenceStage[] }>;
export type PieceType = Readonly<{
  id: string; name: string; rank: number; royal: boolean; promoted?: boolean;
  sequences: readonly SequenceRule[]; promoteTo?: string;
}>;
export type PromotionContext = Readonly<{
  piece: Piece; path: readonly Position[]; captured: boolean;
}>;
export type GameDefinition = Readonly<{
  id: string; title: string; width: number; height: number;
  pieceTypes: Readonly<Record<string, PieceType>>;
  initial: readonly Readonly<{ type: string; owner: PlayerId; position: Position }>[];
  canPromote: (context: PromotionContext) => boolean;
}>;
export type Outcome = PlayerId | "draw" | null;
