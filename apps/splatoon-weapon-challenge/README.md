# Splatoon Weapon Challenge

スプラトゥーン3の全ブキキットで任意のn勝を目指すための静的アプリ。

## Features

- 目標勝利数の設定
- ブキごとの勝利数・敗北数記録
- 全部、未達成、達成済みの絞り込み
- デフォルト順、勝数順、負数順のソート
- ブキ名、サブ、スペシャルの検索
- 未達成ブキのランダム選択
- キーボードショートカットでの勝敗記録
- localStorage保存
- 進捗JSONのダウンロード / 読み込み

## Data

Build copies `../../data/splatoon3/weapons.json` and
`../../data/splatoon3/weapon-class-order.json` into `dist/data/`.

## Keyboard shortcuts

- `w`: 選択中ブキに勝ちを追加
- `l`: 選択中ブキに負けを追加
- `W`: 選択中ブキの勝ちを取り消し
- `L`: 選択中ブキの負けを取り消し
- `r` / `R`: 未達成ブキをランダム選択
- `n` / `N`: 表示中リストの先頭ブキを選択
- `j` / `J`: 表示中リストの次のブキを選択
- `k` / `K`: 表示中リストの前のブキを選択
- `/`: 検索欄にフォーカス
- `?`: ヘルプを開閉
- `Esc`: フォーカス解除
