SHELL := /bin/sh

ROOT_DIR := ../..
SRC_DIR := src
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
PNPM ?= pnpm
TSC ?= $(PNPM) --dir $(abspath $(ROOT_DIR)) exec tsc
TOOLCHAIN_FILES := $(ROOT_DIR)/package.json $(ROOT_DIR)/pnpm-lock.yaml

.PHONY: all build clean

all: build

build: $(DIST_DIR)/index.html $(ASSETS_DIR)/style.css $(ASSETS_DIR)/main.js

$(DIST_DIR) $(ASSETS_DIR):
	mkdir -p $@

$(DIST_DIR)/index.html: $(SRC_DIR)/index.html | $(DIST_DIR)
	cp $< $@

$(ASSETS_DIR)/style.css: $(SRC_DIR)/style.css | $(ASSETS_DIR)
	cp $< $@

$(ASSETS_DIR)/main.js: $(SRC_DIR)/main.ts $(TOOLCHAIN_FILES) | $(ASSETS_DIR)
	$(TSC) --target ES2020 --module ES2020 --strict --skipLibCheck --outDir $(abspath $(ASSETS_DIR)) $(abspath $<)

clean:
	rm -rf $(DIST_DIR)
