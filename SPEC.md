# Markdown Streaming Spec

## Overview

- Goal: parse Markdown progressively while maintaining stable block output for
  React consumers.
- Core delivers append-only, streaming-safe snapshots; React layer wraps the
  session into a declarative component.
- Output units are Markdown block nodes (mdast); consumers convert to HTML/React
  lazily per block.

## Core Session

### Concepts

- **Chunk**: immutable string fragment appended exactly once in order.
- **Committed block**: mdast block parsed from the stable prefix (everything
  except the newest block). Each block owns its nested children (e.g., list
  items) locally; we never rebuild a global tree.
- **Buffer block**: newest mdast block(s) still in flux; after promotion only
  the latest block remains buffered. Length is always `0` or `1`.
- **Snapshot**: `{ committedBlocks, bufferBlocks, version, cursor }` view of the
  session state. `version` increments whenever committed content changes or
  finalize runs.

### Factory

- `createSession(initial?: { value?: string; done?: boolean })` returns
  `{ write, finalize, snapshot, reset }`.
- `initial.value` is parsed immediately. If `done` is true, every block is
  committed and the buffer stays empty.

### Parsing & Promotion Rules

- `write(chunk: string)` appends the new text, parses only from the previous
  cursor, and updates the buffer. Returns the latest snapshot for convenience.
- After parsing, if the buffer holds ≥2 blocks, promote every block except the
  newest one into `committedBlocks`.
- Cut internal input so the buffer’s remaining text starts at the newest block;
  earlier text never mutates.
- Reuse existing array instances for `committedBlocks` between promotions to
  keep React memoization cheap.
- `cursor` tracks total processed characters for monotonicity checks.
- `snapshot()` returns arrays that are immutable between promotions (same
  references reused for unchanged blocks).

### Finalization

- `finalize(extra?: string)` optionally consumes a final suffix, promotes all
  remaining buffered blocks, and marks the session done.
- Subsequent `write` calls throw or implicitly reset depending on consumer
  preference (React layer decides).

### Reset

- `reset({ value, done })` clears state and reinitializes from scratch; used
  when external invariants break (non-prefix updates, content swaps).

## React Component

### Public API

- `<MarkdownStream />` props:
  - `streaming?: boolean` (default `false`).
  - `chunks?: string[]` (required when `streaming` is `true`, append-only).
  - `content?: string` (required when `streaming` is `false`).
  - `components?: MarkdownComponents` optional map of HTML tag overrides.
  - `directives?: Record<string, MarkdownDirectiveRenderer>` optional directive
    renderer map.
  - `renderBuffer?: (block | null) => ReactNode` optional preview of buffered
    block.

### Lifecycle Behavior

- On first render, create a session via
  `createSession({ value: initialString, done })` when `streaming` is `false`.
- Keep the session in a ref so renders do not recreate it unless a reset
  condition is triggered.

#### Streaming Updates

- Detect new chunks by comparing lengths. For each new chunk call
  `session.write(chunk)`.
- If chunk order shrinks or any existing index changes, invoke
  `session.reset({ value: chunks.join(''), done: false })`.
- Finalization happens when callers re-render with `streaming` disabled and a
  `content` string; the stable branch reconciles the suffix and promotes any
  buffered block.

#### Mode Transitions

- Streaming → Stable:
  - Ensure stable content starts with streamed prefix.
  - If yes, pass the suffix to `finalize(suffix)` on the existing session.
  - If not, rebuild via `reset({ value: content, done: true })`.
- Stable → Stable with different content: always
  `reset({ value: content, done: true })`.
- Stable → Streaming: start a new session seeded with any `content` as the
  initial value (buffered unless `done` true).

### Rendering

- Use `session.snapshot()` each render; memoize the returned arrays to avoid
  redundant work.
- Render `committedBlocks` using array index as `key` (prefix stability ensured
  by promotion rules).
- Convert each block to React via `mdast-util-to-hast` + `hast-util-to-jsx`
  using the provided `components` overrides and directive map.
- Render the single buffered block (if present) via `renderBuffer` or omit it by
  default.

### Error Handling & Diagnostics

- If `chunks` are missing or mutated, log a warning before resetting.
- Surface `version`/`cursor` from snapshot for debugging; expose via dev-only
  prop if necessary.

## Future Hooks

- Session already supports `snapshot` + potential `subscribe`; wrapping in
  `useSyncExternalStore` is deferred until needed.
- Consider exposing `session` instance via ref forwarding for advanced
  consumers.
