import * as React from 'react'

export function useDerivedState<TProps, TState>(
  props: TProps,
  derive: (prevState: TState | undefined, props: TProps) => TState,
): TState {
  const stateRef = React.useRef<TState | undefined>(undefined)

  const nextState = derive(stateRef.current, props)
  stateRef.current = nextState

  return nextState
}
