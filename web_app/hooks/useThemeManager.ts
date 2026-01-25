// src/hooks/useThemeManager.ts
import { useState, useEffect, useCallback } from "react";

export const useThemeManager = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Determine initial theme preference
    const storedTheme =
      typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const prefersDark =
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : true;
    const initialIsDark =
      storedTheme === "dark" || (!storedTheme && prefersDark);
    setIsDark(initialIsDark);

    // Apply initial class to the root HTML element
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", initialIsDark);
      // Ensure the correct default BG is set based on the theme
      document.documentElement.style.backgroundColor = initialIsDark
        ? "rgb(9 9 11)"
        : "rgb(250 250 250)";
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const newIsDark = !prev;
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("theme", newIsDark ? "dark" : "light");
      }
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", newIsDark);
        // Zinc-950 for dark, Zinc-50 for light
        document.documentElement.style.backgroundColor = newIsDark
          ? "rgb(9 9 11)"
          : "rgb(250 250 250)";
      }
      return newIsDark;
    });
  }, []);

  return { isDark, toggleTheme };
};
