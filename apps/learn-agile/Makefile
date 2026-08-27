SHELL := /bin/sh

SRC_DIR := src
DIST_DIR := dist
ASSETS_DIR := $(DIST_DIR)/assets
PANDOC ?= pandoc

CONTENT_SRC := $(SRC_DIR)/content.md
TEMPLATE_SRC := $(SRC_DIR)/template.html
START_CONTENT_SRC := $(SRC_DIR)/start.md
START_TEMPLATE_SRC := $(SRC_DIR)/start-template.html
CSS_SRC := $(SRC_DIR)/style.css

HTML_OUT := $(DIST_DIR)/index.html
START_HTML_OUT := $(DIST_DIR)/start/index.html
CSS_OUT := $(ASSETS_DIR)/style.css

.PHONY: all build clean check-tools

all: build

build: check-tools $(HTML_OUT) $(START_HTML_OUT) $(CSS_OUT)

check-tools:
	@command -v $(PANDOC) >/dev/null 2>&1 || { echo "error: pandoc is required"; exit 1; }

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

$(ASSETS_DIR):
	mkdir -p $(ASSETS_DIR)

$(DIST_DIR)/start:
	mkdir -p $(DIST_DIR)/start

$(HTML_OUT): $(CONTENT_SRC) $(TEMPLATE_SRC) | $(DIST_DIR)
	$(PANDOC) $(CONTENT_SRC) \
		--from markdown \
		--to html5 \
		--standalone \
		--toc \
		--toc-depth=2 \
		--section-divs \
		--template $(TEMPLATE_SRC) \
		--output $(HTML_OUT)

$(START_HTML_OUT): $(START_CONTENT_SRC) $(START_TEMPLATE_SRC) | $(DIST_DIR)/start
	$(PANDOC) $(START_CONTENT_SRC) \
		--from markdown \
		--to html5 \
		--standalone \
		--toc \
		--toc-depth=2 \
		--section-divs \
		--template $(START_TEMPLATE_SRC) \
		--output $(START_HTML_OUT)

$(CSS_OUT): $(CSS_SRC) | $(ASSETS_DIR)
	cp $(CSS_SRC) $(CSS_OUT)

clean:
	rm -rf $(DIST_DIR)
