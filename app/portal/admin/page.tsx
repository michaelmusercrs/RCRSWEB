'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, FileText, Users, Image, Settings, ChevronRight,
  Edit, Plus, Trash2, Eye, Save, X, Upload, Globe
} from 'lucide-react';

export default function AdminPortal() {
  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/portal" className="text-neutral-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Admin Portal</h1>
            <p className="text-sm text-neutral-400">Manage website content</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="grid gap-4">
          {/* Blog Management */}
          <Link
            href="/portal/admin/blog"
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 hover:border-brand-green transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="text-blue-500" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-brand-green">Blog Posts</h2>
                  <p className="text-sm text-neutral-400">Create, edit, and manage blog articles</p>
                </div>
              </div>
              <ChevronRight className="text-neutral-500 group-hover:text-brand-green" size={20} />
            </div>
          </Link>

          {/* Team Management */}
          <Link
            href="/portal/admin/team"
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 hover:border-brand-green transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Users className="text-green-500" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-brand-green">Team Members</h2>
                  <p className="text-sm text-neutral-400">Update bios, photos, and contact info</p>
                </div>
              </div>
              <ChevronRight className="text-neutral-500 group-hover:text-brand-green" size={20} />
            </div>
          </Link>

          {/* Image Management */}
          <Link
            href="/portal/admin/images"
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 hover:border-brand-green transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Image className="text-purple-500" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-brand-green">Image Gallery</h2>
                  <p className="text-sm text-neutral-400">Upload and manage website images</p>
                </div>
              </div>
              <ChevronRight className="text-neutral-500 group-hover:text-brand-green" size={20} />
            </div>
          </Link>

          {/* Service Areas */}
          <Link
            href="/portal/admin/areas"
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 hover:border-brand-green transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Globe className="text-orange-500" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-brand-green">Service Areas</h2>
                  <p className="text-sm text-neutral-400">Manage cities and coverage areas</p>
                </div>
              </div>
              <ChevronRight className="text-neutral-500 group-hover:text-brand-green" size={20} />
            </div>
          </Link>

          {/* Site Settings */}
          <Link
            href="/portal/admin/settings"
            className="bg-neutral-800 border border-neutral-700 rounded-xl p-6 hover:border-brand-green transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-neutral-500/20 rounded-lg flex items-center justify-center">
                  <Settings className="text-neutral-400" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-brand-green">Site Settings</h2>
                  <p className="text-sm text-neutral-400">Company info, contact details, SEO</p>
                </div>
              </div>
              <ChevronRight className="text-neutral-500 group-hover:text-brand-green" size={20} />
            </div>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">25</div>
            <div className="text-sm text-neutral-400">Blog Posts</div>
          </div>
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">16</div>
            <div className="text-sm text-neutral-400">Team Members</div>
          </div>
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">50+</div>
            <div className="text-sm text-neutral-400">Service Areas</div>
          </div>
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">100+</div>
            <div className="text-sm text-neutral-400">Images</div>
          </div>
        </div>
      </div>
    </div>
  );
}
