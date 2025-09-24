# Stream Markdown

A modern alternative to
[`react-markdown`](https://github.com/remarkjs/react-markdown), designed with
**streaming support**, **headless UI principles**, and **directive-based
extensibility**.\
Built on top of the [`remark`](https://github.com/remarkjs/remark) and
[`rehype`](https://github.com/rehypejs/rehype) ecosystem.

---

## Motivation

Traditional Markdown-to-React solutions like `react-markdown` are great, but
they come with some limitations:

- **No built-in streaming support** – AI-generated or progressively fetched text
  can cause layout shifts.
- **Styling assumptions** – tightly coupled styles instead of a true headless UI
  approach.
- **MDX fragility** – MDX parsing can crash on malformed input (e.g.
  AI-generated Markdown). We need something more stable.
- **Extensibility gaps** – directives should map cleanly to React components,
  without forcing a risky parser pipeline.

This project aims to address these gaps.

---

## Features

### 1. Streaming Markdown Rendering

- Prop: `markdown` – the Markdown source string.
- Prop: `streaming` – enables streaming mode.
- **Stability guarantee:**
  - Only render up to the **second-to-last block element**.
  - The last block is held in a **buffer zone**, preventing layout shifts (e.g.,
    a paragraph later turning into a heading).
- Efficient updates:
  - Old prefix is compared with the new incoming text.
  - Already-rendered blocks remain stable.
  - Only the buffer zone is re-parsed.

### 2. Stable Block Identity

- Every block-level element (paragraph, heading, list, etc.) is assigned a
  **stable random ID**.
- Nested structures (like list items) also receive stable IDs.
- Ensures React reconciliation works reliably during streaming updates.

### 3. Headless UI Approach

- No default styles shipped.
- Consumers have **full control** over styling.
- Future roadmap: helpers for block-level animation (e.g., entering/exiting
  blocks).
  - **Note:** No text-level animation (since buffered text is only committed
    once stable).

### 4. Directive Support (MDX Alternative)

- Instead of MDX (which may crash on malformed input), we adopt
  **remark-directive** syntax.
- Supports both **inline directives** and **block directives**.
- Directives are translated into React components through a **custom directive
  resolver**:
  ```ts
  type DirectiveResolver = (directive: DirectiveNode) => ReactElement | null
  ```
- If the resolver returns `null`, the directive is omitted.
- Default behavior: return `null`.

---

## Example Usage

```tsx
import { Markdown } from 'your-library'
import { MyCustomDirective } from './components/MyCustomDirective'

const App = () => {
  return (
    <Markdown
      markdown='Hello :wave[world]'
      streaming
      directives={{
        wave: () => <MyCustomDirective />,
      }}
    />
  )
}
```

---

## Why Not MDX?

We intentionally avoid MDX because:

- **Crash risk:** AI-generated Markdown may produce invalid syntax that crashes
  the parser.
- **Stability first:** Our parser must always return _something renderable_
  without breaking the UI.
- **Predictable behavior:** Directives are explicit and user-controlled, unlike
  arbitrary embedded JSX.

---

## Roadmap

- ✅ Streaming Markdown support
- ✅ Stable block IDs
- ✅ Headless UI
- ✅ Directive → React component mapping
- ⬜ Animation helpers for block-level transitions
- ⬜ Local dev setup with `deno.json` + `package.json` dual support
- ⬜ More directive patterns (grid-like multi-column, etc.)

---

## License

MIT
