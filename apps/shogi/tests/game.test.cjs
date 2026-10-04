const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');

function empty() {
  const game = new Game(false);
  game.addPiece('king', 0, [8, 8]);
  game.addPiece('king', 1, [8, 0]);
  return game;
}

test('initial setup and player-relative movement', () => {
  const game = new Game();
  assert.equal(game.pieces.size, 40);
  assert.equal(game.pieceAt([7, 7]).type, 'rook'); // 先手の飛車：2八
  assert.equal(game.pieceAt([1, 7]).type, 'bishop'); // 先手の角：8八
  assert.equal(game.pieceAt([1, 1]).type, 'rook'); // 後手の飛車：8二
  assert.equal(game.pieceAt([7, 1]).type, 'bishop'); // 後手の角：2二
  assert.equal(game.outcome, null);
  const pawn = game.pieceAt([0, 6]);
  assert.deepEqual(game.candidates(pawn), [[0, 5]]);
  assert.equal(game.move(pawn.id, [0, 5]), false);
  assert.equal(game.turn, 1);
  assert.deepEqual(game.candidates(game.pieceAt([0, 2])), [[0, 3]]);
  assert.deepEqual(game.history[0].playerBefore, 0);
  assert.deepEqual(game.history[0].playerAfter, 1);
});

test('rays can capture a blocker but cannot land beyond it', () => {
  const game = empty();
  const rook = game.addPiece('rook', 0, [4, 5]);
  const victim = game.addPiece('pawn', 1, [4, 3]);
  const friend = game.addPiece('pawn', 0, [6, 5]);
  const choices = game.candidates(rook);
  assert(choices.some(p => p[0] === 4 && p[1] === 3));
  assert(!choices.some(p => p[0] === 4 && p[1] < 3));
  assert(!choices.some(p => p[0] >= 6 && p[1] === 5));
  game.move(rook.id, [4, 3]);
  assert.equal(game.locations.get(victim.id).kind, 'void');
  assert.equal(game.locations.get(friend.id).kind, 'board');
  assert.equal([...game.locations.values()].some(l => l.kind === 'hand'), true);
  game.undo();
  assert.equal(game.pieceAt([4, 3]).id, victim.id);
  assert.equal(game.pieceAt([4, 5]).id, rook.id);
  assert.equal(game.history.length, 0);
});

test('knight jumps over occupied squares and enemy directions rotate', () => {
  const game = empty();
  const knight = game.addPiece('knight', 0, [4, 5]);
  game.addPiece('pawn', 0, [4, 4]);
  assert.deepEqual(game.candidates(knight), [[3, 3], [5, 3]]);
  game.turn = 1;
  const enemy = game.addPiece('knight', 1, [4, 2]);
  assert.deepEqual(game.candidates(enemy), [[5, 4], [3, 4]]);
});

test('capture and promotion are one transaction and undo restores original IDs', () => {
  const game = empty();
  const pawn = game.addPiece('pawn', 0, [4, 3]);
  const victim = game.addPiece('silver', 1, [4, 2]);
  assert.equal(game.move(pawn.id, [4, 2]), true);
  assert.equal(game.turn, 0);
  assert.equal(game.history.length, 0);
  game.completePromotion(pawn.id, true);
  const promoted = game.pieceAt([4, 2]);
  assert.equal(promoted.type, 'tokin');
  assert.notEqual(promoted.id, pawn.id);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].transfers.length, 5);
  game.undo();
  assert.equal(game.turn, 0);
  assert.equal(game.pieceAt([4, 3]).id, pawn.id);
  assert.equal(game.pieceAt([4, 2]).id, victim.id);
  assert.equal(game.locations.get(promoted.id).kind, 'void');
  assert(game.pieces.has(promoted.id));
});

test('undo during promotion rolls back the whole turn; declining mandatory promotion is a foul', () => {
  const game = empty();
  const pawn = game.addPiece('pawn', 0, [4, 1]);
  game.move(pawn.id, [4, 0]);
  game.undo();
  assert.equal(game.pieceAt([4, 1]).id, pawn.id);
  assert.equal(game.pending, null);
  game.move(pawn.id, [4, 0]);
  game.completePromotion(pawn.id, false);
  assert.equal(game.pieceAt([4, 0]).type, 'pawn');
  assert.match(game.violation, /行き所/);
  game.turn = 0;
  assert.deepEqual(game.candidates(pawn), []);
});

test('king capture is allowed; outcome waits for promotion and undo reopens play', () => {
  const game = empty();
  const rook = game.addPiece('rook', 0, [8, 2]);
  assert(game.candidates(rook).some(p => p[0] === 8 && p[1] === 0));
  game.move(rook.id, [8, 0]);
  assert.equal(game.outcome, null);
  game.completePromotion(rook.id, false);
  assert.equal(game.outcome, 0);
  game.undo();
  assert.equal(game.outcome, null);
  assert.equal(game.pieceAt([8, 0]).type, 'king');
});

test('king may move into attack and pinned pieces may move', () => {
  const game = empty();
  game.addPiece('rook', 1, [7, 0]);
  const king = game.pieceAt([8, 8]);
  assert(game.candidates(king).some(p => p[0] === 7 && p[1] === 8));
  assert.doesNotThrow(() => game.move(king.id, [7, 8]));
});

test('horse and dragon combine sliding and single-step movement', () => {
  for (const [id, expected, excluded] of [
    ['horse', [4, 3], [4, 2]], ['dragon', [3, 3], [2, 2]],
  ]) {
    const game = empty();
    const piece = game.addPiece(id, 0, [4, 4]);
    const choices = game.candidates(piece).map(p => p.join(','));
    assert(choices.includes(expected.join(',')));
    assert(!choices.includes(excluded.join(',')));
  }
});
