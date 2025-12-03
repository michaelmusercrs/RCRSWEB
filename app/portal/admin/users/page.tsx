'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Users, Plus, Search, Shield, Key, Lock, Unlock,
  Mail, Edit2, Trash2, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, Loader2, User, Copy
} from 'lucide-react';
import { TEAM_MEMBERS, type TeamRole, ROLE_DISPLAY_NAMES, ROLE_COLORS } from '@/lib/team-roles';
import {
  getAllUsers, resetPassword, unlockUser, createUser, deactivateUser,
  DEFAULT_TEMP_PASSWORDS, generateTempPassword
} from '@/lib/user-management';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  isActive: boolean;
  lastLogin?: string;
  mustChangePassword: boolean;
  isLocked: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // New user form
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'viewer' as TeamRole,
    pin: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    // Get users from the user management service
    const userList = getAllUsers();
    setUsers(userList);
    setIsLoading(false);
  };

  const handleResetPassword = (user: UserData) => {
    const result = resetPassword(user.id);
    if (result.success && result.tempPassword) {
      setTempPassword(result.tempPassword);
      setSelectedUser(user);
      setShowPasswordModal(true);
      loadUsers();
    }
  };

  const handleUnlockUser = (userId: string) => {
    const result = unlockUser(userId);
    if (result.success) {
      loadUsers();
    }
  };

  const handleDeactivateUser = (userId: string) => {
    if (confirm('Are you sure you want to deactivate this user?')) {
      const result = deactivateUser(userId);
      if (result.success) {
        loadUsers();
      }
    }
  };

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email) {
      alert('Please fill in all required fields');
      return;
    }

    const result = createUser({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      pin: newUser.role === 'driver' ? newUser.pin : undefined,
    });

    if (result.success) {
      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setSelectedUser({ ...result.user!, isLocked: false, mustChangePassword: true });
        setShowPasswordModal(true);
      }
      setShowAddModal(false);
      setNewUser({ name: '', email: '', role: 'viewer', pin: '' });
      loadUsers();
    } else {
      alert(result.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-brand-green" size={48} />
          <p className="text-neutral-400 mt-4">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/admin/operations"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Users className="text-purple-400" size={22} />
                    User Management
                  </h1>
                  <p className="text-sm text-neutral-400">Manage team members and access</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={loadUsers}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-green text-black font-medium text-sm"
                >
                  <Plus size={16} />
                  Add User
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-10 pr-4 py-2 text-white"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-2 text-white"
            >
              <option value="">All Roles</option>
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="office">Office</option>
              <option value="project_manager">Project Manager</option>
              <option value="driver">Driver</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* User List */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Last Login</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${ROLE_COLORS[user.role]}/20 flex items-center justify-center`}>
                            <User className={`${ROLE_COLORS[user.role].replace('bg-', 'text-')}`} size={18} />
                          </div>
                          <div>
                            <p className="text-white font-medium">{user.name}</p>
                            <p className="text-neutral-400 text-sm">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]} text-white`}>
                          {ROLE_DISPLAY_NAMES[user.role]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {!user.isActive ? (
                            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">Inactive</span>
                          ) : user.isLocked ? (
                            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs flex items-center gap-1">
                              <Lock size={12} />
                              Locked
                            </span>
                          ) : user.mustChangePassword ? (
                            <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">Temp Password</span>
                          ) : (
                            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-neutral-400 text-sm">
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {user.role !== 'driver' && (
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                              title="Reset Password"
                            >
                              <Key size={16} />
                            </button>
                          )}
                          {user.isLocked && (
                            <button
                              onClick={() => handleUnlockUser(user.id)}
                              className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                              title="Unlock Account"
                            >
                              <Unlock size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeactivateUser(user.id)}
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                            title="Deactivate User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Default Passwords Info */}
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-yellow-400 font-medium">Default Temporary Passwords</p>
                <p className="text-yellow-300/70 text-sm mt-1">
                  Users must change their password on first login. Current temp passwords:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                  {Object.entries(DEFAULT_TEMP_PASSWORDS).filter(([, pwd]) => pwd).map(([userId, pwd]) => (
                    <div key={userId} className="flex items-center justify-between bg-yellow-500/10 rounded-lg px-3 py-2">
                      <span className="text-yellow-300 text-sm capitalize">{userId}:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-yellow-400 text-xs">{pwd}</code>
                        <button
                          onClick={() => copyToClipboard(pwd)}
                          className="text-yellow-400 hover:text-yellow-300"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-6">Add New User</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                  placeholder="john@rivercityroofingsolutions.com"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Role *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as TeamRole })}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="driver">Driver</option>
                  <option value="project_manager">Project Manager</option>
                  <option value="office">Office Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {newUser.role === 'driver' && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">PIN (4 digits) *</label>
                  <input
                    type="text"
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white"
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-brand-green text-black font-medium rounded-lg"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key className="text-green-400" size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">Password Reset</h2>
              <p className="text-neutral-400 mt-2">
                New temporary password for {selectedUser.name}:
              </p>
            </div>

            <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex items-center justify-between mb-6">
              <code className="text-xl font-mono text-brand-green">
                {showPassword ? tempPassword : '••••••••'}
              </code>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-2 text-neutral-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  onClick={() => copyToClipboard(tempPassword)}
                  className="p-2 text-neutral-400 hover:text-white"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>

            <p className="text-neutral-400 text-sm text-center mb-6">
              The user will be required to change this password on first login.
            </p>

            <button
              onClick={() => {
                setShowPasswordModal(false);
                setTempPassword('');
                setSelectedUser(null);
                setShowPassword(false);
              }}
              className="w-full px-4 py-3 bg-brand-green text-black font-medium rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
