import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import type { Root, RootContent } from 'npm:@types/mdast'

export type MarkdownBlock = RootContent

export type MarkdownMachineState = {
  chunks: readonly string[]
  text: string
  cursor: number
  version: number
  committedBlocks: readonly MarkdownBlock[]
  bufferBlock: MarkdownBlock | null
  done: boolean
}

export type MarkdownMergeInput = {
  chunks: readonly string[]
  done: boolean
}

export type MarkdownMergeResult = {
  state: MarkdownMachineState
  committedBlocks: readonly MarkdownBlock[]
  bufferBlock: MarkdownBlock | null
}

const parser = unified().use(remarkParse).use(remarkDirective)

const toArray = (value: readonly string[]): string[] => Array.from(value)

const parseNodes = (source: string): MarkdownBlock[] => {
  if (source.length === 0) {
    return []
  }
  const tree = parser.parse(source) as Root
  return tree.children as MarkdownBlock[]
}

const bufferStart = (
  node: MarkdownBlock | null | undefined,
  fallback: number,
): number => {
  const offset = node?.position?.start?.offset
  if (typeof offset === 'number' && offset >= 0) {
    return offset
  }
  return fallback
}

const applyFromScratch = (
  source: string,
  chunks: readonly string[],
  done: boolean,
  nextVersion: number,
): MarkdownMergeResult => {
  const nodes = parseNodes(source)

  let committedBlocks: readonly MarkdownBlock[] = []
  let bufferBlock: MarkdownBlock | null = null
  let cursor = source.length

  if (done) {
    committedBlocks = nodes
    bufferBlock = null
    cursor = source.length
  } else if (nodes.length === 0) {
    bufferBlock = null
    cursor = source.length
  } else if (nodes.length === 1) {
    bufferBlock = nodes[0]
    cursor = bufferStart(bufferBlock, source.length)
  } else {
    const ready = nodes.slice(0, -1)
    committedBlocks = ready
    bufferBlock = nodes[nodes.length - 1]
    cursor = bufferStart(bufferBlock, source.length)
  }

  const state: MarkdownMachineState = {
    chunks: toArray(chunks),
    text: source,
    cursor,
    version: nextVersion,
    committedBlocks,
    bufferBlock,
    done,
  }

  return {
    state,
    committedBlocks,
    bufferBlock,
  }
}

export const mergeMarkdownState = (
  previous: MarkdownMachineState | undefined,
  input: MarkdownMergeInput,
): MarkdownMergeResult => {
  const targetChunks = input.chunks
  const mergedText = targetChunks.join('')
  const done = input.done

  if (!previous) {
    return applyFromScratch(mergedText, targetChunks, done, 0)
  }

  if (mergedText === previous.text && done === previous.done) {
    return {
      state: {
        chunks: toArray(targetChunks),
        text: previous.text,
        cursor: previous.cursor,
        version: previous.version,
        committedBlocks: previous.committedBlocks,
        bufferBlock: previous.bufferBlock,
        done: previous.done,
      },
      committedBlocks: previous.committedBlocks,
      bufferBlock: previous.bufferBlock,
    }
  }

  // Naively compare the joined strings to detect divergence. We keep the chunk
  // arrays around so we can swap in a smarter prefix-aware comparison that
  // honours the original chunking when we need the extra precision.
  const isExtension = mergedText.startsWith(previous.text) &&
    mergedText.length >= previous.text.length

  if (!isExtension) {
    const nextVersion = previous.version + 1
    return applyFromScratch(mergedText, targetChunks, done, nextVersion)
  }

  const suffix = mergedText.slice(previous.cursor)
  if (suffix.length === 0 && done === previous.done) {
    return {
      state: {
        chunks: toArray(targetChunks),
        text: mergedText,
        cursor: previous.cursor,
        version: previous.version,
        committedBlocks: previous.committedBlocks,
        bufferBlock: previous.bufferBlock,
        done,
      },
      committedBlocks: previous.committedBlocks,
      bufferBlock: previous.bufferBlock,
    }
  }

  const nodes = parseNodes(suffix)

  let committedBlocks = previous.committedBlocks
  let bufferBlock = previous.bufferBlock
  let cursor = previous.cursor

  if (done) {
    if (nodes.length > 0) {
      committedBlocks = previous.committedBlocks.length > 0
        ? [...previous.committedBlocks, ...nodes]
        : nodes
    }
    bufferBlock = null
    cursor = mergedText.length
  } else if (nodes.length === 0) {
    bufferBlock = null
    cursor = mergedText.length
  } else if (nodes.length === 1) {
    bufferBlock = nodes[0]
    const offset = bufferStart(bufferBlock, suffix.length)
    cursor = previous.cursor + offset
  } else {
    const ready = nodes.slice(0, -1)
    if (ready.length > 0) {
      committedBlocks = previous.committedBlocks.length > 0
        ? [...previous.committedBlocks, ...ready]
        : ready
    }
    bufferBlock = nodes[nodes.length - 1]
    const offset = bufferStart(bufferBlock, suffix.length)
    cursor = previous.cursor + offset
  }

  const state: MarkdownMachineState = {
    chunks: toArray(targetChunks),
    text: mergedText,
    cursor,
    version: previous.version,
    committedBlocks,
    bufferBlock,
    done,
  }

  return {
    state,
    committedBlocks,
    bufferBlock,
  }
}
