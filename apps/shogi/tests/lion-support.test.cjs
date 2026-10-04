const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { chuShogi } = require('./build/games/chu-shogi.js');

function setup({ origin = [5, 6], support = [5, 2], moverType = 'lion', victimType = 'lion' } = {}) {
  const game = new Game(false, chuShogi);
  game.addPiece('king', 0, [0, 11]); game.addPiece('king', 1, [11, 0]);
  const mover = game.addPiece(moverType, 0, origin);
  const victim = game.addPiece(victimType, 1, [5, 4]);
  if (support) game.addPiece('rook', 1, support);
  return { game, mover, victim };
}

test('a protected lion at distance two remains a candidate but its capture loses by foul', () => {
  const { game, mover, victim } = setup();
  assert(game.candidates(mover).some(p => p[0] === 5 && p[1] === 4));
  game.move(mover.id, [5, 4]);
  assert.match(game.violation, /獅子の足の規則違反/);
  assert.equal(game.outcome, 1);
  assert.equal(game.history.length, 1);
  assert.equal(game.locations.get(victim.id).kind, 'void');
  game.undo();
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
  assert.equal(game.turn, 0);
  assert.equal(game.pieceAt([5, 6]).id, mover.id);
  assert.equal(game.pieceAt([5, 4]).id, victim.id);
});

test('adjacent capture is allowed even when the victim has support', () => {
  const { game, mover } = setup({ origin: [5, 5] });
  game.move(mover.id, [5, 4]);
  assert.equal(game.pending !== null, true);
  game.endTurn();
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
});

test('a distant unprotected lion can be captured', () => {
  const { game, mover } = setup({ support: null });
  game.move(mover.id, [5, 4]);
  assert.equal(game.violation, null);
});

test('walking next to a protected lion does not turn a distant capture into a distance-one capture', () => {
  const { game, mover } = setup();
  game.move(mover.id, [5, 5]);
  assert.equal(game.violation, null);
  assert.equal(game.outcome, null);
  game.move(mover.id, [5, 4]);
  assert.match(game.violation, /獅子の足の規則違反/);
  game.undo();
  assert.equal(game.pieceAt([5, 6]).id, mover.id);
});

test('tsukegui permits a protected capture except when the preceding capture is a pawn or go-between', () => {
  for (const type of ['silver', 'pawn', 'go-between', 'promoted-pawn', 'lion']) {
    const { game, mover } = setup();
    const extra = game.addPiece(type, 1, [5, 5]);
    game.move(mover.id, [5, 5]);
    assert.equal(game.violation, null);
    game.move(mover.id, [5, 4]);
    assert.equal(game.locations.get(extra.id).kind, 'void');
    if (type === 'pawn' || type === 'go-between') {
      assert.match(game.violation, /獅子の足の規則違反/);
      assert.equal(game.outcome, 1);
    } else assert.equal(game.violation, null);
  }
});

test('shadow support is counted for lion-vs-lion capture too', () => {
  const { game, mover } = setup({ support: [5, 8] });
  game.move(mover.id, [5, 4]);
  assert.match(game.violation, /獅子の足の規則違反/);
});

test('removing a supporting pawn during the turn does not erase turn-start protection', () => {
  const { game, mover } = setup({ origin: [4, 2], support: null });
  game.addPiece('pawn', 1, [5, 3]);
  game.move(mover.id, [5, 3]);
  game.move(mover.id, [5, 4]);
  assert.match(game.violation, /獅子の足の規則違反/);
});

test('promoted kirins obey the rule as both capturer and victim; non-lions can capture a protected lion', () => {
  for (const options of [{ moverType: 'promoted-kirin' }, { victimType: 'promoted-kirin' }]) {
    const { game, mover } = setup(options);
    game.move(mover.id, [5, 4]);
    assert.match(game.violation, /獅子の足の規則違反/);
  }
  const { game, mover } = setup({ moverType: 'rook' });
  game.move(mover.id, [5, 4]);
  assert.equal(game.violation, null);
});
