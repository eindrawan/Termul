import React from 'react'
import FileManager from '../components/FileManager'
import Terminal from '../components/Terminal'

export interface PluginTemplate {
    id: string // e.g., 'terminal', 'file-manager'
    label: string
    icon: string
    component: React.ComponentType<{ connectionId: string; isActive: boolean }>
}

export const AVAILABLE_PLUGINS: PluginTemplate[] = [
    {
        id: 'file-manager',
        label: 'File Manager',
        icon: '📁',
        component: FileManager
    },
    {
        id: 'terminal',
        label: 'Terminal',
        icon: '💻',
        component: Terminal
    }
]
