const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { toriShogi, toriPieceTypes } = require('./build/games/tori-shogi.js');

function empty(owner = 0) {
  const game = new Game(false, toriShogi);
  game.addPiece('phoenix', 0, [1, 6]);
  game.addPiece('phoenix', 1, [5, 0]);
  game.turn = owner;
  return game;
}
function hand(game, type, owner = game.turn) {
  const piece = game.addPiece(type, owner);
  game.locations.set(piece.id, { kind: 'hand' });
  return piece;
}
const positions = (game, piece) => game.candidates(piece).map(p => p.join(',')).sort();
const relative = (owner, [x, y]) => owner === 0 ? [3 + x, 3 + y] : [3 - x, 3 - y];

test('Tori setup has 16 pieces each, distinct quails and rotated advanced swallows', () => {
  const game = new Game(true, toriShogi);
  assert.equal(game.width, 7);
  assert.equal(game.height, 7);
  assert.equal(game.pieces.size, 32);
  assert.equal(Object.keys(toriPieceTypes).length, 9);
  assert.deepEqual(Array.from({ length: 7 }, (_, x) => game.pieceAt([x, 6]).type),
    ['left-quail', 'pheasant', 'crane', 'phoenix', 'crane', 'pheasant', 'right-quail']);
  assert.equal(game.pieceAt([3, 5]).type, 'falcon');
  assert.equal(game.pieceAt([4, 3]).owner, 0);
  assert.equal(game.pieceAt([2, 3]).owner, 1);
  assert.equal(game.pieceAt([0, 0]).type, 'right-quail');
  assert.equal(game.pieceAt([6, 0]).type, 'left-quail');
  for (const owner of [0, 1]) {
    const pieces = [...game.pieces.values()].filter(p => p.owner === owner);
    assert.equal(pieces.length, 16);
    assert.equal(pieces.filter(p => p.type === 'swallow').length, 8);
    assert.equal(pieces.filter(p => game.pieceTypeOf(p).royal).length, 1);
    for (const piece of pieces) {
      const [x, y] = game.locations.get(piece.id).position;
      const opposite = game.pieceAt([6 - x, 6 - y]);
      assert.equal(opposite.type, piece.type);
      assert.equal(opposite.owner, 1 - owner);
      assert.doesNotThrow(() => game.candidates(piece));
    }
  }
});

test('all Tori movement patterns match exact squares for both owners', () => {
  const king = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  const line = ([x,y], limit = 3) => Array.from({length:limit}, (_,i) => [x*(i+1),y*(i+1)]);
  const patterns = {
    phoenix: king,
    falcon: king.filter(([x,y]) => x !== 0 || y !== 1),
    crane: king.filter(([x,y]) => y !== 0),
    pheasant: [[0,-2],[-1,1],[1,1]],
    'left-quail': [...line([0,-1]), ...line([1,1]), [-1,1]],
    'right-quail': [...line([0,-1]), ...line([-1,1]), [1,1]],
    swallow: [[0,-1]],
    goose: [[-2,-2],[2,-2],[0,2]],
    eagle: [...line([-1,-1]), ...line([1,-1]), ...line([0,1]),
      [0,-1],[-1,0],[1,0], ...line([-1,1],2), ...line([1,1],2)],
  };
  for (const owner of [0, 1]) for (const [type, offsets] of Object.entries(patterns)) {
    const game = empty(owner);
    const piece = game.addPiece(type, owner, [3,3]);
    assert.deepEqual(positions(game, piece), offsets.map(p => relative(owner,p).join(',')).sort(), `${type}, owner ${owner}`);
  }
});

test('pheasant and goose jump over pieces but cannot land on allies', () => {
  for (const owner of [0, 1]) for (const [type, middle, target] of [
    ['pheasant', [0,-1], [0,-2]], ['goose', [-1,-1], [-2,-2]],
    ['goose', [1,-1], [2,-2]], ['goose', [0,1], [0,2]],
  ]) {
    const game = empty(owner);
    const piece = game.addPiece(type, owner, [3,3]);
    game.addPiece('crane', owner, relative(owner,middle));
    const to = relative(owner,target);
    assert(positions(game,piece).includes(to.join(',')));
    const victim = game.addPiece('crane',1-owner,to);
    game.move(piece.id,to);
    assert.equal(game.locations.get(victim.id).kind,'void');
    game.undo();
    game.locations.set(victim.id,{kind:'void'});
    game.addPiece('crane',owner,to);
    assert(!positions(game,piece).includes(to.join(',')));
  }
});

test('quail slides and eagle backward diagonals stop at blockers; eagle can capture at distance two', () => {
  for (const owner of [0,1]) for (const [type, vector, farther] of [
    ['left-quail',[1,1],3], ['right-quail',[-1,1],3], ['eagle',[-1,1],2], ['eagle',[1,1],2],
  ]) {
    const game = empty(owner);
    const piece = game.addPiece(type,owner,[3,3]);
    const block = game.addPiece('crane',owner,relative(owner,vector));
    const to = relative(owner,vector.map(n => n*farther));
    assert(!positions(game,piece).includes(to.join(',')));
    game.locations.set(block.id,{kind:'void'});
    game.addPiece('crane',1-owner,to);
    assert(positions(game,piece).includes(to.join(',')));
    game.move(piece.id,to);
    assert.equal(game.pieceAt(to).id,piece.id);
    game.undo();
    assert.equal(game.pieceAt([3,3]).id,piece.id);
  }
});

test('swallow and falcon must promote on entry, within or exiting the two-rank zone; refusal loses and undo clears it', () => {
  for (const owner of [0,1]) for (const [type,promoted] of [['swallow','goose'],['falcon','eagle']]) {
    const paths = type === 'swallow' ? [[2,1],[1,0]] : [[2,1],[1,0],[1,1],[1,2]];
    for (const [fromDepth,toDepth] of paths) for (const promote of [false,true]) {
      const game = empty(owner);
      const from = [3,owner === 0 ? fromDepth : 6-fromDepth];
      const to = [fromDepth <= toDepth ? 4 : 3,owner === 0 ? toDepth : 6-toDepth];
      const piece = game.addPiece(type,owner,from);
      assert.equal(game.move(piece.id,to),true);
      assert.equal(game.outcome,null);
      assert.equal(game.history.length,0);
      game.completePromotion(piece.id,promote);
      assert.equal(game.history.length,1);
      if (promote) {
        assert.equal(game.pieceAt(to).type,promoted);
        assert.notEqual(game.pieceAt(to).id,piece.id);
        assert.equal(game.outcome,null);
      } else {
        assert.match(game.violation,/成り必須/);
        assert.equal(game.outcome,1-owner);
      }
      game.undo();
      assert.equal(game.pieceAt(from).id,piece.id);
      assert.equal(game.pieceAt(to),null);
      assert.equal(game.violation,null);
      assert.equal(game.turn,owner);
    }
  }
});

test('moving outside the zone does not promote; a drop in the zone waits for its next move', () => {
  for (const owner of [0,1]) for (const type of ['swallow','falcon']) {
    const game = empty(owner);
    const piece = game.addPiece(type,owner,[3,owner === 0 ? 4 : 2]);
    assert.equal(game.move(piece.id,[3,3]),false);
    assert.equal(game.pieceAt([3,3]).type,type);
    game.undo();
    const dropped = hand(game,type);
    const to = [4,owner === 0 ? 1 : 5];
    game.drop(dropped.id,to);
    assert.equal(game.awaitingPromotion,false);
    assert.equal(game.violation,null);
    assert.equal(game.pieceAt(to).type,type);
    game.turn = owner;
    assert.equal(game.move(dropped.id,[4,owner === 0 ? 0 : 6]),true);
    game.completePromotion(dropped.id,true);
    assert.equal(game.pieceAt([4,owner === 0 ? 0 : 6]).type,type === 'swallow' ? 'goose' : 'eagle');
  }
});

test('captures revert promotions and preserve quail type, change owner, and undo restores IDs', () => {
  for (const owner of [0,1]) for (const [type,base] of [
    ['goose','swallow'],['eagle','falcon'],['left-quail','left-quail'],['right-quail','right-quail'],
  ]) {
    const game = empty(owner);
    const mover = game.addPiece('crane',owner,[3,3]);
    const victim = game.addPiece(type,1-owner,[3,2]);
    game.move(mover.id,[3,2]);
    const captured = [...game.pieces.values()].find(p => game.locations.get(p.id).kind === 'hand');
    assert.equal(captured.type,base);
    assert.equal(captured.owner,owner);
    assert.notEqual(captured.id,victim.id);
    game.undo();
    assert.equal(game.pieceAt([3,2]).id,victim.id);
    assert.equal(game.locations.get(captured.id).kind,'void');
    assert.equal(game.pieceAt([3,3]).id,mover.id);
  }
});

test('two swallows per file are legal; the third stays selectable, loses on drop and can be undone', () => {
  for (const owner of [0,1]) {
    const game = empty(owner);
    game.addPiece('swallow',owner,[3,3]);
    const second = hand(game,'swallow');
    game.drop(second.id,[3,4]);
    assert.equal(game.violation,null);
    game.turn = owner;
    const third = hand(game,'swallow');
    assert(positions(game,third).includes('3,2'));
    game.drop(third.id,[3,2]);
    assert.match(game.violation,/三燕/);
    assert.equal(game.outcome,1-owner);
    game.undo();
    assert.equal(game.locations.get(third.id).kind,'hand');
    assert.equal(game.outcome,null);
    assert.equal(game.pieceAt([3,4]).id,second.id);
  }
});

test('geese and enemy swallows do not count toward the three-swallow restriction', () => {
  for (const owner of [0,1]) {
    const game = empty(owner);
    game.addPiece('swallow',owner,[3,3]);
    game.addPiece('swallow',1-owner,[3,2]);
    game.addPiece('goose',owner,[3,4]);
    game.drop(hand(game,'swallow').id,[3,5]);
    assert.equal(game.violation,null);
  }
});

test('last-rank swallow drops lose after placement; other base birds may be dropped there', () => {
  for (const owner of [0,1]) for (const type of ['swallow','falcon','crane','pheasant','left-quail','right-quail']) {
    const game = empty(owner);
    const piece = hand(game,type);
    const to = [3,owner === 0 ? 0 : 6];
    assert(positions(game,piece).includes(to.join(',')));
    game.drop(piece.id,to);
    assert.equal(game.awaitingPromotion,false);
    if (type === 'swallow') {
      assert.match(game.violation,/行き所/);
      assert.equal(game.outcome,1-owner);
    } else assert.equal(game.outcome,null);
    game.undo();
    assert.equal(game.locations.get(piece.id).kind,'hand');
    assert.equal(game.outcome,null);
  }
});

test('phoenix and promoted birds cannot drop; phoenix capture wins without generating a hand piece', () => {
  const game = empty();
  for (const type of ['phoenix','goose','eagle']) {
    const piece = hand(game,type);
    assert.deepEqual(game.candidates(piece),[]);
    assert.throws(() => game.drop(piece.id,[3,3]));
  }
  const mover = game.addPiece('crane',0,[4,1]);
  game.move(mover.id,[5,0]);
  assert.equal(game.outcome,0);
  assert.equal(game.history[0].transfers.length,2);
  game.undo();
  assert.equal(game.outcome,null);
  assert.equal(game.pieceAt([5,0]).type,'phoenix');
});
