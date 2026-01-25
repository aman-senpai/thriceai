// app/layout.tsx

import './globals.css' // Ensure your Tailwind CSS is imported here

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* ADD THIS LINE for Font Awesome Icons */}
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" 
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" 
          crossOrigin="anonymous" 
          referrerPolicy="no-referrer" 
        />
        {/* You can optionally add other meta tags here */}
      </head>
      <body>{children}</body>
    </html>
  )
}