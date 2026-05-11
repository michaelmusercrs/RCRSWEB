export const metadata = {
  title: 'RCRS 2026 H1 Trip Program',
};

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0e14' }}>{children}</body>
    </html>
  );
}
