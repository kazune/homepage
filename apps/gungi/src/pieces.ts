export type Player = 0 | 1;
export type Position = readonly [number, number];
export const types = ["帥", "大", "中", "小", "侍", "槍", "馬", "忍", "砦", "兵", "砲", "弓", "筒", "謀"] as const;
export type PieceType = typeof types[number];
export type Piece = Readonly<{ id: number; type: PieceType; owner: Player }>;
export const counts: Record<PieceType, number> = { 帥: 1, 大: 1, 中: 1, 小: 2, 侍: 2, 槍: 3, 馬: 2, 忍: 2, 砦: 2, 兵: 4, 砲: 1, 弓: 2, 筒: 1, 謀: 1 };
export const names: Record<PieceType, string> = { 帥: "スイ", 大: "タイショウ", 中: "チュウジョウ", 小: "ショウショウ", 侍: "サムライ", 槍: "ヤリ", 馬: "キバ", 忍: "シノビ", 砦: "トリデ", 兵: "ヒョウ", 砲: "オオヅツ", 弓: "ユミ", 筒: "ツツ", 謀: "ボウショウ" };

// Relative to the player: negative y is forward. Paths exclude the destination.
export type Movement = Readonly<{ offset: Position; path: readonly Position[]; jump: boolean }>;
const orthogonal: Position[] = [[0, -1], [-1, 0], [1, 0], [0, 1]];
const diagonal: Position[] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const all = [...orthogonal, ...diagonal];

export function movements(type: PieceType, tier: number): Movement[] {
  if (!Number.isInteger(tier) || tier < 1 || tier > 3) throw new Error("段数は1〜3です");
  const result: Movement[] = [];
  function ray(directions: readonly Position[], max: number, min = 1, jump = false): void {
    for (const [dx, dy] of directions) for (let n = min; n <= max; n++) {
      result.push({ offset: [dx * n, dy * n], path: Array.from({ length: n - 1 }, (_, i) => [dx * (i + 1), dy * (i + 1)] as Position), jump });
    }
  }
  switch (type) {
    case "帥": ray(all, tier); break;
    case "大": ray(orthogonal, 8); ray(diagonal, tier); break;
    case "中": ray(diagonal, 8); ray(orthogonal, tier); break;
    case "小": ray([[0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]], tier); break;
    case "侍": ray([[0, -1], [-1, -1], [1, -1], [0, 1]], tier); break;
    case "槍": ray([[0, -1]], tier + 1); ray([[-1, -1], [1, -1], [0, 1]], tier); break;
    case "馬": ray([[0, -1], [0, 1]], tier + 1); ray([[-1, 0], [1, 0]], tier); break;
    case "忍": ray(diagonal, tier + 1); break;
    case "砦": ray([[0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]], tier); break;
    case "兵": ray([[0, -1], [0, 1]], tier); break;
    case "砲": ray([[0, -1]], tier + 2, 3, true); ray([[-1, 0], [1, 0], [0, 1]], tier); break;
    case "筒": ray([[0, -1]], tier + 1, 2, true); ray([[-1, 1], [1, 1]], tier); break;
    case "弓":
      for (let n = 1; n <= tier; n++) for (const dx of [-1, 0, 1]) {
        // The bow's forward fan widens by one file per additional tier.
        result.push({ offset: [dx * n, -(n + 1)], path: Array.from({ length: n }, (_, i) => [[dx * i, -(i + 1)], [dx * (i + 1), -(i + 1)]] as Position[]).flat(), jump: true });
      }
      ray([[0, 1]], tier);
      break;
    case "謀": ray([[-1, -1], [1, -1], [0, 1]], tier); break;
  }
  return result;
}

export const indexOf = ([x, y]: Position): number => y * 9 + x;
export const positionOf = (index: number): Position => [index % 9, Math.floor(index / 9)];
export const inside = ([x, y]: Position): boolean => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < 9 && y >= 0 && y < 9;
export const other = (owner: Player): Player => owner === 0 ? 1 : 0;
