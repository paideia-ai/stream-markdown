import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import type { Root, RootContent } from 'npm:@types/mdast'

type SessionInit = {
  value?: string
  done?: boolean
}

export type MarkdownBlock = RootContent

export type MarkdownSnapshot = {
  committedBlocks: readonly MarkdownBlock[]
  bufferBlocks: readonly MarkdownBlock[]
  version: number
  cursor: number
  done: boolean
}

export type MarkdownSession = {
  write: (chunk: string) => MarkdownSnapshot
  finalize: (extra?: string) => MarkdownSnapshot
  snapshot: () => MarkdownSnapshot
  reset: (init?: SessionInit) => MarkdownSnapshot
}

type MutableSnapshot = {
  committedBlocks: MarkdownBlock[]
  bufferBlocks: MarkdownBlock[]
  version: number
  cursor: number
  done: boolean
}

const getOffset = (value: number | undefined): number | null => {
  if (typeof value !== 'number') {
    return null
  }
  return value
}

export const createSession = (initial?: SessionInit): MarkdownSession => {
  const parser = unified().use(remarkParse).use(remarkDirective)

  const state: MutableSnapshot = {
    committedBlocks: [],
    bufferBlocks: [],
    version: 0,
    cursor: 0,
    done: false,
  }

  let bufferSource = ''

  const promoteBlocks = (
    nodes: MarkdownBlock[],
    finalize: boolean,
  ): boolean => {
    if (nodes.length === 0) {
      state.bufferBlocks = []
      if (finalize) {
        bufferSource = ''
        state.done = true
        state.version += 1
      }
      return finalize
    }

    if (finalize) {
      state.committedBlocks.push(...nodes)
      state.bufferBlocks = []
      bufferSource = ''
      state.done = true
      state.version += 1
      return true
    }

    if (nodes.length === 1) {
      state.bufferBlocks = [nodes[0]]
      return false
    }

    const committedSlice = nodes.slice(0, nodes.length - 1)
    state.committedBlocks.push(...committedSlice)

    const latest = nodes[nodes.length - 1]
    state.bufferBlocks = [latest]

    const start = getOffset(latest.position?.start?.offset)
    if (start !== null) {
      bufferSource = bufferSource.slice(start)
    }

    state.version += 1
    return true
  }

  const parseBuffer = (finalize: boolean): boolean => {
    if (bufferSource.length === 0) {
      if (!finalize) {
        state.bufferBlocks = []
      }
      if (finalize && state.bufferBlocks.length > 0) {
        state.committedBlocks.push(...state.bufferBlocks)
        state.bufferBlocks = []
        state.version += 1
      }

      if (finalize) {
        state.done = true
      }
      return finalize
    }

    const tree = parser.parse(bufferSource) as Root
    const nodes = tree.children as MarkdownBlock[]
    return promoteBlocks(nodes, finalize)
  }

  const ingest = (text: string): void => {
    if (text.length === 0) {
      return
    }
    bufferSource += text
    state.cursor += text.length
    parseBuffer(false)
  }

  const finalizeSession = (extra?: string): MarkdownSnapshot => {
    if (state.done) {
      return snapshot()
    }
    if (extra && extra.length > 0) {
      bufferSource += extra
      state.cursor += extra.length
    }
    parseBuffer(true)
    bufferSource = ''
    return snapshot()
  }

  const snapshot = (): MarkdownSnapshot => ({
    committedBlocks: state.committedBlocks,
    bufferBlocks: state.bufferBlocks,
    version: state.version,
    cursor: state.cursor,
    done: state.done,
  })

  const reset = (init?: SessionInit): MarkdownSnapshot => {
    state.committedBlocks = []
    state.bufferBlocks = []
    state.version = 0
    state.cursor = 0
    state.done = false
    bufferSource = ''

    if (init?.value && init.value.length > 0) {
      bufferSource = ''
      ingest(init.value)
    }

    if (init?.done) {
      finalizeSession()
    }

    return snapshot()
  }

  const write = (chunk: string): MarkdownSnapshot => {
    if (state.done) {
      throw new Error('Cannot write to a finalized session')
    }
    ingest(chunk)
    return snapshot()
  }

  if (initial) {
    reset(initial)
  }

  return {
    write,
    finalize: finalizeSession,
    snapshot,
    reset,
  }
}
