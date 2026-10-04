const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { chuShogi } = require('./build/games/chu-shogi.js');
const { step, sequence } = require('./build/rules.js');
function empty(definition = chuShogi) {
  const game = new Game(false, definition);
  game.addPiece('king', 0, [0, 11]);
  game.addPiece('king', 1, [11, 0]);
  return game;
}
const positions = (game, piece) => game.candidates(piece).map(p => p.join(','));

test('12×12 board, 46 pieces each, and asymmetric central pieces rotate correctly', () => {
  const game = new Game(true, chuShogi);
  assert.equal(game.width, 12);
  assert.equal(game.height, 12);
  assert.equal(game.pieces.size, 92);
  for (const owner of [0, 1]) assert.equal([...game.pieces.values()].filter(p => p.owner === owner).length, 46);
  const expected = [
    [[5, 11], 'king', 0], [[6, 11], 'elephant', 0],
    [[5, 10], 'kirin', 0], [[6, 10], 'phoenix', 0],
    [[5, 9], 'lion', 0], [[6, 9], 'queen', 0],
    [[6, 0], 'king', 1], [[5, 0], 'elephant', 1],
    [[6, 1], 'kirin', 1], [[5, 1], 'phoenix', 1],
    [[6, 2], 'lion', 1], [[5, 2], 'queen', 1],
    [[3, 7], 'go-between', 0], [[8, 7], 'go-between', 0],
  ];
  for (const [position, type, owner] of expected) {
    assert.equal(game.pieceAt(position).type, type);
    assert.equal(game.pieceAt(position).owner, owner);
  }
  assert.equal(game.pieceAt([12, 0]), undefined);
  assert.equal(game.pieceAt([0, 12]), undefined);
  assert.equal(game.pieceAt([3, 6]), null);
  for (const piece of game.pieces.values()) if (piece.owner === 0) assert.doesNotThrow(() => game.candidates(piece));
});

test('all base and promoted movement definitions generate unambiguous candidates for both players', () => {
  for (const type of Object.keys(chuShogi.pieceTypes)) for (const owner of [0, 1]) {
    const game = empty();
    game.turn = owner;
    const piece = game.addPiece(type, owner, [5, 5]);
    const candidates = game.candidates(piece);
    assert(candidates.length > 0, type);
    assert.equal(candidates.length, new Set(candidates.map(p => p.join(','))).size);
  }
});

test('directional steps and promoted ranging pieces match their forward/backward restrictions', () => {
  const cases = [
    ['tiger', [5, 6], [5, 4]],
    ['elephant', [5, 4], [5, 6]],
    ['copper', [4, 4], [4, 6]],
    ['leopard', [4, 6], [4, 5]],
    ['side-mover', [1, 5], [5, 3]],
    ['vertical-mover', [5, 1], [3, 5]],
    ['reverse-chariot', [5, 1], [4, 5]],
    ['promoted-tiger', [5, 1], [3, 3]],
    ['promoted-vertical-mover', [2, 2], [2, 5]],
    ['promoted-side-mover', [2, 5], [5, 2]],
    ['promoted-reverse-chariot', [8, 8], [2, 2]],
    ['promoted-lance', [2, 2], [8, 8]],
  ];
  for (const [type, included, excluded] of cases) for (const owner of [0, 1]) {
    const game = empty();
    game.turn = owner;
    const piece = game.addPiece(type, owner, [5, 5]);
    const rotate = ([x, y]) => owner === 0 ? [x, y] : [10 - x, 10 - y];
    const choices = positions(game, piece);
    assert(choices.includes(rotate(included).join(',')), `${type}: included for ${owner}`);
    assert(!choices.includes(rotate(excluded).join(',')), `${type}: excluded for ${owner}`);
  }
});

test('lion changes direction, captures twice, and undoes the whole turn', () => {
  const game = empty();
  const lion = game.addPiece('lion', 0, [5, 6]);
  const a = game.addPiece('silver', 1, [5, 5]);
  const b = game.addPiece('gold', 1, [6, 4]);
  game.move(lion.id, [5, 5]);
  assert.equal(game.turn, 0);
  assert.equal(game.history.length, 0);
  assert.equal(game.stage, 1);
  assert.equal(game.canEndTurn, true);
  assert(positions(game, lion).includes('6,4'));
  assert.equal(game.candidates(game.pieceAt([0, 11])).length, 0);
  assert.throws(() => game.move(game.pieceAt([0, 11]).id, [1, 11]));
  game.move(lion.id, [6, 4]);
  assert.equal(game.turn, 1);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].transfers.length, 4);
  assert.equal(game.locations.get(a.id).kind, 'void');
  assert.equal(game.locations.get(b.id).kind, 'void');
  game.undo();
  assert.equal(game.turn, 0);
  assert.equal(game.pieceAt([5, 6]).id, lion.id);
  assert.equal(game.pieceAt([5, 5]).id, a.id);
  assert.equal(game.pieceAt([6, 4]).id, b.id);
});

test('lion igui and jitto return to origin; undo during a sequence restores its start', () => {
  const game = empty();
  const lion = game.addPiece('lion', 0, [5, 6]);
  const victim = game.addPiece('pawn', 1, [5, 5]);
  game.move(lion.id, [5, 5]);
  assert(positions(game, lion).includes('5,6'));
  game.undo();
  assert.equal(game.pieceAt([5, 5]).id, victim.id);
  assert.equal(game.pieceAt([5, 6]).id, lion.id);
  game.move(lion.id, [5, 5]);
  game.move(lion.id, [5, 6]);
  assert.equal(game.pieceAt([5, 6]).id, lion.id);
  assert.equal(game.locations.get(victim.id).kind, 'void');
  game.undo();
  game.move(lion.id, [6, 6]);
  game.move(lion.id, [5, 6]);
  assert.equal(game.history.length, 1);
  assert.equal(game.turn, 1);
  assert.equal(game.pieceAt([5, 5]).id, victim.id);
});

test('lion can stop after one step or jump over friendly blockers to distance two', () => {
  const game = empty();
  const lion = game.addPiece('lion', 0, [5, 6]);
  game.move(lion.id, [5, 5]);
  assert.equal(game.endTurn(), false);
  assert.equal(game.turn, 1);
  game.undo();
  const friend = game.addPiece('pawn', 0, [5, 5]);
  assert(!positions(game, lion).includes('5,5'));
  assert(positions(game, lion).includes('5,4'));
  assert(positions(game, lion).includes('6,4'));
  game.move(lion.id, [5, 4]);
  assert.equal(game.pending, null);
  assert.equal(game.pieceAt([5, 5]).id, friend.id);
});

test('lion-vs-lion capture does not activate senjishi on the following turn', () => {
  const game = empty();
  const lion = game.addPiece('lion', 0, [5, 6]);
  const enemy = game.addPiece('lion', 1, [5, 4]);
  const defender = game.addPiece('rook', 1, [5, 2]);
  assert(positions(game, lion).includes('5,4'));
  game.move(lion.id, [5, 4]);
  assert.equal(game.locations.get(enemy.id).kind, 'void');
  assert(positions(game, defender).includes('5,4'));
  game.move(defender.id, [5, 4]);
  if (game.awaitingPromotion) game.completePromotion(defender.id, false);
  assert.equal(game.locations.get(lion.id).kind, 'void');
});

test('falcon and eagle stay on their selected line; jump and igui are available', () => {
  for (const [type, first, onward, offLine] of [
    ['promoted-horse', [5, 5], [5, 4], [6, 4]],
    ['promoted-dragon', [6, 5], [7, 4], [5, 4]],
  ]) {
    const game = empty();
    const piece = game.addPiece(type, 0, [5, 6]);
    const a = game.addPiece('pawn', 1, first);
    const b = game.addPiece('pawn', 1, onward);
    assert(positions(game, piece).includes(onward.join(',')));
    game.move(piece.id, first);
    const choices = positions(game, piece);
    assert(choices.includes(onward.join(',')));
    assert(choices.includes('5,6'));
    assert(!choices.includes(offLine.join(',')));
    game.move(piece.id, onward);
    assert.equal(game.locations.get(a.id).kind, 'void');
    assert.equal(game.locations.get(b.id).kind, 'void');
    game.undo();
    game.move(piece.id, first);
    game.move(piece.id, [5, 6]);
    assert.equal(game.pieceAt([5, 6]).id, piece.id);
  }
});

test('kirin and phoenix jump over pieces but keep their distinct step directions', () => {
  for (const [type, jump, stepSquare, excluded] of [
    ['kirin', [5, 4], [4, 5], [5, 5]],
    ['phoenix', [3, 4], [5, 5], [4, 5]],
  ]) {
    const game = empty();
    const piece = game.addPiece(type, 0, [5, 6]);
    const choices = positions(game, piece);
    assert(choices.includes(jump.join(',')));
    assert(choices.includes(stepSquare.join(',')));
    assert(!choices.includes(excluded.join(',')));
    game.addPiece('pawn', 0, excluded);
    assert(positions(game, piece).includes(jump.join(',')));
  }
});

test('promotion on entry, capture in zone, and pawn last rank; promoted types cannot promote again', () => {
  const game = empty();
  const gold = game.addPiece('gold', 0, [5, 4]);
  assert.equal(game.move(gold.id, [5, 3]), true);
  game.completePromotion(gold.id, true);
  const rook = game.pieceAt([5, 3]);
  assert.equal(rook.type, 'promoted-gold');
  assert.equal(game.pieceTypeOf(rook).name, '飛車');
  assert.equal(game.pieceTypeOf(rook).promoteTo, undefined);
  game.undo();
  game.move(gold.id, [5, 3]); game.completePromotion(gold.id, false);
  game.turn = 0;
  assert.equal(game.move(gold.id, [5, 2]), false); // noncapture within zone
  game.turn = 0;
  game.addPiece('pawn', 1, [5, 1]);
  assert.equal(game.move(gold.id, [5, 1]), true);
  game.completePromotion(gold.id, false);
  game.turn = 0;
  const pawn = game.addPiece('pawn', 0, [7, 1]);
  assert.equal(game.move(pawn.id, [7, 0]), true);
});

test('royal prince survives loss of king; royal capture settles only when the turn ends', () => {
  const game = empty();
  const prince = game.addPiece('promoted-elephant', 1, [5, 5]);
  const lion = game.addPiece('lion', 0, [10, 1]);
  game.move(lion.id, [11, 0]);
  assert.equal(game.outcome, null);
  game.endTurn();
  assert.equal(game.outcome, null);
  game.turn = 0;
  const rook = game.addPiece('rook', 0, [5, 6]);
  game.move(rook.id, [5, 5]);
  assert.equal(game.outcome, 0);
  game.undo();
  assert.equal(game.locations.get(prince.id).kind, 'board');
  assert.equal(game.outcome, null);
});

test('elephant promotion creates a royal, while promoted go-between cannot promote again', () => {
  const game = empty();
  const elephant = game.addPiece('elephant', 0, [5, 4]);
  game.move(elephant.id, [5, 3]);
  game.completePromotion(elephant.id, true);
  assert.equal(game.pieceTypeOf(game.pieceAt([5, 3])).royal, true);
  assert.equal(chuShogi.pieceTypes['promoted-go-between'].royal, false);
  assert.equal(chuShogi.pieceTypes['promoted-go-between'].promoteTo, undefined);
});

test('forced sequence may dead-end; undo resets the entire attempted turn', () => {
  const definition = { ...chuShogi, pieceTypes: { ...chuShogi.pieceTypes,
    test: { ...chuShogi.pieceTypes.gold, id: 'test', promoteTo: undefined,
      sequences: [sequence([step([0, -1])], [step([0, -1])])] },
  } };
  const game = empty(definition);
  const piece = game.addPiece('test', 0, [5, 6]);
  game.addPiece('pawn', 0, [5, 4]);
  assert(positions(game, piece).includes('5,5'));
  game.move(piece.id, [5, 5]);
  assert.equal(game.canEndTurn, false);
  assert.deepEqual(game.candidates(piece), []);
  assert.throws(() => game.endTurn(), /合法に移動を終了できません/);
  game.undo();
  assert.equal(game.pieceAt([5, 6]).id, piece.id);
});
