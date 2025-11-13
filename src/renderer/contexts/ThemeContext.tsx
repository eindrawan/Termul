import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

interface ThemeProviderProps {
    children: ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        // Check localStorage for saved theme preference
        const savedTheme = localStorage.getItem('theme') as Theme | null
        return savedTheme || 'light' // Default to light theme
    })

    useEffect(() => {
        // Update localStorage when theme changes
        localStorage.setItem('theme', theme)

        // Update document class for CSS targeting
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(theme)
    }, [theme])

    const toggleTheme = () => {
        setThemeState(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
    }

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}