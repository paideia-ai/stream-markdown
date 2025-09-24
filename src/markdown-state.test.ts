import { assert, assertEquals, assertStrictEquals } from '@std/assert'

import { mergeMarkdownState } from './markdown-state.ts'

Deno.test('initial merge splits committed and buffer blocks', () => {
  const result = mergeMarkdownState(undefined, {
    chunks: ['Hello world\n\nSecond block'],
    done: false,
  })

  assertEquals(result.state.version, 0)
  assertEquals(result.committedBlocks.length, 1)
  assert(result.bufferBlock)
  assertEquals(result.state.cursor < result.state.text.length, true)
})

Deno.test('appending streaming chunks promotes completed blocks', () => {
  const first = mergeMarkdownState(undefined, {
    chunks: ['First block\n\nSecond block'],
    done: false,
  })

  const next = mergeMarkdownState(first.state, {
    chunks: ['First block\n\nSecond block\n\nThird block'],
    done: false,
  })

  assertEquals(next.state.version, first.state.version)
  assertEquals(next.committedBlocks.length, 2)
  assert(next.bufferBlock)
  assertEquals(next.bufferBlock?.type, 'paragraph')
})

Deno.test('buffer-only updates preserve committed block identity', () => {
  const initial = mergeMarkdownState(undefined, {
    chunks: ['Hello'],
    done: false,
  })

  const extended = mergeMarkdownState(initial.state, {
    chunks: ['Hello, world'],
    done: false,
  })

  assertStrictEquals(
    extended.state.committedBlocks,
    initial.state.committedBlocks,
  )
  assertStrictEquals(extended.committedBlocks, initial.committedBlocks)
})

Deno.test('divergence forces a reset and bumps the version', () => {
  const start = mergeMarkdownState(undefined, {
    chunks: ['Alpha\n\nBeta'],
    done: false,
  })

  const reset = mergeMarkdownState(start.state, {
    chunks: ['Replaced content'],
    done: false,
  })

  assertEquals(reset.state.version, start.state.version + 1)
  assertEquals(reset.committedBlocks.length, 0)
  assert(reset.bufferBlock)
})

Deno.test('finalizing content flushes the buffer', () => {
  const streaming = mergeMarkdownState(undefined, {
    chunks: ['Intro\n\nBody'],
    done: false,
  })

  const finalized = mergeMarkdownState(streaming.state, {
    chunks: ['Intro\n\nBody'],
    done: true,
  })

  assertEquals(finalized.state.done, true)
  assertEquals(finalized.bufferBlock, null)
  assertEquals(finalized.committedBlocks.length, 2)
})
