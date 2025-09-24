import { assertEquals, assertThrows } from '@std/assert'

import { createSession } from './session.ts'

Deno.test('session promotes completed blocks and buffers the newest block', () => {
  const session = createSession()

  session.write('Hello world\n\nSecond block')

  let snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 1)
  assertEquals(snapshot.bufferBlocks.length, 1)

  session.write('\n\nThird block')
  snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 2)
  assertEquals(snapshot.bufferBlocks.length, 1)
})

Deno.test('finalize flushes the remaining buffered block', () => {
  const session = createSession()

  session.write('Only block in stream')
  let snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 0)
  assertEquals(snapshot.bufferBlocks.length, 1)

  session.finalize()
  snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 1)
  assertEquals(snapshot.bufferBlocks.length, 0)
  assertEquals(snapshot.done, true)
})

Deno.test('finalize accepts a final suffix', () => {
  const session = createSession()

  session.write('First block\n\nSecond block sta')
  session.finalize('ble end')

  const snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 2)
  assertEquals(snapshot.bufferBlocks.length, 0)
})

Deno.test('reset rebuilds the session state', () => {
  const session = createSession({ value: 'Initial block', done: true })

  let snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 1)
  assertEquals(snapshot.done, true)

  session.reset({ value: 'Streaming block one\n\nblock two', done: false })
  snapshot = session.snapshot()
  assertEquals(snapshot.committedBlocks.length, 1)
  assertEquals(snapshot.bufferBlocks.length, 1)
  assertEquals(snapshot.done, false)
})

Deno.test('writing after finalize throws', () => {
  const session = createSession({ value: 'hello', done: true })

  assertThrows(() => {
    session.write('world')
  })
})
