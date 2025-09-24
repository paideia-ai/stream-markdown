import { Fragment, memo } from 'react'
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
  type MarkdownBlock,
  type MarkdownMergeResult,
  mergeMarkdownState,
} from './markdown-state.ts'
import { useDerivedState } from './utils.ts'

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

type RenderBufferProp =
  | boolean
  | ((block: MarkdownBlock | null) => ReactNode)

type CommonRenderProps = {
  components?: MarkdownComponents
  directives?: MarkdownDirectiveComponents
  renderBuffer?: RenderBufferProp
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

type MarkdownBlockViewProps = {
  block: MarkdownBlock
  components?: MarkdownComponents
  directives?: MarkdownDirectiveComponents
}

export const MarkdownBlockView = memo(function MarkdownBlockView({
  block,
  components,
  directives,
}: MarkdownBlockViewProps) {
  return <>{renderBlockNode(block, components, directives)}</>
})

type MarkdownBlockListProps = {
  blocks: readonly MarkdownBlock[]
  components?: MarkdownComponents
  directives?: MarkdownDirectiveComponents
}

const MarkdownBlockList = memo(function MarkdownBlockList({
  blocks,
  components,
  directives,
}: MarkdownBlockListProps) {
  return (
    <>
      {blocks.map((block, index) => (
        <MarkdownBlockView
          key={index}
          block={block}
          components={components}
          directives={directives}
        />
      ))}
    </>
  )
})

export const MarkdownStream = (props: MarkdownStreamProps) => {
  const components = props.components
  const directives = props.directives

  const mergeResult = useDerivedState<MarkdownStreamProps, MarkdownMergeResult>(
    props,
    (previous, nextProps) => {
      const previousState = previous?.state
      if (nextProps.streaming === true) {
        return mergeMarkdownState(previousState, {
          chunks: nextProps.chunks,
          done: false,
        })
      }

      return mergeMarkdownState(previousState, {
        chunks: [nextProps.content ?? ''],
        done: true,
      })
    },
  )

  const renderBufferProp: RenderBufferProp | undefined = props.renderBuffer

  const renderBufferNode = (block: MarkdownBlock | null) => {
    if (renderBufferProp === true) {
      return block
        ? (
          <MarkdownBlockView
            block={block}
            components={components}
            directives={directives}
          />
        )
        : null
    }

    if (typeof renderBufferProp === 'function') {
      return renderBufferProp(block)
    }

    return null
  }

  const bufferBlock = mergeResult.bufferBlock ?? null

  return (
    <Fragment>
      <MarkdownBlockList
        blocks={mergeResult.committedBlocks}
        components={components}
        directives={directives}
      />
      {renderBufferNode(bufferBlock)}
    </Fragment>
  )
}
