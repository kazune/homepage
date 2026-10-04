SHELL := /bin/sh
ROOT_DIR := ../..
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
PNPM ?= pnpm
TSC ?= $(PNPM) --dir $(abspath $(ROOT_DIR)) exec tsc

.PHONY: build test clean
build: $(DIST_DIR)/index.html $(ASSETS_DIR)/style.css $(ASSETS_DIR)/main.js

$(DIST_DIR) $(ASSETS_DIR):
	mkdir -p $@

$(DIST_DIR)/index.html: src/index.html | $(DIST_DIR)
	cp $< $@

$(ASSETS_DIR)/style.css: src/style.css | $(ASSETS_DIR)
	cp $< $@

$(ASSETS_DIR)/main.js: $(wildcard src/*.ts src/games/*.ts) $(ROOT_DIR)/package.json $(ROOT_DIR)/pnpm-lock.yaml | $(ASSETS_DIR)
	$(TSC) --target ES2020 --module ES2020 --strict --skipLibCheck --outDir $(abspath $(ASSETS_DIR)) $(abspath src/main.ts)

test:
	$(TSC) --target ES2020 --module commonjs --strict --skipLibCheck --outDir $(abspath tests/build) $(abspath src/game.ts src/games/chu-shogi.ts src/games/dai-shogi.ts src/games/taikyoku-shogi.ts)
	node --test tests/*.test.cjs

clean:
	rm -rf $(DIST_DIR)
