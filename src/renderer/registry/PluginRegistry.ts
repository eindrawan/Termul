import React from 'react'
import {
    FolderIcon,
    CommandLineIcon,
    ServerIcon
} from '@heroicons/react/24/outline'
import {
    FolderIcon as FolderSolidIcon,
    CommandLineIcon as CommandLineSolidIcon,
    ServerIcon as ServerSolidIcon
} from '@heroicons/react/24/solid'
import FileManager from '../components/FileManager'
import Terminal from '../components/Terminal'

import DockerManager from '../components/DockerManager'

export interface PluginTemplate {
    id: string // e.g., 'terminal', 'file-manager'
    label: string
    icon: {
        outline: React.ComponentType<{ className?: string }>
        solid: React.ComponentType<{ className?: string }>
    }
    component: React.ComponentType<{ connectionId: string; isActive: boolean }>
}

export const AVAILABLE_PLUGINS: PluginTemplate[] = [
    {
        id: 'file-manager',
        label: 'File Manager',
        icon: {
            outline: FolderIcon,
            solid: FolderSolidIcon
        },
        component: FileManager
    },
    {
        id: 'terminal',
        label: 'Terminal',
        icon: {
            outline: CommandLineIcon,
            solid: CommandLineSolidIcon
        },
        component: Terminal
    },
    {
        id: 'docker',
        label: 'Docker',
        icon: {
            outline: ServerIcon,
            solid: ServerSolidIcon
        },
        component: DockerManager
    }
]
