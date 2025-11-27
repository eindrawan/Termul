import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export interface Plugin {
    id: string
    label: string
    icon: {
        outline: React.ComponentType<{ className?: string }>
        solid: React.ComponentType<{ className?: string }>
    }
    component: React.ComponentType<{ connectionId: string; isActive: boolean }>
}

interface PluginContextType {
    plugins: Map<string, Plugin>
    registerPlugin: (plugin: Plugin) => void
    unregisterPlugin: (id: string) => void
    getPlugins: () => Plugin[]
    getPlugin: (id: string) => Plugin | undefined
}

const PluginContext = createContext<PluginContextType | undefined>(undefined)

export function PluginProvider({ children }: { children: ReactNode }) {
    const [plugins, setPlugins] = useState<Map<string, Plugin>>(new Map())

    const registerPlugin = useCallback((plugin: Plugin) => {
        setPlugins(prev => {
            const newPlugins = new Map(prev)
            newPlugins.set(plugin.id, plugin)
            return newPlugins
        })
    }, [])

    const unregisterPlugin = useCallback((id: string) => {
        setPlugins(prev => {
            const newPlugins = new Map(prev)
            newPlugins.delete(id)
            return newPlugins
        })
    }, [])

    const getPlugins = useCallback(() => {
        return Array.from(plugins.values())
    }, [plugins])

    const getPlugin = useCallback((id: string) => {
        return plugins.get(id)
    }, [plugins])

    return (
        <PluginContext.Provider value={{
            plugins,
            registerPlugin,
            unregisterPlugin,
            getPlugins,
            getPlugin
        }}>
            {children}
        </PluginContext.Provider>
    )
}

export function usePlugin() {
    const context = useContext(PluginContext)
    if (!context) {
        throw new Error('usePlugin must be used within a PluginProvider')
    }
    return context
}
