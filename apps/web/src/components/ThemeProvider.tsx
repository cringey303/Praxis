"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// We need to define types because next-themes doesn't export them nicely sometimes, 
// but actually we can just use React.ComponentProps
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
