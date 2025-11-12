import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'

export type WindowState = 'normal' | 'minimized' | 'maximized'

export interface WindowConfig {
    id: string
    title: string
    subtitle?: string
    state: WindowState
    zIndex: number
    position: {
        x: number
        y: number
        width: number
        height: number
    }
    defaultPosition: {
        width: number
        height: number
    }
    minSize: {
        width: number
        height: number
    }
    content: ReactNode
    onClose?: () => void
}

interface WindowManagerState {
    windows: Map<string, WindowConfig>
    highestZIndex: number
    focusedWindowId: string | null
}

type WindowManagerAction =
    | { type: 'REGISTER_WINDOW'; payload: Omit<WindowConfig, 'zIndex' | 'state'> }
    | { type: 'UNREGISTER_WINDOW'; payload: { id: string } }
    | { type: 'FOCUS_WINDOW'; payload: { id: string } }
    | { type: 'MINIMIZE_WINDOW'; payload: { id: string } }
    | { type: 'MAXIMIZE_WINDOW'; payload: { id: string } }
    | { type: 'RESTORE_WINDOW'; payload: { id: string } }
    | { type: 'CLOSE_WINDOW'; payload: { id: string } }
    | { type: 'UPDATE_POSITION'; payload: { id: string; position: Partial<WindowConfig['position']> } }
    | { type: 'SET_STATE'; payload: { id: string; state: WindowState } }
    | { type: 'UPDATE_WINDOW'; payload: { id: string; updates: Partial<Omit<WindowConfig, 'id' | 'zIndex' | 'state'>> } }

interface WindowManagerContextType {
    state: WindowManagerState
    registerWindow: (config: Omit<WindowConfig, 'zIndex' | 'state'>) => void
    unregisterWindow: (id: string) => void
    focusWindow: (id: string) => void
    minimizeWindow: (id: string) => void
    maximizeWindow: (id: string) => void
    restoreWindow: (id: string) => void
    closeWindow: (id: string) => void
    updatePosition: (id: string, position: Partial<WindowConfig['position']>) => void
    updateWindow: (id: string, updates: Partial<Omit<WindowConfig, 'id' | 'zIndex' | 'state'>>) => void
    getWindow: (id: string) => WindowConfig | undefined
    getAllWindows: () => WindowConfig[]
}

const WindowManagerContext = createContext<WindowManagerContextType | undefined>(undefined)

function windowManagerReducer(state: WindowManagerState, action: WindowManagerAction): WindowManagerState {
    switch (action.type) {
        case 'REGISTER_WINDOW': {
            const newWindows = new Map(state.windows)
            const newZIndex = state.highestZIndex + 1

            // Center window on screen
            const centerX = (window.innerWidth - action.payload.defaultPosition.width) / 2
            const centerY = (window.innerHeight - action.payload.defaultPosition.height) / 2

            newWindows.set(action.payload.id, {
                ...action.payload,
                state: 'normal',
                zIndex: newZIndex,
                position: {
                    x: centerX,
                    y: centerY,
                    width: action.payload.defaultPosition.width,
                    height: action.payload.defaultPosition.height
                }
            })

            return {
                ...state,
                windows: newWindows,
                highestZIndex: newZIndex,
                focusedWindowId: action.payload.id
            }
        }

        case 'UNREGISTER_WINDOW': {
            const newWindows = new Map(state.windows)
            newWindows.delete(action.payload.id)

            return {
                ...state,
                windows: newWindows,
                focusedWindowId: state.focusedWindowId === action.payload.id ? null : state.focusedWindowId
            }
        }

        case 'FOCUS_WINDOW': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            const newZIndex = state.highestZIndex + 1

            newWindows.set(action.payload.id, {
                ...window,
                zIndex: newZIndex,
                state: window.state === 'minimized' ? 'normal' : window.state
            })

            return {
                ...state,
                windows: newWindows,
                highestZIndex: newZIndex,
                focusedWindowId: action.payload.id
            }
        }

        case 'MINIMIZE_WINDOW': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            newWindows.set(action.payload.id, {
                ...window,
                state: 'minimized'
            })

            return {
                ...state,
                windows: newWindows
            }
        }

        case 'MAXIMIZE_WINDOW': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            newWindows.set(action.payload.id, {
                ...window,
                state: 'maximized'
            })

            return {
                ...state,
                windows: newWindows
            }
        }

        case 'RESTORE_WINDOW': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            newWindows.set(action.payload.id, {
                ...window,
                state: 'normal'
            })

            return {
                ...state,
                windows: newWindows
            }
        }

        case 'CLOSE_WINDOW': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            // Call onClose callback if provided
            if (window.onClose) {
                window.onClose()
            }

            const newWindows = new Map(state.windows)
            newWindows.delete(action.payload.id)

            return {
                ...state,
                windows: newWindows,
                focusedWindowId: state.focusedWindowId === action.payload.id ? null : state.focusedWindowId
            }
        }

        case 'UPDATE_POSITION': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            newWindows.set(action.payload.id, {
                ...window,
                position: {
                    ...window.position,
                    ...action.payload.position
                }
            })

            return {
                ...state,
                windows: newWindows
            }
        }

        case 'SET_STATE': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            newWindows.set(action.payload.id, {
                ...window,
                state: action.payload.state
            })

            return {
                ...state,
                windows: newWindows
            }
        }

        case 'UPDATE_WINDOW': {
            const window = state.windows.get(action.payload.id)
            if (!window) return state

            const newWindows = new Map(state.windows)
            newWindows.set(action.payload.id, {
                ...window,
                ...action.payload.updates
            })

            return {
                ...state,
                windows: newWindows
            }
        }

        default:
            return state
    }
}

export function WindowManagerProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(windowManagerReducer, {
        windows: new Map(),
        highestZIndex: 1000,
        focusedWindowId: null
    })

    const registerWindow = useCallback((config: Omit<WindowConfig, 'zIndex' | 'state'>) => {
        dispatch({ type: 'REGISTER_WINDOW', payload: config })
    }, [])

    const unregisterWindow = useCallback((id: string) => {
        dispatch({ type: 'UNREGISTER_WINDOW', payload: { id } })
    }, [])

    const focusWindow = useCallback((id: string) => {
        dispatch({ type: 'FOCUS_WINDOW', payload: { id } })
    }, [])

    const minimizeWindow = useCallback((id: string) => {
        dispatch({ type: 'MINIMIZE_WINDOW', payload: { id } })
    }, [])

    const maximizeWindow = useCallback((id: string) => {
        dispatch({ type: 'MAXIMIZE_WINDOW', payload: { id } })
    }, [])

    const restoreWindow = useCallback((id: string) => {
        dispatch({ type: 'RESTORE_WINDOW', payload: { id } })
    }, [])

    const closeWindow = useCallback((id: string) => {
        dispatch({ type: 'CLOSE_WINDOW', payload: { id } })
    }, [])

    const updatePosition = useCallback((id: string, position: Partial<WindowConfig['position']>) => {
        dispatch({ type: 'UPDATE_POSITION', payload: { id, position } })
    }, [])

    const updateWindow = useCallback((id: string, updates: Partial<Omit<WindowConfig, 'id' | 'zIndex' | 'state'>>) => {
        dispatch({ type: 'UPDATE_WINDOW', payload: { id, updates } })
    }, [])

    const getWindow = useCallback((id: string) => {
        return state.windows.get(id)
    }, [state.windows])

    const getAllWindows = useCallback(() => {
        return Array.from(state.windows.values())
    }, [state.windows])

    return (
        <WindowManagerContext.Provider
            value={{
                state,
                registerWindow,
                unregisterWindow,
                focusWindow,
                minimizeWindow,
                maximizeWindow,
                restoreWindow,
                closeWindow,
                updatePosition,
                updateWindow,
                getWindow,
                getAllWindows
            }}
        >
            {children}
        </WindowManagerContext.Provider>
    )
}

export function useWindowManager() {
    const context = useContext(WindowManagerContext)
    if (!context) {
        throw new Error('useWindowManager must be used within a WindowManagerProvider')
    }
    return context
}

