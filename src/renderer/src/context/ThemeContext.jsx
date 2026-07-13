import React, { createContext, useContext, useState, useEffect } from 'react'
import { themes } from '../themes'

const ThemeContext = createContext()

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('app-theme') || 'glass'
  })

  useEffect(() => {
    localStorage.setItem('app-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
    
    // Apply CSS variables
    const activeTheme = themes[theme] || themes['glass']
    if (activeTheme && activeTheme.colors) {
      Object.entries(activeTheme.colors).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value)
      })
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
