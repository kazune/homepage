import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DataSizeError, decodeList, encodeList, prepareListForSave, validateList } from '../dist/assets/data.js';

const savedAt = '2026-10-19T01:23:45.000Z';
const later = new Date('2026-10-20T02:34:56.000Z');

test('100KBちょうどのUTF-8 JSONは保存・読み込みでき、1バイト超過は拒否する', async () => {
  const base = { title: '日本語📚', updatedAt: savedAt, links: [{ name: 'x', url: 'https://example.com/' }] };
  const padding = 102400 - Buffer.byteLength(JSON.stringify(base));
  const boundary = { ...base, title: base.title + 'a'.repeat(padding) };
  const oversized = { ...boundary, title: boundary.title + 'a' };
  assert.equal(Buffer.byteLength(JSON.stringify(boundary)), 102400);
  for (const format of ['v1', 'v2', 'auto']) {
    assert.deepEqual(await decodeList(await encodeList(boundary, format)), boundary);
    await assert.rejects(encodeList(oversized, format), DataSizeError);
  }
  const json = JSON.stringify(oversized);
  await assert.rejects(decodeList(`#v1=${encodeURIComponent(json)}`), DataSizeError);
  await assert.rejects(decodeList(`#v2=${gzipSync(json).toString('base64url')}`), DataSizeError);
});

test('高圧縮データは解凍途中のサイズ超過を拒否する', async () => {
  const json = JSON.stringify({ title: 'あ'.repeat(1000000), updatedAt: savedAt, links: [{ name: 'test', url: 'https://example.com/' }] });
  await assert.rejects(decodeList(`#v2=${gzipSync(json).toString('base64url')}`), DataSizeError);
});

test('共有URLから日本語・記号・クエリ・フラグメントを両形式で復元できる', async () => {
  const list = { title: '通勤 & 日常 📚', updatedAt: savedAt, links: [
    { name: 'バスの接近情報', url: 'https://transfer-cloud.navitime.biz/5931bus/approachings?departure-busstop=00020904&arrival-busstop=00020643' },
    { name: '<天気> / "地図"', url: 'https://example.com/?q=%E6%97%A5%E6%9C%AC&x=a%26b#today' },
  ] };
  for (const format of ['v1', 'v2', 'auto']) {
    const shared = new URL(`https://example.com/apps/bookmark-list/${await encodeList(list, format)}`);
    assert.deepEqual(await decodeList(shared.hash), list);
    if (format !== 'auto') assert.ok(shared.hash.startsWith(`#${format}=`));
  }
});

test('空白を除去してHTTP(S)のURLを正規化する', () => {
  assert.deepEqual(validateList({ title: ' 一覧 ', updatedAt: savedAt, links: [{ name: ' 名前 ', url: ' https://example.com ' }] }), { title: '一覧', updatedAt: savedAt, links: [{ name: '名前', url: 'https://example.com/' }] });
});

test('共有リンク経由でも実行可能なスキームを両形式で受け付けない', async () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', '//example.com']) {
    const json = JSON.stringify({ title: 'test', updatedAt: savedAt, links: [{ name: 'test', url }] });
    await assert.rejects(decodeList(`#v1=${encodeURIComponent(json)}`));
    await assert.rejects(decodeList(`#v2=${gzipSync(json).toString('base64url')}`));
  }
});

test('壊れた共有リンクと不正な構造を拒否する', async () => {
  for (const hash of ['#v3=123', '#v1=%', '#v1=not-json', '#v1=null', '#v2=', '#v2=123', '#v2=abc+/', '#v2=a']) await assert.rejects(decodeList(hash));
  for (const value of [null, {}, { title: '', links: [] }, { title: 'test', links: [] }, { title: 'test', links: [null] }, { title: 'test', links: [{ name: ' ', url: 'https://example.com/' }] }]) assert.throws(() => validateList(value));
});

const sample = { title: 'よく見るページ', updatedAt: savedAt, links: Array.from({ length: 8 }, (_, i) => ({ name: `ページ ${i + 1}`, url: `https://example.com/pages/${i + 1}?q=bookmark` })) };

test('v2は標準gzipとして相互に復元できる', async () => {
  const hash = await encodeList(sample, 'v2');
  assert.match(hash, /^#v2=[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(hash.slice(4), 'base64url')).toString('utf8')), sample);
  const externalHash = `#v2=${gzipSync(JSON.stringify(sample)).toString('base64url')}`;
  assert.deepEqual(await decodeList(externalHash), sample);
  const truncated = `#v2=${gzipSync(JSON.stringify(sample)).subarray(0, 20).toString('base64url')}`;
  await assert.rejects(decodeList(truncated));
});

test('自動（省略時も含む）は最終的なフラグメントが短い形式を選ぶ', async () => {
  const v1 = await encodeList(sample, 'v1');
  const v2 = await encodeList(sample, 'v2');
  const expected = v2.length < v1.length ? v2 : v1;
  assert.equal(await encodeList(sample, 'auto'), expected);
  assert.equal(await encodeList(sample), expected);
  assert.ok(v2.length < v1.length);
});

test('圧縮非対応では自動はv1、明示的なv2はエラーになる', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'CompressionStream');
  try {
    Object.defineProperty(globalThis, 'CompressionStream', { configurable: true, value: undefined });
    const v1 = await encodeList(sample, 'v1');
    assert.equal(await encodeList(sample), v1);
    assert.deepEqual(await decodeList(v1), sample);
    await assert.rejects(encodeList(sample, 'v2'), /対応していません/);
  } finally {
    Object.defineProperty(globalThis, 'CompressionStream', descriptor);
  }
});

test('解凍非対応ではv2の読み込み時に理由を伝える', async () => {
  const hash = await encodeList(sample, 'v2');
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream');
  try {
    Object.defineProperty(globalThis, 'DecompressionStream', { configurable: true, value: undefined });
    await assert.rejects(decodeList(hash), /対応していません/);
    assert.equal(await encodeList(sample), await encodeList(sample, 'v1'));
  } finally {
    Object.defineProperty(globalThis, 'DecompressionStream', descriptor);
  }
});

test('新規保存は日時を付け、v1・v2・自動で同じ日時を復元できる', async () => {
  const saved = prepareListForSave(sample, null, new Date(savedAt));
  assert.equal(saved.updatedAt, savedAt);
  for (const format of ['v1', 'v2', 'auto']) {
    assert.deepEqual(await decodeList(await encodeList(saved, format)), saved);
  }
});

test('内容が同じなら保存形式を変えても最終更新日時を保持する', async () => {
  const saved = { ...sample, updatedAt: savedAt };
  const draft = { title: ` ${sample.title} `, links: sample.links };
  const next = prepareListForSave(draft, saved, later);
  assert.equal(next.updatedAt, savedAt);
  for (const format of ['v1', 'v2', 'auto']) {
    const restored = await decodeList(await encodeList(next, format));
    assert.equal(restored.updatedAt, savedAt);
  }
});

test('一覧名・リンク名・URL・追加・削除・順序の変更で日時を更新する', () => {
  const saved = { ...sample, updatedAt: savedAt };
  const edits = [
    { ...sample, title: '新しい名前' },
    { ...sample, links: sample.links.map((link, i) => i ? link : { ...link, name: '変更後' }) },
    { ...sample, links: sample.links.map((link, i) => i ? link : { ...link, url: 'https://example.org/' }) },
    { ...sample, links: [...sample.links, { name: '追加', url: 'https://example.org/' }] },
    { ...sample, links: sample.links.slice(1) },
    { ...sample, links: [...sample.links].reverse() },
  ];
  for (const draft of edits) {
    assert.equal(prepareListForSave(draft, saved, later).updatedAt, later.toISOString());
  }
  assert.equal(saved.updatedAt, savedAt);
});

test('日時のないデータは両形式で拒否し、新規保存時には日時を必ず追加する', async () => {
  const draft = { title: sample.title, links: sample.links };
  assert.throws(() => validateList(draft), /最終更新日時/);
  await assert.rejects(encodeList(draft), /最終更新日時/);
  const json = JSON.stringify(draft);
  await assert.rejects(decodeList(`#v1=${encodeURIComponent(json)}`), /最終更新日時/);
  await assert.rejects(decodeList(`#v2=${gzipSync(json).toString('base64url')}`), /最終更新日時/);
  assert.equal(prepareListForSave(draft, null, later).updatedAt, later.toISOString());
});

test('最終更新日時は正しいUTCのISO形式だけを受け付ける', () => {
  for (const updatedAt of ['', null, 123, 'yesterday', '2026-02-30T00:00:00.000Z', '2026-10-19T99:00:00.000Z']) {
    assert.throws(() => validateList({ ...sample, updatedAt }), /最終更新日時/);
  }
});
