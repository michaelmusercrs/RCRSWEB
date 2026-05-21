import { notFound } from 'next/navigation';
import Link from 'next/link';

interface WelcomeData {
  success: boolean;
  customer?: { name: string; address: string; city: string };
  rep?: {
    name: string;
    email: string;
    phone: string;
    bio: string;
    headshotUrl: string;
    truckPicUrl: string;
    certifications: string;
    yearsExperience: string;
    favoriteQuote: string;
  } | null;
  company?: {
    name: string;
    phone: string;
    website: string;
    certifications: string[];
    about: string;
  };
  links?: { ikoVisualizer: string; ourGallery: string; ourCertifications: string };
  welcome?: { thankYou: string; nextSteps: string };
}

async function loadWelcome(token: string): Promise<WelcomeData | null> {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://rivercityroofingsolutions.com';
    const res = await fetch(`${base}/api/customer/welcome/${encodeURIComponent(token)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function CustomerWelcomePage({ params }: { params: { token: string } }) {
  const data = await loadWelcome(params.token);
  if (!data || !data.success) return notFound();

  const rep = data.rep;
  const company = data.company!;
  const links = data.links!;
  const welcome = data.welcome!;
  const customer = data.customer!;
  const certs = rep?.certifications ? rep.certifications.split(',').map(s => s.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      {/* Hero */}
      <header className="bg-black text-white py-10 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Welcome{customer.name ? `, ${customer.name.split(' ')[0]}` : ''}.
          </h1>
          <p className="text-neutral-300 text-base sm:text-lg">{welcome.thankYou}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {/* Rep intro card */}
        {rep && (
          <section className="bg-white rounded-2xl shadow-md border border-neutral-200 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1.5 h-7 rounded-full bg-emerald-500" />
              <h2 className="text-xl font-bold text-neutral-900">Meet your roofing specialist</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {rep.headshotUrl ? (
                <img src={rep.headshotUrl} alt={rep.name} className="w-32 h-32 rounded-2xl object-cover border-2 border-neutral-100" />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">{rep.name.split(' ').map(p => p[0]).slice(0, 2).join('')}</div>
              )}
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-neutral-900">{rep.name}</h3>
                {rep.yearsExperience && (
                  <p className="text-sm text-neutral-500 mt-0.5">{rep.yearsExperience} in roofing</p>
                )}
                {rep.bio && <p className="text-neutral-700 mt-3 leading-relaxed">{rep.bio}</p>}
                {certs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {certs.map((c, i) => (
                      <span key={i} className="inline-block text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">{c}</span>
                    ))}
                  </div>
                )}
                {rep.favoriteQuote && (
                  <blockquote className="mt-3 text-neutral-600 italic text-sm border-l-2 border-emerald-500 pl-3">"{rep.favoriteQuote}"</blockquote>
                )}
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  {rep.phone && (
                    <a href={`tel:${rep.phone}`} className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors">
                      Call {rep.name.split(' ')[0]}: {rep.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {rep.truckPicUrl && (
              <div className="mt-6">
                <p className="text-sm text-neutral-500 mb-2">Look for this truck:</p>
                <img src={rep.truckPicUrl} alt={`${rep.name}'s truck`} className="rounded-xl border border-neutral-200 max-h-48 object-cover" />
              </div>
            )}
          </section>
        )}

        {/* Next steps */}
        <section className="bg-emerald-50 rounded-2xl border border-emerald-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-3">What happens next</h2>
          <p className="text-neutral-700 leading-relaxed">{welcome.nextSteps}</p>
        </section>

        {/* IKO visualizer */}
        <section className="bg-white rounded-2xl shadow-md border border-neutral-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-3">See what your roof could look like</h2>
          <p className="text-neutral-700 mb-4">IKO offers a free roof visualizer where you can upload a photo of your home and try different shingle colors and styles. It's a great way to start thinking about your next roof.</p>
          <a href={links.ikoVisualizer} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 rounded-xl bg-black text-white font-medium hover:bg-neutral-800 transition-colors">
            Open IKO Roof Visualizer →
          </a>
        </section>

        {/* About us */}
        <section className="bg-white rounded-2xl shadow-md border border-neutral-200 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-neutral-900 mb-3">About {company.name}</h2>
          <p className="text-neutral-700 leading-relaxed mb-4">{company.about}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {company.certifications.map((c, i) => (
              <span key={i} className="inline-block text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium">{c}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href={`tel:${company.phone}`} className="text-emerald-600 hover:underline font-medium">{company.phone}</a>
            <span className="text-neutral-400">·</span>
            <a href={company.website} className="text-emerald-600 hover:underline font-medium">rivercityroofingsolutions.com</a>
            <span className="text-neutral-400">·</span>
            <Link href={links.ourGallery} className="text-emerald-600 hover:underline font-medium">Our work</Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-neutral-500 pt-6">
          <p>This page was generated for {customer.name || 'you'}. Bookmark it — it stays accessible for as long as your project is open.</p>
        </footer>
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
