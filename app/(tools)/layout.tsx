import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RCRS Internal Tools',
  description: 'River City Roofing Solutions — Internal Tools',
};

// Clean layout for internal tools — NO site header, footer, video, popups, analytics
export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo-nobg.png" type="image/png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${inter.className} bg-[#0a0a0f] text-white`}>
        {children}
      </body>
    </html>
  );
}
