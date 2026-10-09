#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

chmod +x "$repo_root/.githook/pre-commit"
git -C "$repo_root" config --local core.hooksPath .githook

printf '%s\n' 'Git フックを有効化しました（core.hooksPath=.githook）。'
