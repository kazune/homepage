import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeList, encodeList, validateList } from '../dist/assets/data.js';

test('共有URLから日本語・記号・クエリ・フラグメントを復元できる', () => {
  const list = { title: '通勤 & 日常 📚', links: [
    { name: 'バスの接近情報', url: 'https://transfer-cloud.navitime.biz/5931bus/approachings?departure-busstop=00020904&arrival-busstop=00020643' },
    { name: '<天気> / "地図"', url: 'https://example.com/?q=%E6%97%A5%E6%9C%AC&x=a%26b#today' },
  ] };
  const shared = new URL(`https://example.com/apps/bookmark-list/${encodeList(list)}`);
  assert.deepEqual(decodeList(shared.hash), list);
});

test('空白を除去してHTTP(S)のURLを正規化する', () => {
  assert.deepEqual(validateList({ title: ' 一覧 ', links: [{ name: ' 名前 ', url: ' https://example.com ' }] }), { title: '一覧', links: [{ name: '名前', url: 'https://example.com/' }] });
});

test('共有リンク経由でも実行可能なスキームを受け付けない', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', '//example.com']) {
    const hash = `#v1=${encodeURIComponent(JSON.stringify({ title: 'test', links: [{ name: 'test', url }] }))}`;
    assert.throws(() => decodeList(hash));
  }
});

test('壊れた共有リンクと不正な構造を拒否する', () => {
  for (const hash of ['#v2=123', '#v1=%', '#v1=not-json', '#v1=null']) assert.throws(() => decodeList(hash));
  for (const value of [null, {}, { title: '', links: [] }, { title: 'test', links: [] }, { title: 'test', links: [null] }, { title: 'test', links: [{ name: ' ', url: 'https://example.com/' }] }]) assert.throws(() => validateList(value));
});
