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
  `directives` map.
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
import type { MarkdownDirectiveComponents } from 'stream-markdown'

const directives: MarkdownDirectiveComponents = {
  callout: ({ children }) => <aside className='callout'>{children}</aside>,
}

<MarkdownStream content=':::callout\nContent\n:::' directives={directives} />
```

If no matching directive renderer is provided, directive nodes resolve to
`null`, keeping the tree stable even when directives appear in streamed chunks.

### Overriding Markdown elements

```tsx
import type { MarkdownComponents } from 'stream-markdown'

const components: MarkdownComponents = {
  h1: ({ children, ...rest }) => (
    <h1 {...rest} className='text-3xl font-bold'>
      {children}
    </h1>
  ),
}

<MarkdownStream content='# Styled heading' components={components} />
```

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
