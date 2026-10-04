const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { daiShogi } = require('./build/games/dai-shogi.js');

function empty(owner = 0) {
  const game = new Game(false, daiShogi);
  game.addPiece('king', 0, [0, 14]);
  game.addPiece('king', 1, [14, 0]);
  game.turn = owner;
  return game;
}
const positions = (game, piece) => game.candidates(piece).map(p => p.join(',')).sort();

test('Dai setup has 15×15 squares, 65 pieces per side, 29 base types and rotated camps', () => {
  const game = new Game(true, daiShogi);
  assert.equal(game.width, 15);
  assert.equal(game.height, 15);
  assert.equal(game.pieces.size, 130);
  assert.equal(new Set([...game.pieces.values()].map(p => p.type)).size, 29);
  for (const owner of [0, 1]) {
    assert.equal([...game.pieces.values()].filter(p => p.owner === owner).length, 65);
    assert.equal([...game.pieces.values()].filter(p => p.owner === owner && p.type === 'pawn').length, 15);
  }
  const expected = [
    [[7, 14], 'king'], [[1, 14], 'knight'], [[2, 14], 'stone'], [[3, 14], 'iron'],
    [[2, 13], 'cat-sword'], [[7, 13], 'elephant'],
    [[1, 12], 'violent-ox'], [[3, 12], 'angry-boar'], [[5, 12], 'evil-wolf'],
    [[6, 12], 'kirin'], [[7, 12], 'lion'], [[8, 12], 'phoenix'],
    [[0, 11], 'rook'], [[1, 11], 'flying-dragon'], [[7, 11], 'queen'],
    [[4, 9], 'go-between'], [[10, 9], 'go-between'],
  ];
  for (const [position, type] of expected) {
    assert.equal(game.pieceAt(position).type, type);
    assert.equal(game.pieceAt(position).owner, 0);
  }
  for (const piece of game.pieces.values()) if (piece.owner === 0) {
    const [x, y] = game.locations.get(piece.id).position;
    const counterpart = game.pieceAt([14 - x, 14 - y]);
    assert.equal(counterpart.type, piece.type);
    assert.equal(counterpart.owner, 1);
  }
  assert.equal(game.pieceAt([15, 0]), undefined);
  assert.equal(game.pieceAt([0, 15]), undefined);
  for (let y = 6; y <= 8; y++) for (let x = 0; x < 15; x++) assert.equal(game.pieceAt([x, y]), null);
});

test('eight new pieces have their full directional moves for both owners', () => {
  const cases = [
    ['stone', [[-1, -1], [1, -1]]],
    ['iron', [[-1, -1], [0, -1], [1, -1]]],
    ['knight', [[-1, -2], [1, -2]]],
    ['angry-boar', [[0, -1], [0, 1], [-1, 0], [1, 0]]],
    ['cat-sword', [[-1, -1], [1, -1], [-1, 1], [1, 1]]],
    ['evil-wolf', [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0]]],
    ['violent-ox', [[0, -1], [0, -2], [0, 1], [0, 2], [-1, 0], [-2, 0], [1, 0], [2, 0]]],
    ['flying-dragon', [[-1, -1], [-2, -2], [1, -1], [2, -2], [-1, 1], [-2, 2], [1, 1], [2, 2]]],
  ];
  for (const [type, vectors] of cases) for (const owner of [0, 1]) {
    const game = empty(owner);
    const piece = game.addPiece(type, owner, [7, 7]);
    const direction = owner === 0 ? 1 : -1;
    const expected = vectors.map(([x, y]) => [7 + x * direction, 7 + y * direction].join(',')).sort();
    assert.deepEqual(positions(game, piece), expected, `${type}, player ${owner}`);
  }
});

test('two-square limited rangers stop at blockers and capture without jumping', () => {
  for (const [type, near, far] of [
    ['violent-ox', [7, 6], [7, 5]], ['flying-dragon', [6, 6], [5, 5]],
  ]) for (const owner of [0, 1]) {
    const game = empty();
    const piece = game.addPiece(type, 0, [7, 7]);
    const blocker = game.addPiece('pawn', owner, near);
    assert.equal(positions(game, piece).includes(near.join(',')), owner === 1);
    assert(!positions(game, piece).includes(far.join(',')));
    if (owner === 1) {
      game.move(piece.id, near);
      assert.equal(game.locations.get(blocker.id).kind, 'void');
      game.undo();
      assert.equal(game.pieceAt(near).id, blocker.id);
    }
  }
});

test('knight jumps; new pieces promote to gold once and undo restores original identity', () => {
  for (const type of ['stone', 'iron', 'knight', 'angry-boar', 'cat-sword', 'evil-wolf', 'violent-ox', 'flying-dragon']) {
    const game = empty();
    const piece = game.addPiece(type, 0, [7, 5]);
    if (type === 'knight') game.addPiece('pawn', 0, [7, 4]);
    const to = game.candidates(piece).find(p => p[1] <= 4);
    assert(to, type);
    assert.equal(game.move(piece.id, to), true);
    game.completePromotion(piece.id, true);
    const promoted = game.pieceAt(to);
    assert.equal(promoted.type, `promoted-${type}`);
    assert.equal(game.pieceTypeOf(promoted).name, '金将');
    assert.equal(game.pieceTypeOf(promoted).promoteTo, undefined);
    assert.equal(game.pieceTypeOf(promoted).promoted, true);
    game.turn = 0;
    assert.deepEqual(positions(game, promoted), positions(game, { ...promoted, type: 'gold' }));
    game.undo();
    assert.equal(game.pieceAt([7, 5]).id, piece.id);
    assert.equal(game.locations.get(promoted.id).kind, 'void');
  }
});

test('promotion zone is five ranks, with entry or zone capture required in both directions', () => {
  for (const owner of [0, 1]) {
    const game = empty(owner);
    const rotate = ([x, y]) => owner === 0 ? [x, y] : [14 - x, 14 - y];
    const gold = game.addPiece('gold', owner, rotate([7, 5]));
    assert.equal(game.move(gold.id, rotate([7, 4])), true);
    game.completePromotion(gold.id, false);
    game.turn = owner;
    assert.equal(game.move(gold.id, rotate([7, 3])), false);
    game.turn = owner;
    game.addPiece('pawn', 1 - owner, rotate([7, 2]));
    assert.equal(game.move(gold.id, rotate([7, 2])), true);
    game.completePromotion(gold.id, false);
    game.turn = owner;
    const rook = game.addPiece('rook', owner, rotate([4, 4]));
    assert.equal(game.move(rook.id, rotate([4, 5])), false); // leave without capture
    game.turn = owner;
    assert.equal(game.move(rook.id, rotate([4, 4])), true); // reentry
    game.completePromotion(rook.id, false);
    game.turn = owner;
    game.addPiece('pawn', 1 - owner, rotate([4, 5]));
    assert.equal(game.move(rook.id, rotate([4, 5])), true); // capture leaving zone
    game.completePromotion(rook.id, false);
    game.turn = owner;
    const silver = game.addPiece('silver', owner, rotate([10, 6]));
    assert.equal(game.move(silver.id, rotate([10, 5])), false); // outside five ranks
  }
});

test('last-rank noncapture grants no second promotion opportunity and dead pieces are allowed', () => {
  for (const [type, from, to] of [
    ['pawn', [7, 1], [7, 0]], ['lance', [7, 1], [7, 0]],
    ['stone', [7, 1], [6, 0]], ['iron', [7, 1], [7, 0]], ['knight', [7, 2], [6, 0]],
  ]) for (const owner of [0, 1]) {
    const game = empty(owner);
    const rotate = ([x, y]) => owner === 0 ? [x, y] : [14 - x, 14 - y];
    const piece = game.addPiece(type, owner, rotate(from));
    assert.equal(game.move(piece.id, rotate(to)), false);
    assert.equal(game.violation, null);
    assert.equal(game.outcome, null);
    game.turn = owner;
    assert.deepEqual(game.candidates(piece), []);
  }
});

test('protected lion capture is unrestricted, two captures form one transaction and no hands are generated', () => {
  const game = empty();
  const lion = game.addPiece('lion', 0, [7, 8]);
  const pawn = game.addPiece('pawn', 1, [7, 7]);
  const enemy = game.addPiece('lion', 1, [7, 6]);
  game.addPiece('rook', 1, [7, 3]);
  game.move(lion.id, [7, 7]);
  assert.equal(game.history.length, 0);
  game.move(lion.id, [7, 6]);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].transfers.length, 4);
  assert([...game.locations.values()].every(l => l.kind !== 'hand'));
  game.undo();
  assert.equal(game.pieceAt([7, 8]).id, lion.id);
  assert.equal(game.pieceAt([7, 7]).id, pawn.id);
  assert.equal(game.pieceAt([7, 6]).id, enemy.id);
});

test('Dai has no senjishi restriction after a non-lion captures a lion', () => {
  const game = empty();
  const rook = game.addPiece('rook', 0, [4, 8]);
  game.addPiece('lion', 1, [4, 6]);
  const lion = game.addPiece('lion', 0, [7, 7]);
  game.addPiece('rook', 0, [7, 10]); // protects the retaliatory target
  const enemy = game.addPiece('rook', 1, [7, 6]);
  game.move(rook.id, [4, 6]);
  game.move(enemy.id, [7, 7]);
  assert.equal(game.locations.get(lion.id).kind, 'void');
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
});

test('elephant promotion grants a second royal; king and prince must both be captured', () => {
  const game = empty(1);
  const elephant = game.addPiece('elephant', 1, [5, 9]);
  game.move(elephant.id, [5, 10]);
  game.completePromotion(elephant.id, true);
  const prince = game.pieceAt([5, 10]);
  assert.equal(game.pieceTypeOf(prince).royal, true);
  const rook = game.addPiece('rook', 0, [14, 3]);
  game.move(rook.id, [14, 0]);
  game.completePromotion(rook.id, false);
  assert.equal(game.outcome, null);
  game.turn = 0;
  const attacker = game.addPiece('rook', 0, [5, 11]);
  game.move(attacker.id, [5, 10]);
  assert.equal(game.outcome, 0);
  game.undo();
  assert.equal(game.outcome, null);
  assert.equal(game.pieceAt([5, 10]).id, prince.id);
});
