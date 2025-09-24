import { Fragment, memo, useEffect, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { Fragment as JsxFragment, jsx, jsxs } from 'react/jsx-runtime'
import { toHast } from 'mdast-util-to-hast'
import type { Handler } from 'mdast-util-to-hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Properties as HastProperties } from 'hast'
import type { Root } from 'npm:@types/mdast'
import type {
  ContainerDirective,
  LeafDirective,
  TextDirective,
} from 'mdast-util-directive'

import {
  createSession,
  type MarkdownBlock,
  type MarkdownSession,
  type MarkdownSnapshot,
} from './session.ts'

type CommonRenderers = {
  renderBlock?: (block: MarkdownBlock, index: number) => ReactNode
  renderBuffer?: (block: MarkdownBlock | null) => ReactNode
  renderDirective?: MarkdownDirectiveRenderer
}

type StreamingProps = {
  mode: 'streaming'
  chunks: readonly string[]
  complete?: boolean
  content?: string
} & CommonRenderers

type StableProps = {
  mode?: 'stable'
  content: string
} & CommonRenderers

export type MarkdownStreamProps = StreamingProps | StableProps

type StreamingPrevState = {
  mode: 'streaming'
  chunks: readonly string[]
  text: string
  complete: boolean
  latestStable?: string
}

type StablePrevState = {
  mode: 'stable'
  content: string
}

type PrevState = StreamingPrevState | StablePrevState | null

type ApplyResult = {
  next: PrevState
  mutated: boolean
}

export type MarkdownDirectiveNode =
  | ContainerDirective
  | LeafDirective
  | TextDirective

export type DirectiveRenderProps = {
  node: MarkdownDirectiveNode
  children: ReactNode | null
  directiveType: MarkdownDirectiveNode['type']
  name?: string
  attributes?: Record<string, unknown>
}

export type MarkdownDirectiveRenderer = (
  props: DirectiveRenderProps,
) => ReactNode

const toArray = (chunks: readonly string[]): string[] => Array.from(chunks)

const applyStreamingProps = (
  session: MarkdownSession,
  prev: PrevState,
  props: StreamingProps,
): ApplyResult => {
  const chunks = props.chunks ?? []
  const complete = props.complete ?? false
  const stableContent = props.content
  const joined = chunks.join('')

  const previousStable = prev && prev.mode === 'streaming'
    ? prev.latestStable
    : undefined

  let mutated = false
  let needsReset = true

  if (prev && prev.mode === 'streaming') {
    needsReset = false
    if (chunks.length < prev.chunks.length) {
      needsReset = true
    } else {
      for (let index = 0; index < prev.chunks.length; index += 1) {
        if (chunks[index] !== prev.chunks[index]) {
          needsReset = true
          break
        }
      }
    }
  }

  if (needsReset) {
    session.reset({ value: joined, done: false })
    mutated = true
  } else if (prev && prev.mode === 'streaming') {
    for (let index = prev.chunks.length; index < chunks.length; index += 1) {
      session.write(chunks[index])
      mutated = true
    }
  }

  if (complete) {
    const snapshot = session.snapshot()
    if (stableContent && !stableContent.startsWith(joined)) {
      session.reset({ value: stableContent, done: true })
      mutated = true
    } else if (!snapshot.done) {
      const suffix = stableContent ? stableContent.slice(joined.length) : ''
      if (suffix.length > 0) {
        session.finalize(suffix)
      } else {
        session.finalize()
      }
      mutated = true
    }
  }

  return {
    next: {
      mode: 'streaming',
      chunks: toArray(chunks),
      text: joined,
      complete,
      latestStable: stableContent ?? previousStable,
    },
    mutated,
  }
}

const applyStableProps = (
  session: MarkdownSession,
  prev: PrevState,
  props: StableProps,
): ApplyResult => {
  const content = props.content ?? ''
  let mutated = false

  if (prev && prev.mode === 'streaming') {
    const prefix = prev.text
    if (content.startsWith(prefix)) {
      const suffix = content.slice(prefix.length)
      if (!session.snapshot().done) {
        if (suffix.length > 0) {
          session.finalize(suffix)
        } else {
          session.finalize()
        }
        mutated = true
      }
    } else {
      session.reset({ value: content, done: true })
      mutated = true
    }
  } else if (!prev || prev.mode !== 'stable' || prev.content !== content) {
    session.reset({ value: content, done: true })
    mutated = true
  } else if (!session.snapshot().done) {
    session.finalize()
    mutated = true
  }

  return {
    next: {
      mode: 'stable',
      content,
    },
    mutated,
  }
}

const directiveHandler: Handler = (state, node) => {
  const directive = node as MarkdownDirectiveNode
  const properties = {
    node: directive,
    directiveType: directive.type,
    name: directive.name,
    attributes: directive.attributes ?? {},
  } as unknown as HastProperties
  return {
    type: 'element',
    tagName: 'DirectiveMarker',
    properties,
    children: state.all(directive as never),
  }
}

const directiveHandlers: Record<string, Handler> = {
  containerDirective: directiveHandler,
  leafDirective: directiveHandler,
  textDirective: directiveHandler,
}

const defaultRenderBuffer = () => null

const defaultRenderDirective: MarkdownDirectiveRenderer = () => null

type DirectiveMarkerProps = {
  node: MarkdownDirectiveNode
  directiveType: MarkdownDirectiveNode['type']
  name?: string
  attributes?: Record<string, unknown>
  children?: ReactNode
}

const renderBlockNode = (
  block: MarkdownBlock,
  renderDirective?: MarkdownDirectiveRenderer,
): ReactNode => {
  const root: Root = {
    type: 'root',
    children: [block],
  }

  const tree = toHast(root, {
    allowDangerousHtml: true,
    handlers: directiveHandlers,
  })
  if (!tree) {
    return null
  }

  const directiveRenderer = renderDirective ?? defaultRenderDirective

  return toJsxRuntime(tree, {
    Fragment: JsxFragment,
    jsx,
    jsxs,
    components: {
      DirectiveMarker: (
        props: DirectiveMarkerProps,
      ) =>
        directiveRenderer({
          node: props.node,
          children: props.children ?? null,
          directiveType: props.directiveType,
          name: props.name,
          attributes: props.attributes,
        }),
    },
  })
}

type BlockViewProps = {
  block: MarkdownBlock
  renderDirective?: MarkdownDirectiveRenderer
}

const DefaultBlockView = memo(
  function DefaultBlockView({ block, renderDirective }: BlockViewProps) {
    const content = renderBlockNode(block, renderDirective)
    return <>{content}</>
  },
  (previous, next) =>
    previous.block === next.block &&
    previous.renderDirective === next.renderDirective,
)

export const MarkdownStream = (props: MarkdownStreamProps) => {
  const mode = props.mode ?? 'stable'
  const customRenderBlock = props.renderBlock
  const renderBuffer = props.renderBuffer ?? defaultRenderBuffer
  const renderDirective = props.renderDirective

  const sessionRef = useRef<MarkdownSession | null>(null)
  const snapshotRef = useRef<MarkdownSnapshot | null>(null)
  const prevRef = useRef<PrevState>(null)

  if (sessionRef.current === null) {
    const session = mode === 'stable'
      ? createSession({
        value: (props as StableProps).content ?? '',
        done: true,
      })
      : createSession()
    sessionRef.current = session
    snapshotRef.current = session.snapshot()
    prevRef.current = mode === 'stable'
      ? {
        mode: 'stable',
        content: (props as StableProps).content ?? '',
      }
      : null
  }

  const [, forceRender] = useReducer((value: number) => value + 1, 0)

  const streamingChunks = mode === 'streaming'
    ? (props as StreamingProps).chunks
    : undefined
  const streamingComplete = mode === 'streaming'
    ? (props as StreamingProps).complete
    : undefined
  useEffect(() => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    const prev = prevRef.current
    let result: ApplyResult

    if (mode === 'streaming') {
      result = applyStreamingProps(session, prev, props as StreamingProps)
    } else {
      result = applyStableProps(session, prev, props as StableProps)
    }

    prevRef.current = result.next

    const previousSnapshot = snapshotRef.current
    const nextSnapshot = session.snapshot()
    snapshotRef.current = nextSnapshot

    const bufferChanged = !previousSnapshot ||
      nextSnapshot.bufferBlocks.length !==
        previousSnapshot.bufferBlocks.length ||
      nextSnapshot.bufferBlocks.some((node, index) =>
        node !== previousSnapshot.bufferBlocks[index]
      )
    const commitCountChanged = !previousSnapshot ||
      nextSnapshot.committedBlocks.length !==
        previousSnapshot.committedBlocks.length
    const versionChanged = !previousSnapshot ||
      nextSnapshot.version !== previousSnapshot.version
    const doneChanged = !previousSnapshot ||
      nextSnapshot.done !== previousSnapshot.done
    const cursorChanged = !previousSnapshot ||
      nextSnapshot.cursor !== previousSnapshot.cursor

    if (
      result.mutated || bufferChanged || commitCountChanged || versionChanged ||
      doneChanged || cursorChanged
    ) {
      forceRender()
    }
  }, [mode, streamingChunks, props.content, streamingComplete])

  const snapshot = snapshotRef.current ?? sessionRef.current?.snapshot()

  if (!snapshot) {
    return null
  }

  return (
    <Fragment>
      {snapshot.committedBlocks.map((block, index) => (
        customRenderBlock
          ? <Fragment key={index}>{customRenderBlock(block, index)}</Fragment>
          : (
            <DefaultBlockView
              key={index}
              block={block}
              renderDirective={renderDirective}
            />
          )
      ))}
      {renderBuffer(snapshot.bufferBlocks[0] ?? null)}
    </Fragment>
  )
}
