SHELL := /bin/sh

ROOT_DIR := ../..
SRC_DIR := src
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
DATA_DIR := $(DIST_DIR)/data
TSC ?= $(ROOT_DIR)/node_modules/.bin/tsc

TS_SRC := $(SRC_DIR)/main.ts
HTML_SRC := $(SRC_DIR)/index.html
CSS_SRC := $(SRC_DIR)/style.css
WEAPONS_SRC := $(ROOT_DIR)/data/splatoon3/weapons.json
WEAPON_CLASS_ORDER_SRC := $(ROOT_DIR)/data/splatoon3/weapon-class-order.json

JS_OUT := $(ASSETS_DIR)/main.js
HTML_OUT := $(DIST_DIR)/index.html
CSS_OUT := $(ASSETS_DIR)/style.css
WEAPONS_OUT := $(DATA_DIR)/weapons.json
WEAPON_CLASS_ORDER_OUT := $(DATA_DIR)/weapon-class-order.json

.PHONY: all build clean

all: build

build: $(HTML_OUT) $(CSS_OUT) $(JS_OUT) $(WEAPONS_OUT) $(WEAPON_CLASS_ORDER_OUT)

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

$(ASSETS_DIR):
	mkdir -p $(ASSETS_DIR)

$(DATA_DIR):
	mkdir -p $(DATA_DIR)

$(HTML_OUT): $(HTML_SRC) | $(DIST_DIR)
	cp $(HTML_SRC) $(HTML_OUT)

$(CSS_OUT): $(CSS_SRC) | $(ASSETS_DIR)
	cp $(CSS_SRC) $(CSS_OUT)

$(JS_OUT): $(TS_SRC) | $(ASSETS_DIR)
	$(TSC) --target ES2020 --module ES2020 --strict --skipLibCheck --outDir $(ASSETS_DIR) $(TS_SRC)

$(WEAPONS_OUT): $(WEAPONS_SRC) | $(DATA_DIR)
	cp $(WEAPONS_SRC) $(WEAPONS_OUT)

$(WEAPON_CLASS_ORDER_OUT): $(WEAPON_CLASS_ORDER_SRC) | $(DATA_DIR)
	cp $(WEAPON_CLASS_ORDER_SRC) $(WEAPON_CLASS_ORDER_OUT)

clean:
	rm -rf $(DIST_DIR)
