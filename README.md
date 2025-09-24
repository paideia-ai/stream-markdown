# Stream Markdown

Progressive Markdown streaming for React, powered by the remark ecosystem with
headless primitives and directive support.

---

## Try The Examples

```bash
deno task example basic      # streaming walkthrough
deno task example directive  # directive renderer demo
```

- Requires Deno 2+ with Node compatibility (default install).
- Examples run Vite through Deno, so hot reload works out of the box.

---

## Overview

- Stream Markdown incrementally while keeping promoted blocks stable for React
  reconciliation.
- Opt into directive rendering via the `remark-directive` syntax and a
  `renderDirective` callback.
- Headless primitives only—consumers control every piece of UI.
- For implementation details and roadmap, see [`SPEC.md`](./SPEC.md).

---

## Usage

```tsx
import { MarkdownStream } from 'stream-markdown'

export const Preview = ({ chunks }: { chunks: string[] }) => (
  <MarkdownStream mode='streaming' chunks={chunks} />
)
```

Stable Markdown can be rendered without streaming props:

```tsx
<MarkdownStream content='# Hello world' />
```

### Rendering directives

```tsx
import type { MarkdownDirectiveRenderer } from 'stream-markdown'

const renderDirective: MarkdownDirectiveRenderer = ({ name, children }) => {
  if (name === 'callout') {
    return <aside className='callout'>{children}</aside>
  }
  return null
}

<MarkdownStream
  content=':::callout\nContent\n:::'
  renderDirective={renderDirective}
/>
```

If no renderer is provided, directive nodes resolve to `null`, keeping the tree
stable even when directives appear in streamed chunks.

---

## Development

- Format & lint: `deno fmt`, `deno lint`
- Tests: `deno test`
- Examples: `deno task example <name>`

The [spec](./SPEC.md) captures the streaming contract, buffer promotion rules,
and React integration notes.

---

## License

MIT
