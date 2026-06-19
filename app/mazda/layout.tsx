export const metadata = {
  title: 'Mazda 3 Diagnostic Assistant',
  description: 'Interactive step-by-step diagnostic workflow for a 3rd-gen Mazda 3 Skyactiv-G multi-cylinder misfire / limp-mode condition. Built from real XTOOL D7 scan data.',
  robots: { index: false, follow: false },
};

export default function MazdaLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0b0f14' }}>{children}</body>
    </html>
  );
}
