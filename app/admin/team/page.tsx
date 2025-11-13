/**
 * Team Admin Page
 * Manage team members - add, edit, delete, reorder
 */

import TeamManageClient from './TeamManageClient';

export default function TeamAdminPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
        <p className="text-gray-600 mt-2">
          Manage your team members - add, edit, delete, and reorder
        </p>
      </div>

      {/* Client Component */}
      <TeamManageClient />
    </div>
  );
}
