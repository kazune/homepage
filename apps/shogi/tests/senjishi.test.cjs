const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { chuShogi } = require('./build/games/chu-shogi.js');

function setup({ support = true, retaliator = 'rook', position = [2, 4], shadow = false, capturer = 'rook' } = {}) {
  const game = new Game(false, chuShogi);
  game.addPiece('king', 0, [0, 11]);
  game.addPiece('king', 1, [11, 0]);
  const protectedLion = game.addPiece('lion', 0, [2, 6]);
  const takenLion = game.addPiece('lion', 1, [8, 4]);
  const first = game.addPiece(capturer, 0, capturer === 'lion' ? [8, 5] : [8, 6]);
  if (support) game.addPiece('rook', 0, shadow ? [2, 2] : [2, 8]);
  const reply = game.addPiece(retaliator, 1, position);
  game.move(first.id, [8, 4]);
  if (game.canEndTurn) game.endTurn();
  assert.equal(game.pending, null);
  assert.equal(game.outcome, null);
  return { game, protectedLion, takenLion, first, reply };
}
const includes = (game, piece, [x, y]) => game.candidates(piece).some(p => p[0] === x && p[1] === y);

test('senjishi keeps the target visible, commits the illegal turn, and awards a foul win', () => {
  const { game, reply, protectedLion } = setup();
  assert(includes(game, reply, [2, 6]));
  game.move(reply.id, [2, 6]);
  assert.match(game.violation, /先獅子違反/);
  assert.equal(game.outcome, 0);
  assert.equal(game.history.length, 2);
  assert.equal(game.pieceAt([2, 6]).id, reply.id);
  assert.equal(game.locations.get(protectedLion.id).kind, 'void');
  assert.deepEqual(game.candidates(reply), []);
  assert.throws(() => game.move(game.pieceAt([0, 11]).id, [1, 11]));
});

test('undo clears foul loss and restores both the board and the prior senjishi condition', () => {
  const { game, reply, protectedLion } = setup();
  game.move(reply.id, [2, 6]);
  assert.equal(game.undo(), true);
  assert.equal(game.outcome, null);
  assert.equal(game.violation, null);
  assert.equal(game.turn, 1);
  assert.equal(game.pieceAt([2, 6]).id, protectedLion.id);
  assert.equal(game.pieceAt([2, 4]).id, reply.id);
  game.move(reply.id, [2, 6]);
  assert.match(game.violation, /先獅子違反/);
});

test('an unsupported lion may be captured immediately under the association interpretation', () => {
  const { game, reply } = setup({ support: false });
  game.move(reply.id, [2, 6]);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
});

test('shadow support counts after vacating the capturing piece origin', () => {
  const { game, reply } = setup({ shadow: true });
  game.move(reply.id, [2, 6]);
  assert.match(game.violation, /先獅子違反/);
});

test('a supporting lion is detected without recursively applying special rules', () => {
  const { game, reply } = setup({ support: false });
  game.addPiece('lion', 0, [4, 6]);
  game.move(reply.id, [2, 6]);
  assert.match(game.violation, /先獅子違反/);
});

test('ato-jishi needs no separate flag: the restriction expires after an intervening turn', () => {
  const { game, reply } = setup();
  game.move(reply.id, [2, 3]);
  const king = game.pieceAt([0, 11]);
  game.move(king.id, [1, 11]);
  game.move(reply.id, [2, 6]);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
});

test('a lion taking a lion does not trigger senjishi on the following turn', () => {
  const { game, reply } = setup({ capturer: 'lion' });
  game.move(reply.id, [2, 6]);
  assert.equal(game.violation, null);
});

test('adjacent lion capture overrides senjishi', () => {
  const { game, reply } = setup({ retaliator: 'lion', position: [2, 5] });
  game.move(reply.id, [2, 6]);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null); // still in the same turn
  game.endTurn();
  assert.equal(game.violation, null);
});

test('walking adjacent in stage one does not bypass the start-of-turn distance test', () => {
  const { game, reply } = setup({ retaliator: 'lion' });
  game.move(reply.id, [2, 5]);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
  assert(includes(game, reply, [2, 6]));
  game.move(reply.id, [2, 6]);
  assert.match(game.violation, /先獅子違反/);
  game.undo();
  assert.equal(game.pieceAt([2, 4]).id, reply.id);
  assert.equal(game.history.length, 1);
});

test('tsukegui overrides senjishi, except when the additional capture is a pawn or go-between', () => {
  for (const type of ['gold', 'pawn', 'go-between', 'promoted-pawn']) {
    const { game, reply } = setup({ retaliator: 'lion' });
    game.addPiece(type, 0, [2, 5]);
    game.move(reply.id, [2, 5]);
    assert.equal(game.violation, null);
    game.move(reply.id, [2, 6]);
    if (type === 'pawn' || type === 'go-between') assert.match(game.violation, /先獅子違反/);
    else assert.equal(game.violation, null);
  }
});

test('capturing a supporting pawn first does not erase its start-of-turn protection', () => {
  const { game, reply } = setup({ support: false, retaliator: 'lion', position: [3, 8] });
  game.addPiece('pawn', 0, [2, 7]); // supports the lion at 2,6
  game.move(reply.id, [2, 7]);
  game.move(reply.id, [2, 6]);
  assert.match(game.violation, /先獅子違反/);
});

test('kirin capture followed by promotion triggers senjishi, including the newly created lion', () => {
  const game = new Game(false, chuShogi);
  game.addPiece('king', 0, [0, 11]); game.addPiece('king', 1, [11, 0]);
  const kirin = game.addPiece('kirin', 0, [8, 5]);
  game.addPiece('lion', 1, [8, 3]);
  game.addPiece('rook', 0, [8, 7]);
  const reply = game.addPiece('rook', 1, [8, 1]);
  assert.equal(game.move(kirin.id, [8, 3]), true);
  assert.equal(game.violation, null);
  game.completePromotion(kirin.id, true);
  const promoted = game.pieceAt([8, 3]);
  assert.equal(promoted.type, 'promoted-kirin');
  game.move(reply.id, [8, 3]);
  assert.match(game.violation, /先獅子違反/);
  game.undo();
  assert.equal(game.pieceAt([8, 3]).id, promoted.id);
  assert.equal(game.violation, null);
});

test('promotion disposal alone does not count as a lion capture', () => {
  const { game, reply, takenLion } = setup();
  game.undo(); // undo the real lion capture
  const kirin = game.addPiece('kirin', 0, [5, 5]);
  game.move(kirin.id, [5, 3]); game.completePromotion(kirin.id, true);
  assert.equal(game.locations.get(takenLion.id).kind, 'board');
  game.move(reply.id, [2, 6]);
  assert.equal(game.violation, null);
});

test('foul validation runs after promotion, and undo reverses captures and replacement together', () => {
  const { game, reply } = setup({ retaliator: 'rook', position: [2, 9], shadow: true });
  // This rook starts in its promotion zone and captures a supported lion.
  assert.equal(game.move(reply.id, [2, 6]), true);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
  game.completePromotion(reply.id, true);
  const replacement = game.pieceAt([2, 6]);
  assert.equal(replacement.type, 'promoted-rook');
  assert.match(game.violation, /先獅子違反/);
  game.undo();
  assert.equal(game.pieceAt([2, 9]).id, reply.id);
  assert.equal(game.locations.get(replacement.id).kind, 'void');
  assert.equal(game.violation, null);
});

test('a foul result takes precedence over royal capture and is removed by undo', () => {
  const definition = { ...chuShogi, validateTurn: () => 'テスト反則' };
  const game = new Game(false, definition);
  game.addPiece('king', 0, [0, 11]);
  game.addPiece('king', 1, [5, 5]);
  const rook = game.addPiece('rook', 0, [5, 6]);
  game.move(rook.id, [5, 5]);
  assert.equal(game.outcome, 1);
  assert.equal(game.violation, 'テスト反則');
  game.undo();
  assert.equal(game.outcome, null);
  assert.equal(game.violation, null);
});
