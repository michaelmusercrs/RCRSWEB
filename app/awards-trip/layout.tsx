import '../globals.css';

export const metadata = {
  title: 'Awards Trip Tracker',
};

const SW_NUKE = `
(function() {
  try {
    var key = '__awards_trip_sw_nuked_v1';
    if (sessionStorage.getItem(key)) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        var had = regs.length > 0;
        Promise.all(regs.map(function(r) { return r.unregister(); })).then(function() {
          var clearCaches = window.caches
            ? caches.keys().then(function(keys) {
                return Promise.all(keys.map(function(k) { return caches.delete(k); }));
              })
            : Promise.resolve();
          clearCaches.then(function() {
            sessionStorage.setItem(key, '1');
            if (had) location.reload();
          });
        });
      });
    }
  } catch (e) {}
})();
`;

export default function AwardsTripLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: SW_NUKE }} />
      </head>
      <body className="bg-zinc-950 text-white">{children}</body>
    </html>
  );
}
