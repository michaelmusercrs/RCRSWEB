'use client';

/**
 * Public-site team-member profile self-service editor.
 *
 * Live at /profile on rivercityroofingsolutions.com (also accessible on
 * rcrsal.com per the middleware — same auth cookie works on both).
 *
 * Team members log in (existing /portal auth flow) then come here to submit
 * edits to their public /team/<slug> profile. ALL EDITS QUEUE FOR ADMIN REVIEW
 * — nothing applies automatically.
 *
 * What can be edited:
 *   - name, position, phone, bio, tagline
 *   - profile photo URL
 *   - truck make/model/color/license
 *   - publicVisibility toggle (hide from /team page)
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Truck,
  User as UserIcon,
  Camera,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { teamMembers, TeamMember } from '@/lib/teamData';

interface EditFormState {
  name: string;
  position: string;
  phone: string;
  bio: string;
  tagline: string;
  profileImage: string;
  truckMake: string;
  truckModel: string;
  truckColor: string;
  truckLicense: string;
  publicVisibility: boolean;
}

interface PendingEdit {
  id: string;
  submittedAt: string;
  status: string;
  fieldChanges: Partial<EditFormState>;
}

function emptyForm(member: TeamMember | null): EditFormState {
  return {
    name: member?.name || '',
    position: member?.position || '',
    phone: member?.phone || '',
    bio: member?.bio || '',
    tagline: member?.tagline || '',
    profileImage: member?.profileImage || '',
    truckMake: '',
    truckModel: '',
    truckColor: '',
    truckLicense: '',
    publicVisibility: true,
  };
}

export default function PublicProfileEditPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const teamMember = useMemo<TeamMember | null>(() => {
    if (!user) return null;
    const byEmail = teamMembers.find((m) => m.email.toLowerCase() === user.email.toLowerCase());
    if (byEmail) return byEmail;
    // Fall back to userId match if email isn't in teamData (e.g. impersonation slugs)
    return teamMembers.find((m) => m.slug === user.userId.toLowerCase()) || null;
  }, [user]);

  const [form, setForm] = useState<EditFormState>(emptyForm(null));
  const [initialForm, setInitialForm] = useState<EditFormState>(emptyForm(null));
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingPending, setLoadingPending] = useState(true);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/portal?next=/profile');
    }
  }, [authLoading, user, router]);

  // Seed the form from the canonical teamData record
  useEffect(() => {
    if (teamMember) {
      const seeded = emptyForm(teamMember);
      setForm(seeded);
      setInitialForm(seeded);
    }
  }, [teamMember]);

  // Load this user's pending + recent edits
  useEffect(() => {
    if (!teamMember) {
      setLoadingPending(false);
      return;
    }

    const loadPending = async () => {
      try {
        const res = await fetch(`/api/team-profile?slug=${encodeURIComponent(teamMember.slug)}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to load edit history');
        const data = await res.json();
        setPendingEdits(data.edits || []);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load edit history');
      } finally {
        setLoadingPending(false);
      }
    };

    loadPending();
  }, [teamMember]);

  const hasChanges = useMemo(() => {
    return (Object.keys(form) as Array<keyof EditFormState>).some(
      (k) => form[k] !== initialForm[k],
    );
  }, [form, initialForm]);

  const handleSubmit = async () => {
    if (!teamMember || !user) return;
    if (!hasChanges) {
      setSubmitMessage({ type: 'error', text: 'No changes to submit.' });
      return;
    }

    setSaving(true);
    setSubmitMessage(null);

    // Only send the fields that actually changed
    const fieldChanges: Partial<EditFormState> = {};
    const originalSnapshot: Partial<EditFormState> = {};
    (Object.keys(form) as Array<keyof EditFormState>).forEach((k) => {
      if (form[k] !== initialForm[k]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (fieldChanges as any)[k] = form[k];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (originalSnapshot as any)[k] = initialForm[k];
      }
    });

    try {
      const res = await fetch('/api/team-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          slug: teamMember.slug,
          fieldChanges,
          originalSnapshot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Submission failed (${res.status})`);
      }

      setSubmitMessage({
        type: 'success',
        text: 'Your edits have been submitted for admin review. You will see them on your profile once approved.',
      });
      // Re-seed initial form so further edits are tracked against this submitted state
      setInitialForm({ ...form });
      setPendingEdits((prev) => [data.edit, ...prev]);
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit edits. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || (user && !teamMember)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/60 text-white">
        <Loader2 className="animate-spin w-8 h-8 text-brand-green" />
      </div>
    );
  }

  if (!user) {
    return null; // useEffect already routed to /portal
  }

  if (!teamMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/60 text-white p-6">
        <div className="bg-white/10 border border-white/20 rounded-xl p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">No public profile linked</h2>
          <p className="text-gray-300 text-sm">
            Your account ({user.email}) is not linked to a public team-page profile. Ask an admin
            to add you to <code className="bg-black/40 px-1 rounded">lib/teamData.ts</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/70 py-10 px-4 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href={`/team/${teamMember.slug}`}
            className="inline-flex items-center gap-2 text-gray-300 hover:text-brand-green text-sm"
          >
            <ArrowLeft size={16} />
            View my public profile
          </Link>
          <span className="text-xs text-gray-500">Logged in as {user.email}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Edit My Profile</h1>
        <p className="text-gray-400 mb-8">
          Submit changes to your public profile at{' '}
          <Link
            href={`/team/${teamMember.slug}`}
            className="text-brand-green hover:underline"
          >
            /team/{teamMember.slug}
          </Link>
          . Every change is reviewed by an admin before going live.
        </p>

        {submitMessage && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              submitMessage.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {submitMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{submitMessage.text}</p>
          </div>
        )}

        {/* Pending edits */}
        {!loadingPending && pendingEdits.length > 0 && (
          <div className="mb-8 bg-white/5 border border-white/10 rounded-xl p-5">
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-yellow-400" />
              Submitted edits
            </h2>
            <ul className="space-y-2 text-sm">
              {pendingEdits.slice(0, 5).map((edit) => (
                <li key={edit.id} className="flex items-center justify-between gap-3 p-2 rounded bg-black/30">
                  <span className="text-gray-300">
                    {new Date(edit.submittedAt).toLocaleString()} —{' '}
                    {Object.keys(edit.fieldChanges).length} field
                    {Object.keys(edit.fieldChanges).length === 1 ? '' : 's'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      edit.status === 'APPROVED'
                        ? 'bg-green-500/15 text-green-400'
                        : edit.status === 'REJECTED'
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-yellow-500/15 text-yellow-400'
                    }`}
                  >
                    {edit.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loadError && (
          <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            Could not load previous edits: {loadError}
          </div>
        )}

        {/* Profile basics */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <UserIcon className="w-5 h-5 text-brand-green" />
            Basics
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
            />
            <Field
              label="Position / title"
              value={form.position}
              onChange={(v) => setForm({ ...form, position: v })}
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="256-555-1234"
            />
            <Field
              label="Tagline"
              value={form.tagline}
              onChange={(v) => setForm({ ...form, tagline: v })}
              placeholder="One-line summary"
            />
          </div>

          <label className="block mt-4">
            <span className="block text-sm text-gray-400 mb-1">Bio</span>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none text-sm"
            />
          </label>
        </section>

        {/* Photo */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <Camera className="w-5 h-5 text-brand-green" />
            Profile photo
          </h2>

          <div className="flex items-start gap-4">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-black/40 border border-white/10 relative flex-shrink-0">
              {form.profileImage ? (
                <Image
                  src={form.profileImage}
                  alt="Profile preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <UserIcon className="w-10 h-10 text-gray-500 m-auto absolute inset-0" />
              )}
            </div>

            <label className="flex-1">
              <span className="block text-sm text-gray-400 mb-1">Photo URL</span>
              <input
                type="url"
                value={form.profileImage}
                onChange={(e) => setForm({ ...form, profileImage: e.target.value })}
                placeholder="https://… or /uploads/yourphoto.jpg"
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload the file to /uploads first (via your portal admin), then paste the URL here.
              </p>
            </label>
          </div>
        </section>

        {/* Truck */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-brand-green" />
            My truck
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Shown to customers under &quot;Look for my truck&quot;. License plate is optional and only used
            internally — it will NOT be published publicly.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="Make"
              value={form.truckMake}
              onChange={(v) => setForm({ ...form, truckMake: v })}
              placeholder="Ford"
            />
            <Field
              label="Model"
              value={form.truckModel}
              onChange={(v) => setForm({ ...form, truckModel: v })}
              placeholder="F-150"
            />
            <Field
              label="Color"
              value={form.truckColor}
              onChange={(v) => setForm({ ...form, truckColor: v })}
              placeholder="Black"
            />
            <Field
              label="License plate (internal)"
              value={form.truckLicense}
              onChange={(v) => setForm({ ...form, truckLicense: v })}
              placeholder="ABC-1234"
            />
          </div>
        </section>

        {/* Visibility */}
        <section className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
            {form.publicVisibility ? (
              <Eye className="w-5 h-5 text-brand-green" />
            ) : (
              <EyeOff className="w-5 h-5 text-yellow-400" />
            )}
            Public visibility
          </h2>

          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-300">
              Show me on the public <code className="bg-black/40 px-1 rounded">/team</code> page
            </span>
            <button
              type="button"
              onClick={() => setForm({ ...form, publicVisibility: !form.publicVisibility })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.publicVisibility ? 'bg-brand-green' : 'bg-neutral-600'
              }`}
              role="switch"
              aria-checked={form.publicVisibility}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  form.publicVisibility ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </section>

        {/* Submit */}
        <div className="sticky bottom-4 bg-black/80 backdrop-blur border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {hasChanges
              ? 'Changes ready to submit. An admin will review them before they go live.'
              : 'No changes yet.'}
          </p>
          <button
            onClick={handleSubmit}
            disabled={!hasChanges || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-green text-black font-semibold rounded-lg hover:bg-brand-green/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Submit for review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-400 mb-1">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none text-sm"
      />
    </label>
  );
}
