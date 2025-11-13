/**
 * Admin Dashboard
 * Overview and quick actions for admin panel
 */

import Link from 'next/link';
import { Upload, FileText, Users, Image, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  // Quick stats
  const stats = [
    {
      label: 'Total Images',
      value: '0',
      icon: Image,
      color: 'bg-blue-500',
    },
    {
      label: 'Blog Posts',
      value: '24',
      icon: FileText,
      color: 'bg-green-500',
    },
    {
      label: 'Team Members',
      value: '17',
      icon: Users,
      color: 'bg-purple-500',
    },
    {
      label: 'Page Views',
      value: '-',
      icon: TrendingUp,
      color: 'bg-orange-500',
    },
  ];

  // Quick actions
  const quickActions = [
    {
      title: 'Upload Image',
      description: 'Upload photos for blog posts, projects, or team members',
      href: '/admin/upload',
      icon: Upload,
      color: 'bg-[#00FF00]',
    },
    {
      title: 'Create Blog Post',
      description: 'Write and publish a new blog post',
      href: '/admin/blog',
      icon: FileText,
      color: 'bg-blue-600',
    },
    {
      title: 'Add Team Member',
      description: 'Add a new team member profile',
      href: '/admin/team',
      icon: Users,
      color: 'bg-purple-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome to River City Roofing Solutions admin panel
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                href={action.href}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start space-x-4">
                  <div className={`${action.color} p-3 rounded-lg flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{action.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <p className="text-gray-500 text-center py-8">No recent activity</p>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900">System Status: Operational</h3>
            <p className="text-sm text-blue-700 mt-1">
              All systems are running normally. Image upload functionality is ready to use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
