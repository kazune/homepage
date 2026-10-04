const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game } = require('./build/game.js');
const { taikyokuShogi } = require('./build/games/taikyoku-shogi.js');
const { taikyokuData } = require('./build/games/taikyoku-data.js');

function empty(owner = 0) {
  const game = new Game(false, taikyokuShogi);
  game.addPiece('K', 0, [0, 35]);
  game.addPiece('K', 1, [35, 0]);
  game.turn = owner;
  return game;
}
const positions = (game, piece) => game.candidates(piece).map(p => p.join(','));

test('Taikyoku setup has 804 pieces, 209 initial types, rotated camps and both royals', () => {
  const game = new Game(true, taikyokuShogi);
  assert.equal(game.width, 36);
  assert.equal(game.height, 36);
  assert.equal(game.pieces.size, 804);
  assert.equal(new Set([...game.pieces.values()].map(p => p.type)).size, 209);
  for (const owner of [0, 1]) {
    assert.equal([...game.pieces.values()].filter(p => p.owner === owner).length, 402);
    assert.equal([...game.pieces.values()].filter(p => p.owner === owner && game.pieceTypeOf(p).royal).length, 2);
    assert.equal([...game.pieces.values()].filter(p => p.owner === owner && p.type === 'P').length, 36);
  }
  assert.equal(game.pieceAt([17, 35]).type, 'K');
  assert.equal(game.pieceAt([18, 35]).type, 'CP');
  assert.equal(game.pieceAt([15, 30]).type, 'KR');
  assert.equal(game.pieceAt([20, 30]).type, 'PH');
  assert.equal(game.pieceAt([18, 28]).type, 'FE');
  for (const piece of game.pieces.values()) if (piece.owner === 0) {
    const [x, y] = game.locations.get(piece.id).position;
    const opposite = game.pieceAt([35 - x, 35 - y]);
    assert.equal(opposite.owner, 1);
    assert.equal(opposite.type, piece.type);
    assert.doesNotThrow(() => game.candidates(piece));
  }
  for (let y = 12; y <= 23; y++) for (let x = 0; x < 36; x++) assert.equal(game.pieceAt([x, y]), null);
  assert.equal(game.pieceAt([36, 0]), undefined);
});

test('every base and promoted definition has candidates for both owners and valid promotion targets', () => {
  for (const [id, type] of Object.entries(taikyokuShogi.pieceTypes)) {
    assert(type.sequences.length > 0, id);
    if (type.promoteTo) assert(taikyokuShogi.pieceTypes[type.promoteTo], id);
    for (const owner of [0, 1]) {
      const game = empty(owner);
      const piece = game.addPiece(id, owner, [18, 18]);
      const choices = positions(game, piece);
      assert(choices.length > 0, id);
      assert.equal(choices.length, new Set(choices).size, id);
    }
  }
  assert.equal(taikyokuData.length, 301);
});

test('same-named king, kirin, flying dragon and lion dog use Taikyoku movements', () => {
  for (const [id, included, excluded] of [
    ['K', [18, 16], [18, 15]], // two-square king, not a leap
    ['KR', [18, 17], [18, 16]], // forward step, side leap
    ['FLD', [20, 16], [19, 17]], // diagonal leap, not Dai limited range
    ['LD', [18, 12], [19, 16]], // queen plus three-square leaps
  ]) {
    const game = empty();
    const piece = game.addPiece(id, 0, [18, 18]);
    const choices = positions(game, piece);
    assert(choices.includes(included.join(',')), id);
    assert(!choices.includes(excluded.join(',')), id);
  }
  const game = empty();
  const king = game.addPiece('K', 0, [18, 18]);
  game.addPiece('P', 0, [18, 17]);
  assert(!positions(game, king).includes('18,16'));
});

test('hook turns perpendicular, may stop early and cannot continue after capturing its pivot', () => {
  for (const [id, pivot, onward, forbidden] of [
    ['HM', [18, 15], [22, 15], [18, 14]],
    ['T', [15, 15], [13, 17], [14, 14]],
    ['C', [15, 15], [13, 17], [14, 14]],
  ]) {
    const game = empty();
    const mover = game.addPiece(id, 0, [18, 18]);
    game.move(mover.id, pivot);
    assert.equal(game.canEndTurn, true);
    assert(positions(game, mover).includes(onward.join(',')));
    assert(!positions(game, mover).includes(forbidden.join(',')));
    game.move(mover.id, onward);
    assert.equal(game.history.length, 1);
    game.undo();
    const victim = game.addPiece('P', 1, pivot);
    game.move(mover.id, pivot);
    assert.equal(game.activePiece, null);
    assert.equal(game.history.length, 1);
    assert.equal(game.locations.get(victim.id).kind, 'void');
    game.undo();
    assert.equal(game.pieceAt(pivot).id, victim.id);
  }
});

test('range capture removes lower-ranked allies and enemies, stops at equal or higher rank and undoes all effects', () => {
  const game = empty();
  const general = game.addPiece('GG', 0, [18, 18]);
  const ally = game.addPiece('P', 0, [18, 17]);
  const enemy = game.addPiece('VG', 1, [18, 16]);
  const peer = game.addPiece('GG', 1, [18, 14]);
  const royal = game.addPiece('CP', 1, [21, 18]);
  assert(positions(game, general).includes('18,15'));
  assert(!positions(game, general).includes('18,14'));
  assert(!positions(game, general).includes('18,13'));
  assert(!positions(game, general).includes('21,18'));
  game.move(general.id, [18, 15]);
  assert.equal(game.locations.get(ally.id).kind, 'void');
  assert.equal(game.locations.get(enemy.id).kind, 'void');
  assert.equal(game.locations.get(peer.id).kind, 'board');
  assert.equal(game.locations.get(royal.id).kind, 'board');
  assert([...game.locations.values()].every(l => l.kind !== 'hand'));
  assert.equal(game.history[0].transfers.length, 3);
  game.undo();
  assert.equal(game.pieceAt([18, 17]).id, ally.id);
  assert.equal(game.pieceAt([18, 16]).id, enemy.id);
  assert.equal(game.pieceAt([18, 18]).id, general.id);
});

test('capturing generals respect their direction and hierarchy; promoted forms inherit rank', () => {
  for (const [moverType, targetType, allowed] of [
    ['VG', 'FLG', true], ['VG', 'GG', false], ['AG', 'P', true], ['AG', 'FLG', false],
    ['promoted-FK', 'VG', true], // free king promotes to rank-3 great general
  ]) {
    const game = empty();
    const mover = game.addPiece(moverType, 0, [18, 18]);
    game.addPiece(targetType, 1, [17, 17]);
    assert.equal(positions(game, mover).includes('16,16'), allowed, `${moverType}/${targetType}`);
  }
  const game = empty();
  const vice = game.addPiece('VG', 0, [18, 18]);
  game.addPiece('P', 0, [18, 17]);
  assert(positions(game, vice).includes('18,16')); // ordinary orthogonal jump
  assert(!positions(game, vice).includes('18,15'));
});

test('skip-three counts pieces rather than squares, never captures pass-throughs and does not leak between directions', () => {
  for (const owner of [0, 1]) {
    const game = empty(owner);
    const rotate = ([x, y]) => owner === 0 ? [x, y] : [35 - x, 35 - y];
    const mover = game.addPiece('KT', owner, rotate([18, 20]));
    const victims = [[18, 19], [18, 17], [18, 14], [18, 12]].map((p, i) => game.addPiece('P', i % 2, rotate(p)));
    const choices = positions(game, mover);
    assert(choices.includes(rotate([18, 13]).join(',')));
    assert(!choices.includes(rotate([18, 11]).join(',')));
    assert(choices.includes(rotate([30, 20]).join(',')));
    game.move(mover.id, rotate([18, 13]));
    for (const piece of victims) assert.equal(game.locations.get(piece.id).kind, 'board');
    game.undo();
    assert.equal(game.pieceAt(rotate([18, 20])).id, mover.id);
  }
});

test('jump-then-slide may pass blockers, keeps direction, and requires an empty pivot to continue', () => {
  const game = empty();
  const bird = game.addPiece('GE', 0, [18, 18]);
  const blocker = game.addPiece('P', 0, [19, 17]);
  game.move(bird.id, [20, 16]);
  assert.equal(game.canEndTurn, true);
  assert(positions(game, bird).includes('23,13'));
  assert(!positions(game, bird).includes('17,13'));
  game.move(bird.id, [23, 13]);
  assert.equal(game.locations.get(blocker.id).kind, 'board');
  game.undo();
  const victim = game.addPiece('P', 1, [20, 16]);
  game.move(bird.id, [20, 16]);
  assert.equal(game.activePiece, null);
  assert.equal(game.locations.get(victim.id).kind, 'void');
});

test('free eagle jump and full three-capture sweep coexist without same-stage ambiguity', () => {
  const game = empty();
  const eagle = game.addPiece('FE', 0, [18, 18]);
  const victims = [17, 16, 15].map(y => game.addPiece('P', 1, [18, y]));
  assert.doesNotThrow(() => game.candidates(eagle));
  game.move(eagle.id, [18, 15]); // direct jump captures only the destination
  assert.equal(game.activePiece, null);
  assert.equal(game.locations.get(victims[0].id).kind, 'board');
  assert.equal(game.locations.get(victims[1].id).kind, 'board');
  assert.equal(game.locations.get(victims[2].id).kind, 'void');
  game.undo();
  game.move(eagle.id, [18, 17]);
  assert.equal(game.canEndTurn, true); // ordinary one-square capture or igui
  game.move(eagle.id, [18, 16]);
  assert.equal(game.canEndTurn, false);
  assert.throws(() => game.endTurn());
  game.move(eagle.id, [18, 15]);
  assert.equal(game.canEndTurn, true);
  game.endTurn();
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].transfers.length, 6);
  for (const victim of victims) assert.equal(game.locations.get(victim.id).kind, 'void');
  game.undo();
  for (const victim of victims) assert.equal(game.locations.get(victim.id).kind, 'board');
  assert.equal(game.pieceAt([18, 18]).id, eagle.id);
});

test('free eagle forward diagonals require four sweep stages, then may slide; capture chains never turn', () => {
  for (const owner of [0, 1]) {
    const game = empty(owner);
    const rotate = ([x, y]) => owner === 0 ? [x, y] : [35 - x, 35 - y];
    const eagle = game.addPiece('FE', owner, rotate([18, 18]));
    const victims = [1, 2, 3, 4].map(i => game.addPiece('P', 1 - owner, rotate([18 + i, 18 - i])));
    for (let i = 1; i <= 4; i++) {
      game.move(eagle.id, rotate([18 + i, 18 - i]));
      if (i === 2 || i === 3) assert.equal(game.canEndTurn, false);
    }
    assert.equal(game.canEndTurn, true);
    assert(!positions(game, eagle).includes(rotate([23, 15]).join(',')));
    game.move(eagle.id, rotate([24, 12]));
    assert.equal(game.pending, null);
    assert.equal(game.history.length, 1);
    for (const victim of victims) assert.equal(game.locations.get(victim.id).kind, 'void');
    game.undo();
    assert.equal(game.pieceAt(rotate([18, 18])).id, eagle.id);
  }
});

test('free eagle igui and jitto return to origin, and a blocked unfinished sweep can be undone', () => {
  const game = empty();
  const eagle = game.addPiece('FE', 0, [18, 18]);
  const victim = game.addPiece('P', 1, [18, 17]);
  game.move(eagle.id, [18, 17]);
  game.move(eagle.id, [18, 18]);
  assert.equal(game.locations.get(victim.id).kind, 'void');
  game.undo();
  game.move(eagle.id, [19, 18]); game.move(eagle.id, [18, 18]);
  assert.equal(game.history.length, 1);
  game.undo();
  game.addPiece('P', 0, [18, 15]);
  game.move(eagle.id, [18, 17]); game.move(eagle.id, [18, 16]);
  assert.equal(game.canEndTurn, false);
  assert.deepEqual(game.candidates(eagle), []);
  game.undo();
  assert.equal(game.pieceAt([18, 18]).id, eagle.id);
  assert.equal(game.pieceAt([18, 17]).id, victim.id);
});

test('promotion is optional throughout the enemy eleven ranks, works in both directions and undoes with capture', () => {
  for (const owner of [0, 1]) {
    const game = empty(owner);
    const rotate = ([x, y]) => owner === 0 ? [x, y] : [35 - x, 35 - y];
    const pawn = game.addPiece('P', owner, rotate([18, 11]));
    assert.equal(game.move(pawn.id, rotate([18, 10])), true);
    game.completePromotion(pawn.id, false);
    assert.equal(game.pieceAt(rotate([18, 10])).id, pawn.id);
    game.turn = owner;
    const victim = game.addPiece('P', 1 - owner, rotate([18, 9]));
    assert.equal(game.move(pawn.id, rotate([18, 9])), true);
    game.completePromotion(pawn.id, true);
    const promoted = game.pieceAt(rotate([18, 9]));
    assert.equal(game.pieceTypeOf(promoted).name, '金将');
    assert.equal(game.pieceTypeOf(promoted).promoteTo, undefined);
    game.undo();
    assert.equal(game.pieceAt(rotate([18, 10])).id, pawn.id);
    assert.equal(game.pieceAt(rotate([18, 9])).id, victim.id);
    assert.equal(game.locations.get(promoted.id).kind, 'void');
  }
});

test('declining last-rank promotion is allowed; king and prince must both be captured to end play', () => {
  const game = empty();
  const pawn = game.addPiece('P', 0, [18, 1]);
  game.move(pawn.id, [18, 0]); game.completePromotion(pawn.id, false);
  assert.equal(game.violation, null);
  game.undo();
  const prince = game.addPiece('CP', 1, [18, 18]);
  const rook = game.addPiece('FCH', 0, [35, 12]);
  game.move(rook.id, [35, 0]); game.completePromotion(rook.id, false);
  assert.equal(game.outcome, null);
  game.turn = 0;
  const attacker = game.addPiece('FCH', 0, [18, 20]);
  game.move(attacker.id, [18, 18]);
  assert.equal(game.outcome, 0);
  game.undo();
  assert.equal(game.outcome, null);
  assert.equal(game.pieceAt([18, 18]).id, prince.id);
});
