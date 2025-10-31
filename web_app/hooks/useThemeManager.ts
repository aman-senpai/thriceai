// src/hooks/useThemeManager.ts
import { useState, useEffect, useCallback } from "react";

export const useThemeManager = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Determine initial theme preference
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem("theme") : null;
    const prefersDark = typeof window !== 'undefined' ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;
    const initialIsDark = storedTheme === "dark" || (!storedTheme && prefersDark);
    setIsDark(initialIsDark);

    // Apply initial class to the root HTML element
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle("dark", initialIsDark);
      // Ensure the correct default BG is set based on the theme
      document.documentElement.style.backgroundColor = initialIsDark ? 'rgb(17 24 39)' : 'rgb(249 250 251)';
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("theme", newIsDark ? "dark" : "light");
      }
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle("dark", newIsDark);
        document.documentElement.style.backgroundColor = newIsDark ? 'rgb(17 24 39)' : 'rgb(249 250 251)';
      }
      return newIsDark;
    });
  }, []);

  return { isDark, toggleTheme };
};