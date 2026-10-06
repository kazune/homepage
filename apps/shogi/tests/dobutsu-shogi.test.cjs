const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { dobutsuShogi } = require('./build/games/dobutsu-shogi.js');

const rotate = (owner, [x, y]) => owner === 0 ? [x, y] : [2 - x, 3 - y];
function empty(owner = 0) {
  const game = new Game(false, dobutsuShogi);
  game.addPiece('lion', owner, rotate(owner, [0, 3]));
  game.addPiece('lion', 1 - owner, rotate(owner, [2, 0]));
  game.turn = owner;
  return game;
}
function hand(game, type) {
  const piece = game.addPiece(type, game.turn);
  game.locations.set(piece.id, { kind: 'hand' });
  return piece;
}

test('3x4 setup contains four animals per player in rotated positions', () => {
  const game = new Game(true, dobutsuShogi);
  assert.equal(game.width, 3);
  assert.equal(game.height, 4);
  assert.equal(game.pieces.size, 8);
  assert.deepEqual([0, 1, 2].map(x => game.pieceAt([x, 3]).type), ['elephant', 'lion', 'giraffe']);
  for (const piece of game.pieces.values()) {
    const position = game.locations.get(piece.id).position;
    const opposite = game.pieceAt(rotate(1, position));
    assert.equal(opposite.type, piece.type);
    assert.equal(opposite.owner, 1 - piece.owner);
  }
  assert.equal(game.pieceAt([1, 2]).type, 'chick');
  assert.equal(game.pieceAt([1, 1]).type, 'chick');
});

test('all animals move exactly one square with directions rotated for each owner', () => {
  const patterns = {
    lion: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
    elephant: [[-1,-1],[1,-1],[-1,1],[1,1]],
    giraffe: [[0,-1],[-1,0],[1,0],[0,1]],
    chick: [[0,-1]],
    hen: [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[0,1]],
  };
  for (const owner of [0, 1]) for (const [type, offsets] of Object.entries(patterns)) {
    const game = new Game(false, dobutsuShogi);
    const from = rotate(owner, [1, 2]);
    const piece = game.addPiece(type, owner, from);
    if (type !== 'lion') game.addPiece('lion', owner, rotate(owner, [0, 0]));
    game.addPiece('lion', 1 - owner, rotate(owner, [2, 0]));
    game.turn = owner;
    const expected = offsets.map(([dx,dy]) => rotate(owner, [1+dx,2+dy]).join(',')).sort();
    assert.deepEqual(game.candidates(piece).map(p => p.join(',')).sort(), expected, `${owner}: ${type}`);
  }
});

test('last-rank chick moves require promotion; both choices and captures undo as one turn', () => {
  for (const owner of [0, 1]) for (const promote of [true, false]) {
    const game = empty(owner);
    const from = rotate(owner, [1, 1]);
    const to = rotate(owner, [1, 0]);
    const chick = game.addPiece('chick', owner, from);
    const victim = game.addPiece('hen', 1 - owner, to);
    assert.equal(game.move(chick.id, to), true);
    assert.equal(game.outcome, null);
    game.completePromotion(chick.id, promote);
    assert.equal(game.history.length, 1);
    assert.equal(game.pieceAt(to).type, promote ? 'hen' : 'chick');
    assert.equal(game.outcome, promote ? null : 1 - owner);
    if (!promote) assert.match(game.violation, /成り必須/);
    const captured = [...game.pieces.values()].find(p => game.locations.get(p.id).kind === 'hand');
    assert.equal(captured.type, 'chick');
    assert.equal(captured.owner, owner);
    game.undo();
    assert.equal(game.pieceAt(from).id, chick.id);
    assert.equal(game.pieceAt(to).id, victim.id);
    assert.equal(game.locations.get(captured.id).kind, 'void');
    assert.equal(game.violation, null);
    assert.equal(game.turn, owner);
  }
});

test('chick drops allow two per file and last rank without promotion or violations', () => {
  for (const owner of [0, 1]) {
    const game = empty(owner);
    game.addPiece('chick', owner, rotate(owner, [1, 2]));
    const chick = hand(game, 'chick');
    const to = rotate(owner, [1, 0]);
    assert(game.candidates(chick).some(p => p.join(',') === to.join(',')));
    game.drop(chick.id, to);
    assert.equal(game.awaitingPromotion, false);
    assert.equal(game.pieceAt(to).type, 'chick');
    assert.equal(game.outcome, null);
    assert.equal(game.violation, null);
    game.undo();
    assert.equal(game.locations.get(chick.id).kind, 'hand');
    for (const type of ['lion', 'hen']) {
      const invalid = hand(game, type);
      assert.deepEqual(game.candidates(invalid), []);
      assert.throws(() => game.drop(invalid.id, to));
    }
  }
});

test('try waits for the opposing turn and loses on either a move or a drop; undo restores play', () => {
  for (const owner of [0, 1]) for (const drop of [false, true]) {
    const game = new Game(false, dobutsuShogi);
    const lion = game.addPiece('lion', owner, rotate(owner, [1, 1]));
    game.addPiece('lion', 1 - owner, rotate(owner, [2, 2]));
    const opponent = game.addPiece('giraffe', 1 - owner, rotate(owner, [0, 2]));
    game.turn = owner;
    game.move(lion.id, rotate(owner, [1, 0]));
    assert.equal(game.outcome, null);
    assert.equal(game.turn, 1 - owner);
    if (drop) game.drop(hand(game, 'elephant').id, rotate(owner, [0, 1]));
    else game.move(opponent.id, rotate(owner, [0, 1]));
    assert.equal(game.outcome, owner);
    assert.match(game.violation, /トライ/);
    game.undo();
    assert.equal(game.outcome, null);
    assert.equal(game.turn, 1 - owner);
    assert.equal(game.pieceAt(rotate(owner, [1, 0])).id, lion.id);
    game.undo();
    assert.equal(game.pieceAt(rotate(owner, [1, 1])).id, lion.id);
    assert.equal(game.turn, owner);
  }
});

test('opponent may catch the trying lion; capture wins without adding a lion to hand', () => {
  for (const owner of [0, 1]) {
    const game = new Game(false, dobutsuShogi);
    const lion = game.addPiece('lion', owner, rotate(owner, [1, 1]));
    game.addPiece('lion', 1 - owner, rotate(owner, [2, 2]));
    const catcher = game.addPiece('giraffe', 1 - owner, rotate(owner, [2, 0]));
    game.turn = owner;
    game.move(lion.id, rotate(owner, [1, 0]));
    assert.equal(game.outcome, null);
    game.move(catcher.id, rotate(owner, [1, 0]));
    assert.equal(game.outcome, 1 - owner);
    assert.equal(game.violation, null);
    assert(![...game.locations.values()].some(l => l.kind === 'hand'));
    game.undo();
    assert.equal(game.outcome, null);
    assert.equal(game.pieceAt(rotate(owner, [1, 0])).id, lion.id);
  }
});
