# AGENTS.md

## Purpose

This repository contains a personal homepage and a collection of **small static web apps**.

The current goal is to quickly build and maintain **simple one-shot utilities** such as:

* QR generators
* text tools
* JSON formatters
* UUID generators
* small browser utilities

Do not design for large systems unless explicitly requested.

---

# Scope

The repository currently supports:

1. A simple homepage
2. Multiple small static apps

The repository **does NOT currently support**:

* backend services
* databases
* authentication
* SSR frameworks
* complex application architectures

---

# Hosting Model

Deployment environment:

* VPS
* Ubuntu
* Apache2
* Static file hosting

Apache serves **generated static files only**.

The server does not run application code.

---

# Repository Structure

Typical structure:

```
homepage/
  site/                # homepage contents
  apps/                # small apps
    <app-name>/
      src/
      public/
      dist/
      README.md
      app.json
  scripts/
  dist/                # final deployment output
  docs/
  AGENTS.md
```

---

# URL Rules

Apps must be published under:

```
/apps/<app-name>/
```

Examples:

```
/apps/hello-qr/
/apps/word-counter/
/apps/json-format/
```

Do not change this convention.

---

# Source Code Rules

Application source code should live in:

```
src/
```

TypeScript is preferred for application logic.

Example:

```
src/main.ts
src/utils.ts
```

Do not write application logic directly in generated JavaScript.

---

# Build Output Rules

All browser-ready assets must be generated into:

```
dist/
```

Typical output:

```
dist/index.html
dist/assets/*.js
dist/assets/*.css
```

Important rules:

* `dist/` is **build output**
* `dist/` should not be treated as source code
* do not manually edit generated files

The server only serves files inside `dist/`.

---

# Repository-level dist

The root `dist/` directory represents the **final deployment tree**.

Example:

```
dist/
  index.html
  apps/
    hello-qr/
    word-counter/
```

Apache should serve this directory as the document root.

---

# App Design Principles

When creating small apps:

Prefer:

* plain HTML
* TypeScript
* minimal dependencies
* simple UI
* lightweight builds

Avoid:

* large frameworks
* unnecessary abstraction
* complex dependency graphs

These apps are intended to be **small utilities**, not full-scale applications.

---

# app.json

Each app should include a metadata file.

Example:

```
apps/hello-qr/app.json
```

Example contents:

```
{
  "name": "hello-qr",
  "title": "Hello QR",
  "path": "/apps/hello-qr/",
  "description": "Generate a QR code from text"
}
```

This metadata may be used to generate the app list on the homepage.

---

# Structural Changes

Do not redesign the repository structure unless explicitly instructed.

In particular:

* do not introduce backend services
* do not add databases
* do not restructure the repository for future blog/diary systems
* do not introduce heavy monorepo tooling

The current priority is **simplicity and speed of development**.

---

# Decision Policy

When making implementation choices, prefer:

1. simplicity
2. readability
3. minimal dependencies
4. static deployment compatibility

Avoid optimizing for:

* enterprise scale
* speculative future systems
* complex architecture

---

# Summary

This repository is optimized for:

* small browser utilities
* static deployment
* fast iteration
* minimal maintenance overhead
