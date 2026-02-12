'use client';

/**
 * RCRS Command Center - Team Management
 *
 * Displays team member list with role-based access controls.
 * Sales reps can edit their own profiles (pending approval).
 * Admins can manage all team members.
 *
 * Role-based: Requires team.view permission
 */

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit2,
  Mail,
  Phone,
  Shield,
  Check,
  Clock,
  AlertCircle,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { TEAM_MEMBERS, TeamMember, ROLE_DISPLAY_NAMES, ROLE_COLORS, canManageTeam } from '@/lib/team-roles';
import { teamMembers as publicTeamData } from '@/lib/teamData';
import { cn } from '@/lib/utils';
import { TeamAccessManager } from '@/components/team-access/TeamAccessManager';

// Types for profile approval workflow
interface PendingEdit {
  memberId: string;
  changes: Partial<TeamMember>;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Simulated pending edits (would come from API in production)
const PENDING_EDITS: PendingEdit[] = [];

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const colorClasses: Record<string, string> = {
    owner: 'bg-purple-500/20 text-purple-400',
    admin: 'bg-red-500/20 text-red-400',
    office: 'bg-brand-green/20 text-blue-400',
    project_manager: 'bg-green-500/20 text-green-400',
    driver: 'bg-orange-500/20 text-orange-400',
    viewer: 'bg-zinc-500/20 text-zinc-400',
  };

  const displayName = ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES] || role;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
      colorClasses[role] || 'bg-zinc-500/20 text-zinc-400'
    )}>
      <Shield size={12} />
      {displayName}
    </span>
  );
}

// Status badge for pending edits
function EditStatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const styles = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    approved: 'bg-lime-500/20 text-lime-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  const icons = {
    pending: Clock,
    approved: Check,
    rejected: AlertCircle,
  };

  const Icon = icons[status];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
      styles[status]
    )}>
      <Icon size={12} />
      {status}
    </span>
  );
}

// Team member card component
interface TeamMemberCardProps {
  member: TeamMember;
  publicData?: typeof publicTeamData[0];
  canEdit: boolean;
  isOwnProfile: boolean;
  pendingEdit?: PendingEdit;
  onEditClick: (member: TeamMember) => void;
}

function TeamMemberCard({
  member,
  publicData,
  canEdit,
  isOwnProfile,
  pendingEdit,
  onEditClick,
}: TeamMemberCardProps) {
  const profileImage = publicData?.profileImage || '/uploads/placeholder-profile.png';

  return (
    <div className={cn(
      'rounded-xl border bg-zinc-900 p-5 transition-all',
      isOwnProfile ? 'border-lime-500/50 ring-1 ring-lime-500/20' : 'border-zinc-800',
      'hover:border-zinc-700'
    )}>
      <div className="flex items-start gap-4">
        {/* Profile Image */}
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
          <Image
            src={profileImage}
            alt={member.name}
            fill
            className="object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/uploads/placeholder-profile.png';
            }}
          />
          {isOwnProfile && (
            <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-lime-500 ring-2 ring-zinc-900" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white">{member.name}</h3>
              <RoleBadge role={member.role} />
            </div>
            {pendingEdit && (
              <EditStatusBadge status={pendingEdit.status} />
            )}
          </div>

          {/* Contact Info */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Mail size={14} className="text-zinc-500" />
              <a href={`mailto:${member.email}`} className="hover:text-lime-400">
                {member.email}
              </a>
            </div>
            {member.phone && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Phone size={14} className="text-zinc-500" />
                <a href={`tel:${member.phone}`} className="hover:text-lime-400">
                  {member.phone}
                </a>
              </div>
            )}
          </div>

          {/* Public Profile Link */}
          {publicData && (
            <Link
              href={`/team/${member.slug}`}
              className="mt-2 inline-flex text-sm text-lime-400 hover:text-lime-300"
            >
              View public profile &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      {(canEdit || isOwnProfile) && (
        <div className="mt-4 flex justify-end border-t border-zinc-800 pt-4">
          <button
            onClick={() => onEditClick(member)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isOwnProfile
                ? 'bg-lime-500 text-zinc-900 hover:bg-lime-400'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
            )}
          >
            <Edit2 size={14} />
            {isOwnProfile ? 'Edit My Profile' : 'Edit'}
          </button>
        </div>
      )}
    </div>
  );
}

// Edit profile modal
interface EditProfileModalProps {
  member: TeamMember | null;
  publicData?: typeof publicTeamData[0];
  isOwnProfile: boolean;
  canApprove: boolean;
  onClose: () => void;
  onSave: (changes: Partial<TeamMember>, requiresApproval: boolean) => void;
}

function EditProfileModal({
  member,
  publicData,
  isOwnProfile,
  canApprove,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [formData, setFormData] = React.useState({
    bio: publicData?.bio || '',
    tagline: publicData?.tagline || '',
    phone: member?.phone || '',
  });
  const [isSaving, setIsSaving] = React.useState(false);

  if (!member) return null;

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    // If not admin/owner, changes require approval
    const requiresApproval = !canApprove && isOwnProfile;
    onSave(formData, requiresApproval);
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 p-6">
        <h2 className="text-xl font-bold text-white">
          {isOwnProfile ? 'Edit My Profile' : `Edit ${member.name}`}
        </h2>

        {isOwnProfile && !canApprove && (
          <div className="mt-3 rounded-lg bg-yellow-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-yellow-400" />
              <p className="text-sm text-yellow-400">
                Profile changes require approval from Michael or Sara before going live.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400">Tagline</label>
            <input
              type="text"
              value={formData.tagline}
              onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
              placeholder="Your professional tagline..."
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400">Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={5}
              placeholder="Tell customers about yourself..."
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="256-555-1234"
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-lime-400 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/20 border-t-zinc-900" />
                Saving...
              </>
            ) : isOwnProfile && !canApprove ? (
              <>
                <Clock size={16} />
                Submit for Approval
              </>
            ) : (
              <>
                <Check size={16} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  const [editingMember, setEditingMember] = React.useState<TeamMember | null>(null);
  const [pendingEdits, setPendingEdits] = React.useState<PendingEdit[]>(PENDING_EDITS);
  const [activeTab, setActiveTab] = React.useState<'directory' | 'access'>('directory');

  // Check permissions
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'team.view');
  const canEdit = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'team.edit');
  const canApprove = user?.role === 'owner' || user?.role === 'admin';
  const showAccessTab = user?.role ? canManageTeam(user.role) : false;

  // Filter team members
  const filteredMembers = TEAM_MEMBERS.filter(member => {
    if (!member.isActive) return false;
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Get unique roles for filter
  const roles = ['all', ...new Set(TEAM_MEMBERS.filter(m => m.isActive).map(m => m.role))];

  // Handle save from edit modal
  const handleSaveProfile = (changes: Partial<TeamMember>, requiresApproval: boolean) => {
    if (requiresApproval && editingMember) {
      // Add to pending edits
      const newPendingEdit: PendingEdit = {
        memberId: editingMember.id,
        changes,
        submittedBy: user?.name || 'Unknown',
        submittedAt: new Date().toISOString(),
        status: 'pending',
      };
      setPendingEdits([...pendingEdits, newPendingEdit]);
      alert('Your changes have been submitted for approval. Michael or Sara will review them shortly.');
    } else {
      // Direct save (admin/owner)
      alert('Profile updated successfully!');
    }
    setEditingMember(null);
  };

  // Find public profile data for a team member
  const getPublicData = (member: TeamMember) => {
    return publicTeamData.find(p => p.slug === member.slug);
  };

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view Team Management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Management</h1>
          <p className="mt-1 text-zinc-400">
            View and manage team members
            {canApprove && ' • Review pending profile changes'}
          </p>
        </div>
        {canEdit && activeTab === 'directory' && (
          <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400">
            <Plus size={18} />
            Add Team Member
          </button>
        )}
      </div>

      {/* Tab Bar */}
      {showAccessTab && (
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('directory')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'directory'
                ? 'border-lime-500 text-lime-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            )}
          >
            <Users size={16} />
            Team Directory
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'access'
                ? 'border-lime-500 text-lime-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            )}
          >
            <ShieldCheck size={16} />
            Access Control
          </button>
        </div>
      )}

      {/* Access Control Tab */}
      {activeTab === 'access' && showAccessTab && (
        <TeamAccessManager />
      )}

      {/* Team Directory Tab */}
      {activeTab === 'directory' && <>

      {/* Pending Approvals Banner (for admins) */}
      {canApprove && pendingEdits.filter(e => e.status === 'pending').length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-400">
                {pendingEdits.filter(e => e.status === 'pending').length} profile change(s) pending approval
              </p>
              <p className="text-sm text-yellow-400/70">
                Review and approve or reject team member profile updates
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-zinc-500" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
          >
            {roles.map(role => (
              <option key={role} value={role}>
                {role === 'all' ? 'All Roles' : ROLE_DISPLAY_NAMES[role as keyof typeof ROLE_DISPLAY_NAMES] || role}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-medium text-zinc-400">Total Team Members</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {TEAM_MEMBERS.filter(m => m.isActive).length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-medium text-zinc-400">Sales Reps</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {publicTeamData.filter(m => m.category === 'Regional Partner').length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-medium text-zinc-400">Office Staff</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {TEAM_MEMBERS.filter(m => m.role === 'office' && m.isActive).length}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-medium text-zinc-400">Drivers</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {TEAM_MEMBERS.filter(m => m.role === 'driver' && m.isActive).length}
          </p>
        </div>
      </div>

      {/* Team Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member) => {
          const publicData = getPublicData(member);
          const isOwnProfile = user?.userId === member.id || user?.email === member.email;
          const pendingEdit = pendingEdits.find(e => e.memberId === member.id && e.status === 'pending');

          return (
            <TeamMemberCard
              key={member.id}
              member={member}
              publicData={publicData}
              canEdit={canEdit}
              isOwnProfile={isOwnProfile}
              pendingEdit={pendingEdit}
              onEditClick={setEditingMember}
            />
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-zinc-600" />
            <p className="mt-2 text-zinc-400">No team members found</p>
          </div>
        </div>
      )}

      </>}

      {/* Edit Modal */}
      {editingMember && (
        <EditProfileModal
          member={editingMember}
          publicData={getPublicData(editingMember)}
          isOwnProfile={user?.userId === editingMember.id || user?.email === editingMember.email}
          canApprove={canApprove}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
