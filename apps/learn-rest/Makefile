SHELL := /bin/sh

ROOT_DIR := ../..
SRC_DIR := src
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
PANDOC ?= pandoc
PNPM ?= pnpm
TSC ?= $(PNPM) --dir $(abspath $(ROOT_DIR)) exec tsc
TOOLCHAIN_FILES := $(ROOT_DIR)/package.json $(ROOT_DIR)/pnpm-lock.yaml

CONTENT_SRC := $(SRC_DIR)/content.md
TEMPLATE_SRC := $(SRC_DIR)/template.html
CSS_SRC := $(SRC_DIR)/style.css
TS_SRC := $(SRC_DIR)/api.ts $(SRC_DIR)/main.ts
OPENAPI_SRC := $(SRC_DIR)/openapi.yaml
INCLUDE_CODE_FILTER := $(SRC_DIR)/include-code.lua

HTML_OUT := $(DIST_DIR)/index.html
CSS_OUT := $(ASSETS_DIR)/style.css
JS_OUT := $(ASSETS_DIR)/main.js
API_JS_OUT := $(ASSETS_DIR)/api.js

.PHONY: all build test clean check-tools

all: build

build: check-tools $(HTML_OUT) $(CSS_OUT) $(API_JS_OUT) $(JS_OUT)

test: build
	$(PNPM) exec node --test tests/*.test.mjs

check-tools:
	@command -v $(PANDOC) >/dev/null 2>&1 || { echo "error: pandoc is required"; exit 1; }
	@command -v $(PNPM) >/dev/null 2>&1 || { echo "error: pnpm is required"; exit 1; }
	@$(PNPM) exec node --version >/dev/null 2>&1 || { echo "error: Node.js is required"; exit 1; }
	@$(TSC) --version >/dev/null 2>&1 || { echo "error: TypeScript compiler not found; run pnpm install"; exit 1; }

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

$(ASSETS_DIR):
	mkdir -p $(ASSETS_DIR)

$(HTML_OUT): $(CONTENT_SRC) $(TEMPLATE_SRC) $(OPENAPI_SRC) $(INCLUDE_CODE_FILTER) | $(DIST_DIR)
	$(PANDOC) $(CONTENT_SRC) \
		--from markdown \
		--to html5 \
		--standalone \
		--toc \
		--toc-depth=2 \
		--section-divs \
		--mathml \
		--lua-filter $(INCLUDE_CODE_FILTER) \
		--template $(TEMPLATE_SRC) \
		--output $(HTML_OUT)

$(CSS_OUT): $(CSS_SRC) | $(ASSETS_DIR)
	cp $(CSS_SRC) $(CSS_OUT)

$(API_JS_OUT) $(JS_OUT): $(TS_SRC) $(TOOLCHAIN_FILES) | $(ASSETS_DIR)
	$(TSC) --target ES2020 --module ES2020 --strict --skipLibCheck --outDir $(abspath $(ASSETS_DIR)) $(addprefix $(CURDIR)/,$(TS_SRC))

clean:
	rm -rf $(DIST_DIR)
