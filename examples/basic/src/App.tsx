import { useEffect, useMemo, useState } from 'react'

import { MarkdownStream } from '@/stream-markdown'

const STREAM_INTERVAL = 480

const DOC_SOURCE =
  `# Stream Markdown Demo\n\nWelcome to the streaming playground. This example feeds Markdown\nprogressively so you can inspect how committed blocks stay stable\nwhile the trailing buffer updates.\n\n- Chunks append in order\n- Stable blocks reuse their React keys\n- The final block waits in the buffer\n\n## Next steps\n\n1. Reset the stream to replay the flow\n2. Extend the demo with your own directives\n`

const DOC_CHUNKS = [
  '# Stream Markdown Demo\n\n',
  'Welcome to the streaming playground. ',
  'This example feeds Markdown\n',
  'progressively so you can inspect how committed blocks stay stable\n',
  'while the trailing buffer updates.\n\n',
  '- Chunks append in order\n',
  '- Stable blocks reuse their React keys\n',
  '- The final block waits in the buffer\n\n',
  '## Next steps\n\n',
  '1. Reset the stream to replay the flow\n',
  '2. Extend the demo with your own directives\n',
]

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

  const reset = () => {
    setSessionKey((value) => value + 1)
  }

  const currentSource = useMemo(() => chunks.join(''), [chunks])

  return (
    <div className='app'>
      <header className='app__header'>
        <h1>stream-markdown · basic streaming demo</h1>
        <p>
          Status: <strong>{complete ? 'Complete' : 'Streaming'}</strong>
        </p>
        <p>
          Delivered chunks: {chunks.length} / {DOC_CHUNKS.length}
        </p>
        <button type='button' onClick={reset}>
          Reset stream
        </button>
      </header>
      <main className='app__panes'>
        <section className='app__pane'>
          <h2>Rendered output</h2>
          <MarkdownStream
            mode='streaming'
            chunks={chunks}
            complete={complete}
            content={DOC_SOURCE}
          />
        </section>
        <section className='app__pane app__pane--source'>
          <h2>Current Markdown</h2>
          <pre>
            <code>{currentSource}</code>
          </pre>
        </section>
      </main>
    </div>
  )
}
