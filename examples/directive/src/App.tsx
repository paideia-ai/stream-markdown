import { useEffect, useMemo, useState } from 'react'

import {
  type MarkdownDirectiveRenderer,
  MarkdownStream,
} from '@/stream-markdown'

const STREAM_INTERVAL = 420

const DOC_SOURCE = `# Directive showcase

:badge[Live preview]{tone=info}

:::callout{variant=info title=Composable directives}
Directives map into React in the renderer. Use **renderDirective** to supply components.
:::

Paragraph with inline :kbd[Cmd + K] directive.

:::callout{variant=success title=Nested content}
- :badge[Launch ready]{tone=success} signals a green status
- :kbd[Ctrl + Enter] triggers submission
:::

Regular Markdown still works alongside directives.
`

const DOC_CHUNKS = [
  '# Directive showcase\n\n',
  ':badge[Live preview]{tone=info}\n\n',
  ':::callout{variant=info title=Composable directives}\n',
  'Directives map into React in the renderer. Use **renderDirective** to supply components.\n',
  ':::\n\n',
  'Paragraph with inline :kbd[Cmd + K] directive.\n\n',
  ':::callout{variant=success title=Nested content}\n',
  '- :badge[Launch ready]{tone=success} signals a green status\n',
  '- :kbd[Ctrl + Enter] triggers submission\n',
  ':::\n\n',
  'Regular Markdown still works alongside directives.\n',
]

type DirectiveTone = 'info' | 'success'

const normalizeString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value
  }
  return undefined
}

const toTone = (value: unknown, fallback: DirectiveTone): DirectiveTone => {
  const tone = normalizeString(value)
  if (tone === 'success') {
    return 'success'
  }
  return tone === 'info' ? 'info' : fallback
}

const renderDirective: MarkdownDirectiveRenderer = ({
  directiveType,
  name,
  attributes,
  children,
}) => {
  if (directiveType === 'containerDirective' && name === 'callout') {
    const variant = toTone(attributes?.variant, 'info')
    const title = normalizeString(attributes?.title)
    return (
      <aside className={`callout callout--${variant}`}>
        {title ? <p className='callout__title'>{title}</p> : null}
        <div>{children}</div>
      </aside>
    )
  }

  if (
    name === 'badge' &&
    (directiveType === 'leafDirective' || directiveType === 'textDirective')
  ) {
    const tone = toTone(attributes?.tone, 'info')
    return (
      <span className={`badge badge--${tone}`}>
        <span>{tone === 'success' ? 'OK' : '--'}</span>
        <span>{children}</span>
      </span>
    )
  }

  if (directiveType === 'textDirective' && name === 'kbd') {
    return <kbd className='kbd'>{children}</kbd>
  }

  return null
}

export const App = () => {
  const [chunks, setChunks] = useState<string[]>([])
  const [complete, setComplete] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    setChunks([])
    setComplete(false)

    let index = 0

    const enqueue = () => {
      if (cancelled) {
        return
      }

      if (index >= DOC_CHUNKS.length) {
        setComplete(true)
        return
      }

      const nextChunk = DOC_CHUNKS[index]
      index += 1
      setChunks((current) => [...current, nextChunk])
      timeoutId = setTimeout(enqueue, STREAM_INTERVAL)
    }

    timeoutId = setTimeout(enqueue, STREAM_INTERVAL)

    return () => {
      cancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [sessionKey])

  const reset = () => setSessionKey((value) => value + 1)

  const markdown = useMemo(() => chunks.join(''), [chunks])

  return (
    <div className='app'>
      <header>
        <div className='hero'>
          <div>
            <h1>stream-markdown · directive demo</h1>
            <p>
              Streaming markdown renders directives through{' '}
              <code>renderDirective</code>.
            </p>
            <p>
              Remove the renderer to see directives fall back to{' '}
              <code>null</code>.
            </p>
          </div>
          <div className='status'>
            <span className='status__badge'>
              {complete ? 'complete' : 'streaming'}
            </span>
            <button type='button' onClick={reset}>
              Reset stream
            </button>
            <p>
              {chunks.length} / {DOC_CHUNKS.length} chunks delivered
            </p>
          </div>
        </div>
      </header>
      <main>
        <section className='panel'>
          <h2>Rendered output</h2>
          <div className='markdown'>
            <MarkdownStream
              mode='streaming'
              chunks={chunks}
              complete={complete}
              content={DOC_SOURCE}
              renderDirective={renderDirective}
            />
          </div>
        </section>
        <section className='panel'>
          <h2>Markdown source</h2>
          <pre>
            <code>{markdown}</code>
          </pre>
        </section>
      </main>
    </div>
  )
}
