SHELL := /bin/sh

ROOT_DIR := ../..
SRC_DIR := src
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
TSC ?= $(ROOT_DIR)/node_modules/.bin/tsc

TS_SRC := $(SRC_DIR)/main.ts
HTML_SRC := $(SRC_DIR)/index.html
CSS_SRC := $(SRC_DIR)/style.css

JS_OUT := $(ASSETS_DIR)/main.js
HTML_OUT := $(DIST_DIR)/index.html
CSS_OUT := $(ASSETS_DIR)/style.css

.PHONY: all build clean

all: build

build: $(HTML_OUT) $(CSS_OUT) $(JS_OUT)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

$(ASSETS_DIR):
	mkdir -p $(ASSETS_DIR)

$(HTML_OUT): $(HTML_SRC) | $(DIST_DIR)
	cp $(HTML_SRC) $(HTML_OUT)

$(CSS_OUT): $(CSS_SRC) | $(ASSETS_DIR)
	cp $(CSS_SRC) $(CSS_OUT)

$(JS_OUT): $(TS_SRC) | $(ASSETS_DIR)
	$(TSC) --target ES2020 --module ES2020 --strict --skipLibCheck --outDir $(ASSETS_DIR) $(TS_SRC)

clean:
	rm -rf $(DIST_DIR)
