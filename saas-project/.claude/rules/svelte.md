---
paths:
  - "**/*.svelte"
  - "**/*.svelte.ts"
  - "**/*.svelte.js"
---

# Svelte

- Use Svelte 5 syntax only: runes (`$state`, `$derived`, `$effect`, `$props`), event attributes (`onclick`), and snippets (`{#snippet}` / `{@render}`).
- Never use Svelte 4 syntax: `export let`, `$:`, `on:click`, slots, or `createEventDispatcher`.
- Don't rely on memory for Svelte or SvelteKit APIs; they change between versions. Check the official docs when unsure, through the Svelte MCP server if it's available.
- Keep components presentational: data comes in through props, user actions go out through callback props or forms. See "Replaceable design" in `CLAUDE.md`.
