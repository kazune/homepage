const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { chuShogi } = require('./build/games/chu-shogi.js');

function empty(owner = 0) {
  const game = new Game(false);
  game.addPiece('king', 0, [8, 8]);
  game.addPiece('king', 1, [8, 0]);
  game.turn = owner;
  return game;
}
function hand(game, type, owner = game.turn) {
  const piece = game.addPiece(type, owner);
  game.locations.set(piece.id, { kind: 'hand' });
  return piece;
}

test('captured promoted pieces become new unpromoted pieces owned by capturer; undo restores both', () => {
  for (const owner of [0, 1]) for (const [type, base] of [
    ['tokin', 'pawn'], ['promoted-lance', 'lance'], ['promoted-knight', 'knight'],
    ['promoted-silver', 'silver'], ['horse', 'bishop'], ['dragon', 'rook'], ['gold', 'gold'],
  ]) {
    const game = empty(owner);
    const rook = game.addPiece('rook', owner, [4, 4]);
    const victim = game.addPiece(type, 1 - owner, [4, 3]);
    if (game.move(rook.id, [4, 3])) game.completePromotion(rook.id, false);
    const replacement = [...game.pieces.values()].find(p => game.locations.get(p.id).kind === 'hand');
    assert.equal(replacement.type, base);
    assert.equal(replacement.owner, owner);
    assert.notEqual(replacement.id, victim.id);
    assert.equal(game.locations.get(victim.id).kind, 'void');
    assert.equal(game.history.length, 1);
    game.undo();
    assert.equal(game.locations.get(replacement.id).kind, 'void');
    assert.equal(game.pieceAt([4, 3]).id, victim.id);
    assert.equal(game.pieceAt([4, 4]).id, rook.id);
  }
});

test('king capture never generates a hand piece', () => {
  const game = empty();
  const rook = game.addPiece('rook', 0, [8, 2]);
  game.move(rook.id, [8, 0]);
  game.completePromotion(rook.id, false);
  assert.equal([...game.locations.values()].some(l => l.kind === 'hand'), false);
  assert.equal(game.outcome, 0);
});

test('drop is one turn, never offers promotion and undo returns the same hand ID', () => {
  const game = empty();
  const pawn = hand(game, 'pawn');
  assert.equal(game.candidates(pawn).length, 79);
  assert(!game.candidates(pawn).some(p => p.join() === '8,0'));
  game.drop(pawn.id, [4, 1]);
  assert.equal(game.pieceAt([4, 1]).id, pawn.id);
  assert.equal(game.awaitingPromotion, false);
  assert.equal(game.turn, 1);
  assert.equal(game.history[0].transfers.length, 1);
  assert.equal(game.outcome, null);
  game.undo();
  assert.equal(game.turn, 0);
  assert.equal(game.locations.get(pawn.id).kind, 'hand');
  assert.equal(game.pieceAt([4, 1]), null);
});

test('drop rejects occupied or invalid squares, wrong owner, non-hand pieces and pending turns', () => {
  const game = empty();
  const pawn = hand(game, 'pawn');
  for (const position of [[8, 8], [-1, 4], [9, 4], [4, 0.5]]) assert.throws(() => game.drop(pawn.id, position));
  assert.throws(() => game.drop(hand(game, 'pawn', 1).id, [4, 4]));
  assert.throws(() => game.drop(game.addPiece('gold', 0, [4, 5]).id, [4, 4]));
  assert.throws(() => game.drop(game.addPiece('silver', 0).id, [4, 4]));
  assert.throws(() => game.drop(hand(game, 'tokin').id, [4, 4]));
  const mover = game.addPiece('pawn', 0, [2, 3]);
  game.move(mover.id, [2, 2]);
  assert.deepEqual(game.candidates(pawn), []);
  assert.throws(() => game.drop(pawn.id, [4, 4]));
  game.undo();
  assert.equal(game.history.length, 0);
});

test('nifu stays in candidates, causes foul loss after drop, and undo reopens play', () => {
  for (const owner of [0, 1]) {
    const game = empty(owner);
    game.addPiece('pawn', owner, [4, 4]);
    const pawn = hand(game, 'pawn');
    assert(game.candidates(pawn).some(p => p.join() === '4,3'));
    game.drop(pawn.id, [4, 3]);
    assert.match(game.violation, /二歩/);
    assert.equal(game.outcome, 1 - owner);
    assert.throws(() => game.drop(hand(game, 'gold', owner).id, [5, 4]));
    game.undo();
    assert.equal(game.violation, null);
    assert.equal(game.outcome, null);
    assert.equal(game.locations.get(pawn.id).kind, 'hand');
  }
});

test('tokin and opposing pawns do not count toward nifu; another file is legal', () => {
  for (const type of ['tokin', 'pawn']) {
    const game = empty();
    game.addPiece(type, type === 'tokin' ? 0 : 1, [4, 4]);
    game.addPiece('pawn', 0, [3, 4]);
    game.drop(hand(game, 'pawn').id, [4, 3]);
    assert.equal(game.violation, null);
  }
});

test('dead-square drops lose after completion in both directions; boundary ranks remain legal', () => {
  for (const owner of [0, 1]) for (const [type, depth, illegal] of [
    ['pawn', 0, true], ['lance', 0, true], ['knight', 0, true], ['knight', 1, true],
    ['pawn', 1, false], ['lance', 1, false], ['knight', 2, false], ['gold', 0, false],
  ]) {
    const game = empty(owner);
    const piece = hand(game, type);
    const position = [4, owner === 0 ? depth : 8 - depth];
    assert(game.candidates(piece).some(p => p.join() === position.join()));
    game.drop(piece.id, position);
    assert.equal(game.awaitingPromotion, false);
    if (illegal) {
      assert.match(game.violation, /行き所/);
      assert.equal(game.outcome, 1 - owner);
    } else assert.equal(game.outcome, null);
    game.undo();
    assert.equal(game.outcome, null);
    assert.equal(game.locations.get(piece.id).kind, 'hand');
  }
});

test('dead-square moves are checked after promotion choice for both players', () => {
  for (const owner of [0, 1]) for (const type of ['pawn', 'lance', 'knight']) for (const promote of [false, true]) {
    const game = empty(owner);
    const depth = type === 'knight' ? 2 : 1;
    const piece = game.addPiece(type, owner, [4, owner === 0 ? depth : 8 - depth]);
    const to = [type === 'knight' ? 3 : 4, owner === 0 ? 0 : 8];
    assert.equal(game.move(piece.id, to), true);
    assert.equal(game.outcome, null);
    game.completePromotion(piece.id, promote);
    if (promote) assert.equal(game.outcome, null);
    else assert.match(game.violation, /行き所/);
    game.undo();
    assert.equal(game.pieceAt([4, owner === 0 ? depth : 8 - depth]).id, piece.id);
    assert.equal(game.violation, null);
  }
});

test('Chu continues to remove captures and does not allow drops', () => {
  const game = new Game(false, chuShogi);
  game.addPiece('king', 0, [11, 11]);
  game.addPiece('king', 1, [11, 0]);
  const rook = game.addPiece('rook', 0, [4, 5]);
  const victim = game.addPiece('pawn', 1, [4, 4]);
  game.move(rook.id, [4, 4]);
  assert.equal(game.locations.get(victim.id).kind, 'void');
  assert.equal([...game.locations.values()].some(l => l.kind === 'hand'), false);
  game.turn = 0;
  const pawn = hand(game, 'pawn');
  assert.deepEqual(game.candidates(pawn), []);
  assert.throws(() => game.drop(pawn.id, [5, 5]));
});
