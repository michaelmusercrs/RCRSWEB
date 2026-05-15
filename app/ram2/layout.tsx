export const metadata = {
  title: '2013 Ram 1500 Diagnostic Flowchart',
  description: 'Step-by-step decision tree for diagnosing oil pressure and cylinder 8 misfire on a 320k-mi 5.7L Hemi.',
  robots: { index: false, follow: false },
};

export default function RamLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0b0f14' }}>{children}</body>
    </html>
  );
}
