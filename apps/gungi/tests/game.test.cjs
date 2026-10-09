const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GungiGame } = require('./build/game.js');
const { types, counts, movements, indexOf } = require('./build/pieces.js');

function place(game, owner, type, x, y) {
  game.state.turn = owner;
  const piece = game.state.hands[owner].find(p => p.type === type);
  assert.ok(piece, `missing ${type}`);
  game.apply({ pieceId: piece.id, to: indexOf([x, y]), kind: 'place' });
  return piece;
}
function fixture() {
  const game = new GungiGame();
  place(game, 0, '帥', 8, 8);
  place(game, 1, '帥', 8, 0);
  game.state.phase = 'play';
  game.state.turn = 0;
  game.history.length = 0;
  return game;
}
function put(game, type, owner, x, y) {
  const piece = game.state.hands[owner].find(p => p.type === type);
  assert.ok(piece, `missing ${type}`);
  game.state.hands[owner] = game.state.hands[owner].filter(p => p.id !== piece.id);
  game.state.board[indexOf([x, y])].push(piece);
  return piece;
}
function kinds(game, piece, x, y) { return game.actions(piece.id).filter(a => a.to === indexOf([x, y])).map(a => a.kind); }
function act(game, piece, x, y, kind) { game.apply({ pieceId: piece.id, to: indexOf([x, y]), kind }); }
function invariant(game) {
  const pieces = [...game.state.board.flat(), ...game.state.hands.flat(), ...game.state.removed];
  assert.equal(pieces.length, 50);
  assert.equal(new Set(pieces.map(p => p.id)).size, 50);
  assert.ok(game.state.board.every(tower => tower.length <= 3));
  assert.ok(game.state.hands.every((hand, owner) => hand.every(p => p.owner === owner)));
}

test('initial inventory: 14 types, 25 pieces per side, unique identities', () => {
  const game = new GungiGame();
  for (const owner of [0, 1]) {
    assert.equal(game.state.hands[owner].length, 25);
    for (const type of types) assert.equal(game.state.hands[owner].filter(p => p.type === type).length, counts[type]);
  }
  invariant(game);
  assert.equal(game.canFinishSetup, false);
  assert.throws(() => game.declareReady());
});

test('setup requires marshal first and home three ranks; alternating turns', () => {
  const game = new GungiGame();
  const marshal = game.state.hands[0].find(p => p.type === '帥');
  assert.equal(game.actions(marshal.id).length, 27);
  assert.equal(game.actions(game.state.hands[0].find(p => p.type === '兵').id).length, 0);
  const before = structuredClone(game.state);
  assert.throws(() => act(game, marshal, 4, 5, 'place'));
  assert.deepEqual(game.state, before);
  place(game, 0, '帥', 4, 8);
  assert.equal(game.state.turn, 1);
  place(game, 1, '帥', 4, 0);
  assert.equal(game.state.turn, 0);
  assert.equal(game.canFinishSetup, true);
});

test('setup caps towers at three and prohibits placing on marshal', () => {
  const game = new GungiGame();
  place(game, 0, '帥', 8, 8);
  place(game, 1, '帥', 8, 0);
  place(game, 0, '兵', 4, 6);
  place(game, 0, '兵', 4, 6);
  place(game, 0, '兵', 4, 6);
  game.state.turn = 0;
  const piece = game.state.hands[0].find(p => p.type === '小');
  assert.ok(!kinds(game, piece, 4, 6).length);
  assert.ok(!kinds(game, piece, 8, 8).length);
  invariant(game);
});

test('ready declaration skips first player, second ends setup; undo restores phase', () => {
  const game = new GungiGame();
  place(game, 0, '帥', 8, 8);
  place(game, 1, '帥', 8, 0);
  game.declareReady();
  assert.deepEqual(game.state.done, [true, false]);
  place(game, 1, '兵', 4, 2);
  assert.equal(game.state.turn, 1);
  const before = structuredClone(game.state);
  game.declareReady();
  assert.equal(game.state.phase, 'play');
  assert.equal(game.state.turn, 0);
  game.undo();
  assert.deepEqual(game.state, before);
});

test('second player can finish before first; automatic finish after last reserve', () => {
  const game = new GungiGame();
  place(game, 0, '帥', 8, 8);
  place(game, 1, '帥', 8, 0);
  game.state.turn = 1;
  game.declareReady();
  assert.equal(game.state.phase, 'play');
  assert.equal(game.state.turn, 0);

  const all = new GungiGame();
  place(all, 0, '帥', 8, 8);
  place(all, 1, '帥', 8, 0);
  all.declareReady();
  while (all.state.phase === 'setup') {
    const piece = all.state.hands[1][0];
    const action = all.actions(piece.id)[0];
    assert.ok(action);
    all.apply(action);
  }
  assert.equal(all.state.turn, 0);
  invariant(all);
  all.undo();
  assert.equal(all.state.phase, 'setup');
  assert.equal(all.state.hands[1].length, 1);
});

test('all tiers match the movement chart, including bow fan and cannon minimum', () => {
  const expected = { 帥: [8,16,24], 大: [36,40,44], 中: [36,40,44], 小: [6,12,18], 侍: [4,8,12], 槍: [5,9,13], 馬: [6,10,14], 忍: [8,12,16], 砦: [5,10,15], 兵: [2,4,6], 砲: [4,8,12], 弓: [4,8,12], 筒: [3,6,9], 謀: [3,6,9] };
  for (const type of types) for (let tier = 1; tier <= 3; tier++) {
    assert.equal(movements(type, tier).length, expected[type][tier - 1], `${type}/${tier}`);
  }
  const offsets = type => movements(type, 3).map(m => m.offset);
  assert.ok(offsets('弓').some(p => p[0] === -3 && p[1] === -4));
  assert.ok(!offsets('弓').some(p => p[0] === -2 && p[1] === -4));
  assert.ok(!offsets('砲').some(p => p[0] === 0 && p[1] === -2));
  assert.throws(() => movements('兵', 4));
});

test('directions rotate for second player, boundaries restrict candidates', () => {
  const game = fixture();
  const first = put(game, '侍', 0, 4, 5);
  assert.ok(kinds(game, first, 3, 4).includes('move'));
  assert.ok(!kinds(game, first, 3, 6).length);
  const second = put(game, '侍', 1, 4, 3);
  game.state.turn = 1;
  assert.ok(kinds(game, second, 5, 4).includes('move'));
  assert.ok(!kinds(game, second, 5, 2).length);
  const edge = put(game, '忍', 1, 0, 0);
  assert.ok(game.actions(edge.id).every(a => a.to >= 0 && a.to < 81));
});

test('only top moves; exposes lower piece; moving tier determines range; undo exact', () => {
  const game = fixture();
  const lower = put(game, '兵', 1, 4, 4);
  const top = put(game, '兵', 0, 4, 4);
  assert.equal(game.actions(lower.id).length, 0);
  assert.ok(kinds(game, top, 4, 2).includes('move'));
  const before = structuredClone(game.state);
  act(game, top, 4, 2, 'move');
  assert.equal(game.top(indexOf([4,4])).id, lower.id);
  assert.equal(game.state.board[indexOf([4,2])].length, 1);
  assert.equal(game.state.turn, 1);
  assert.equal(game.state.moves, 1);
  invariant(game);
  game.undo(); assert.deepEqual(game.state, before);
});

test('ordinary pieces cannot pass through intervening pieces', () => {
  const game = fixture();
  const piece = put(game, '大', 0, 4, 6);
  put(game, '兵', 1, 4, 4);
  assert.ok(kinds(game, piece, 4, 5).includes('move'));
  assert.ok(kinds(game, piece, 4, 4).includes('capture'));
  assert.ok(!kinds(game, piece, 4, 3).length);
});

test('capture and stacking require enough height; marshal cannot be stacked on', () => {
  const game = fixture();
  const mover = put(game, '兵', 0, 4, 5);
  put(game, '兵', 1, 4, 4); put(game, '小', 1, 4, 4);
  assert.deepEqual(kinds(game, mover, 4, 4), []);
  put(game, '兵', 0, 4, 5);
  const taller = game.top(indexOf([4,5]));
  assert.deepEqual(kinds(game, taller, 4, 4), ['capture','stack']);
  const kingHunter = put(game, '大', 0, 8, 3);
  assert.deepEqual(kinds(game, kingHunter, 8, 0), ['capture']);
});

test('capture removes all enemies but retains friendly layers; captured pieces never enter hand', () => {
  const game = fixture();
  put(game, '兵', 0, 4, 5); put(game, '兵', 0, 4, 5);
  const mover = put(game, '小', 0, 4, 5);
  put(game, '兵', 1, 4, 4);
  const friendly = put(game, '侍', 0, 4, 4);
  put(game, '小', 1, 4, 4);
  const before = structuredClone(game.state);
  act(game, mover, 4, 4, 'capture');
  assert.deepEqual(game.state.board[indexOf([4,4])].map(p => p.id), [friendly.id, mover.id]);
  assert.equal(game.state.removed.length, 2);
  assert.deepEqual(game.state.hands, before.hands);
  invariant(game); game.undo(); assert.deepEqual(game.state, before);
});

test('cannot capture an enemy buried under a friendly top', () => {
  const game = fixture();
  put(game, '兵', 0, 4, 5);
  const mover = put(game, '兵', 0, 4, 5);
  put(game, '兵', 1, 4, 4); put(game, '小', 0, 4, 4);
  assert.deepEqual(kinds(game, mover, 4, 4), ['stack']);
});

test('stack retains enemy layers; full enemy tower replaces top and undoes exactly', () => {
  const game = fixture();
  put(game, '兵', 0, 4, 5); put(game, '兵', 0, 4, 5);
  const mover = put(game, '小', 0, 4, 5);
  put(game, '兵', 1, 4, 4); put(game, '兵', 1, 4, 4);
  const enemyTop = put(game, '小', 1, 4, 4);
  const before = structuredClone(game.state);
  act(game, mover, 4, 4, 'stack');
  assert.equal(game.state.board[indexOf([4,4])].length, 3);
  assert.equal(game.state.removed[0].id, enemyTop.id);
  assert.equal(game.state.board[indexOf([4,4])][0].owner, 1);
  invariant(game); game.undo(); assert.deepEqual(game.state, before);
  const ownTop = { ...enemyTop, owner: 0 };
  game.state.board[indexOf([4,4])][2] = ownTop;
  assert.deepEqual(kinds(game, mover, 4, 4), []);
});

test('new uses visible frontline only; ordinary new cannot go onto enemy', () => {
  const game = fixture();
  put(game, '兵', 0, 4, 4); put(game, '兵', 0, 3, 2); put(game, '兵', 1, 3, 2);
  const hand = game.state.hands[0].find(p => p.type === '槍');
  assert.ok(!kinds(game, hand, 0, 3).length);
  assert.ok(kinds(game, hand, 0, 4).includes('place'));
  assert.ok(kinds(game, hand, 4, 4).includes('stack'));
  put(game, '兵', 1, 5, 5);
  assert.ok(!kinds(game, hand, 5, 5).length);
  const spy = game.state.hands[0].find(p => p.type === '謀');
  assert.ok(kinds(game, spy, 5, 5).includes('betray'));
  const before = structuredClone(game.state);
  act(game, spy, 5, 5, 'betray');
  assert.deepEqual(game.state.board[indexOf([5,5])].map(p => p.owner), [0,0]);
  invariant(game); game.undo(); assert.deepEqual(game.state, before);
});

test('second player new cannot pass its frontline', () => {
  const game = fixture(); put(game, '兵', 1, 4, 4); game.state.turn = 1;
  const piece = game.state.hands[1].find(p => p.type === '槍');
  assert.ok(!kinds(game, piece, 0, 5).length);
  assert.ok(kinds(game, piece, 0, 4).includes('place'));
  assert.ok(kinds(game, piece, 0, 0).includes('place'));
});

test('spy betrayal requires matching reserve for every enemy, and is optional', () => {
  const game = fixture();
  put(game, '兵', 0, 4, 5);
  const spy = put(game, '謀', 0, 4, 5);
  put(game, '侍', 1, 3, 4); put(game, '侍', 1, 3, 4);
  assert.deepEqual(kinds(game, spy, 3, 4), ['capture','stack','betray']);
  const before = structuredClone(game.state);
  act(game, spy, 3, 4, 'betray');
  assert.equal(game.state.hands[0].filter(p => p.type === '侍').length, 0);
  assert.deepEqual(game.state.board[indexOf([3,4])].map(p => p.type), ['侍','侍','謀']);
  assert.ok(game.state.board[indexOf([3,4])].every(p => p.owner === 0));
  invariant(game); game.undo(); assert.deepEqual(game.state, before);
  put(game, '侍', 0, 0, 8);
  assert.deepEqual(kinds(game, spy, 3, 4), ['capture','stack']);
});

test('betrayal can replace buried enemy under friendly top', () => {
  const game = fixture(); put(game, '兵', 0, 4, 5);
  const spy = put(game, '謀', 0, 4, 5);
  put(game, '侍', 1, 3, 4); put(game, '兵', 0, 3, 4);
  assert.deepEqual(kinds(game, spy, 3, 4), ['stack','betray']);
  act(game, spy, 3, 4, 'betray');
  assert.ok(game.state.board[indexOf([3,4])].every(p => p.owner === 0));
  invariant(game);
});

test('cannon and musket jump only forward, respecting taller obstacles', () => {
  for (const [type, distance] of [['砲', 3], ['筒', 2]]) {
    const game = fixture(); const piece = put(game, type, 0, 4, 6);
    put(game, '兵', 1, 4, 5);
    assert.ok(kinds(game, piece, 4, 6 - distance).includes('move'));
    put(game, '兵', 1, 4, 5);
    assert.ok(!kinds(game, piece, 4, 6 - distance).length);
  }
  const game = fixture(); put(game, '兵', 0, 4, 6); const cannon = put(game, '砲', 0, 4, 6);
  put(game, '兵', 1, 5, 6);
  assert.ok(!kinds(game, cannon, 6, 6).length);
});

test('bow official examples: tall central obstacle blocks fan, tall side blocks that side', () => {
  const game = fixture(); const bow = put(game, '弓', 0, 4, 6);
  put(game, '兵', 1, 5, 5); put(game, '兵', 1, 5, 5);
  assert.ok(!kinds(game, bow, 5, 4).length);
  assert.ok(kinds(game, bow, 4, 4).includes('move'));
  assert.ok(kinds(game, bow, 3, 4).includes('move'));
  put(game, '兵', 1, 4, 5); put(game, '兵', 1, 4, 5);
  for (const x of [3,4,5]) assert.ok(!kinds(game, bow, x, 4).length);
});

test('capture of marshal ends game; undo restores winner, removed pieces and turns', () => {
  const game = fixture(); const piece = put(game, '大', 0, 8, 3);
  const before = structuredClone(game.state);
  act(game, piece, 8, 0, 'capture');
  assert.equal(game.state.winner, 0);
  assert.equal(game.actions(piece.id).length, 0);
  assert.throws(() => game.resign());
  invariant(game); game.undo(); assert.deepEqual(game.state, before);
  game.resign(); assert.equal(game.state.winner, 1);
  game.undo(); assert.deepEqual(game.state, before);
});

test('invalid, stale and non-integer actions never mutate the state', () => {
  const game = fixture(); const piece = put(game, '兵', 0, 4, 4);
  const before = structuredClone(game.state);
  for (const to of [-1, 81, 4.5, NaN]) assert.throws(() => game.apply({ pieceId: piece.id, to, kind: 'move' }));
  assert.throws(() => game.apply({ pieceId: 999, to: 0, kind: 'place' }));
  assert.deepEqual(game.state, before); assert.equal(game.history.length, 0);
});

test('deterministic whole games preserve all identities and undo every action', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const game = new GungiGame();
    let random = seed;
    const choose = list => { random = (random * 1664525 + 1013904223) >>> 0; return list[random % list.length]; };
    for (let i = 0; i < 80 && game.state.phase === 'setup'; i++) {
      if (i >= 20 && game.canFinishSetup) { game.declareReady(); continue; }
      const actions = game.state.hands[game.state.turn].flatMap(p => game.actions(p.id));
      game.apply(choose(actions)); invariant(game);
    }
    assert.equal(game.state.phase, 'play');
    for (let i = 0; i < 200 && game.state.winner === null; i++) {
      const choices = [...game.state.board.flat(), ...game.state.hands[game.state.turn]].flatMap(p => game.actions(p.id));
      if (!choices.length) break;
      const before = structuredClone(game.state);
      const action = choose(choices);
      game.apply(action); invariant(game);
      game.undo(); assert.deepEqual(game.state, before);
      game.apply(action);
    }
    while (game.undo()) invariant(game);
    assert.deepEqual(game.state, new GungiGame().state);
  }
});
