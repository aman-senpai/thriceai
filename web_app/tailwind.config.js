module.exports = {
  // 👈 This line is critical for class-based dark mode
  darkMode: 'class', 
  content: [
    // Ensure all your file paths are correctly listed here
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
    './designConstants.ts', // If you use tailwind classes in this file, include it
  ],
  // ... rest of your config
}