import { Fragment, memo, useEffect, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { Fragment as JsxFragment, jsx, jsxs } from 'react/jsx-runtime'
import { toHast } from 'mdast-util-to-hast'
import type { Handler } from 'mdast-util-to-hast'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import type { Components as HastComponents } from 'hast-util-to-jsx-runtime'
import type { Properties as HastProperties } from 'hast'
import type { Root } from 'mdast'
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

type StreamingPrevState = {
  mode: 'streaming'
  chunks: readonly string[]
  text: string
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

export type MarkdownComponents = Partial<HastComponents>

export type MarkdownDirectiveComponents = Record<
  string,
  MarkdownDirectiveRenderer
>

type CommonRenderProps = {
  components?: MarkdownComponents
  directives?: MarkdownDirectiveComponents
  renderBuffer?: (block: MarkdownBlock | null) => ReactNode
}

type StreamingProps = {
  streaming: true
  chunks: readonly string[]
} & CommonRenderProps

type StableProps = {
  streaming?: false
  content: string
} & CommonRenderProps

export type MarkdownStreamProps = StreamingProps | StableProps

const toArray = (chunks: readonly string[]): string[] => Array.from(chunks)

const applyStreamingProps = (
  session: MarkdownSession,
  prev: PrevState,
  props: StreamingProps,
): ApplyResult => {
  const chunks = props.chunks ?? []
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

  return {
    next: {
      mode: 'streaming',
      chunks: toArray(chunks),
      text: joined,
      latestStable: previousStable,
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

type DirectiveMarkerProps = {
  node: MarkdownDirectiveNode
  directiveType: MarkdownDirectiveNode['type']
  name?: string
  attributes?: Record<string, unknown>
  children?: ReactNode
}

const renderDirectiveFromMap = (
  props: DirectiveMarkerProps,
  directives?: MarkdownDirectiveComponents,
): ReactNode => {
  const name = props.name
  if (!name || !directives) {
    return null
  }

  const renderer = directives[name]
  if (!renderer) {
    return null
  }

  return renderer({
    node: props.node,
    children: props.children ?? null,
    directiveType: props.directiveType,
    name,
    attributes: props.attributes ?? {},
  })
}

const renderBlockNode = (
  block: MarkdownBlock,
  components?: MarkdownComponents,
  directives?: MarkdownDirectiveComponents,
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

  const mergedComponents = components
    ? {
      ...components,
      DirectiveMarker: (props: DirectiveMarkerProps) =>
        renderDirectiveFromMap(props, directives),
    }
    : {
      DirectiveMarker: (props: DirectiveMarkerProps) =>
        renderDirectiveFromMap(props, directives),
    }

  return toJsxRuntime(tree, {
    Fragment: JsxFragment,
    jsx,
    jsxs,
    components: mergedComponents,
  })
}

type BlockViewProps = {
  block: MarkdownBlock
  components?: MarkdownComponents
  directives?: MarkdownDirectiveComponents
}

const DefaultBlockView = memo(
  function DefaultBlockView({ block, components, directives }: BlockViewProps) {
    const content = renderBlockNode(block, components, directives)
    return <>{content}</>
  },
  (previous, next) =>
    previous.block === next.block &&
    previous.components === next.components &&
    previous.directives === next.directives,
)

export const MarkdownStream = (props: MarkdownStreamProps) => {
  const streaming = props.streaming === true
  const renderBuffer = props.renderBuffer ?? defaultRenderBuffer
  const components = props.components
  const directives = props.directives

  const sessionRef = useRef<MarkdownSession | null>(null)
  const snapshotRef = useRef<MarkdownSnapshot | null>(null)
  const prevRef = useRef<PrevState>(null)

  const streamingProps = streaming ? props as StreamingProps : undefined
  const stableProps = streaming ? undefined : props as StableProps

  if (sessionRef.current === null) {
    const session = streaming ? createSession() : createSession({
      value: stableProps?.content ?? '',
      done: true,
    })
    sessionRef.current = session
    snapshotRef.current = session.snapshot()
    prevRef.current = streaming ? null : {
      mode: 'stable',
      content: stableProps?.content ?? '',
    }
  }

  const [, forceRender] = useReducer((value: number) => value + 1, 0)

  const streamingChunks = streamingProps?.chunks
  const stableContent = stableProps?.content
  useEffect(() => {
    const session = sessionRef.current
    if (!session) {
      return
    }

    const prev = prevRef.current
    let result: ApplyResult

    if (streaming && streamingProps) {
      result = applyStreamingProps(session, prev, streamingProps)
    } else if (stableProps) {
      result = applyStableProps(session, prev, stableProps)
    } else {
      return
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
  }, [
    streaming,
    streamingChunks,
    stableContent,
  ])

  const snapshot = snapshotRef.current ?? sessionRef.current?.snapshot()

  if (!snapshot) {
    return null
  }

  return (
    <Fragment>
      {snapshot.committedBlocks.map((block, index) => (
        <DefaultBlockView
          key={index}
          block={block}
          components={components}
          directives={directives}
        />
      ))}
      {renderBuffer(snapshot.bufferBlocks[0] ?? null)}
    </Fragment>
  )
}
