SHELL := /bin/sh

ROOT_DIR := ../..
SRC_DIR := src
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
TSC ?= $(ROOT_DIR)/node_modules/.bin/tsc

.PHONY: all build clean

all: build

build: $(DIST_DIR)/index.html $(ASSETS_DIR)/style.css $(ASSETS_DIR)/main.js

$(DIST_DIR) $(ASSETS_DIR):
	mkdir -p $@

$(DIST_DIR)/index.html: $(SRC_DIR)/index.html | $(DIST_DIR)
	cp $< $@

$(ASSETS_DIR)/style.css: $(SRC_DIR)/style.css | $(ASSETS_DIR)
	cp $< $@

$(ASSETS_DIR)/main.js: $(SRC_DIR)/main.ts | $(ASSETS_DIR)
	$(TSC) --target ES2020 --module ES2020 --strict --skipLibCheck --outDir $(ASSETS_DIR) $<

clean:
	rm -rf $(DIST_DIR)
