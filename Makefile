SHELL := /bin/sh

APPS_DIR := apps
ROOT_DIST_DIR := dist
ROOT_DIST_APPS_DIR := $(ROOT_DIST_DIR)/apps
DEPLOY_BASE ?= /var/www/homepage
RELEASES_DIR := $(DEPLOY_BASE)/releases
RELEASE_ID := $(or $(RELEASE_ID),$(shell date +%Y%m%d-%H%M%S))
RELEASE_DIR := $(RELEASES_DIR)/$(RELEASE_ID)
CURRENT_LINK := $(DEPLOY_BASE)/current
PNPM ?= pnpm

APP_NAMES := $(filter-out _template,$(patsubst $(APPS_DIR)/%/app.json,%,$(wildcard $(APPS_DIR)/*/app.json)))

.PHONY: all dist build-apps collect apps-index deploy clean list-apps

all: dist

dist: build-apps collect apps-index

list-apps:
	@printf '%s\n' $(APP_NAMES)

build-apps:
	@set -e; \
	for app in $(APP_NAMES); do \
		if [ -f "$(APPS_DIR)/$$app/Makefile" ]; then \
			$(MAKE) -C "$(APPS_DIR)/$$app" build; \
		else \
			echo "skip: $(APPS_DIR)/$$app/Makefile not found"; \
		fi; \
	done

collect:
	@set -e; \
	mkdir -p "$(ROOT_DIST_APPS_DIR)"; \
	for app in $(APP_NAMES); do \
		if [ -d "$(APPS_DIR)/$$app/dist" ]; then \
			rm -rf "$(ROOT_DIST_APPS_DIR)/$$app"; \
			mkdir -p "$(ROOT_DIST_APPS_DIR)/$$app"; \
			cp -R "$(APPS_DIR)/$$app/dist/." "$(ROOT_DIST_APPS_DIR)/$$app/"; \
			echo "collected: $(APPS_DIR)/$$app/dist -> $(ROOT_DIST_APPS_DIR)/$$app"; \
		else \
			echo "skip: $(APPS_DIR)/$$app/dist not found"; \
		fi; \
	done

apps-index:
	@BUILD_REPO_URL="https://github.com/kazune/homepage" \
	BUILD_COMMIT_ID="$$(git rev-parse --short=12 HEAD 2>/dev/null || printf unknown)" \
	$(PNPM) exec node scripts/generate-apps-index.mjs

clean:
	rm -rf "$(ROOT_DIST_DIR)"

deploy: dist
	@set -e; \
	mkdir -p "$(RELEASES_DIR)"; \
	mkdir -p "$(RELEASE_DIR)"; \
	cp -R "$(ROOT_DIST_DIR)/." "$(RELEASE_DIR)/"; \
	ln -sfn "releases/$(RELEASE_ID)" "$(CURRENT_LINK)"; \
	echo "deployed: $(RELEASE_DIR)"; \
	echo "current -> releases/$(RELEASE_ID)"
