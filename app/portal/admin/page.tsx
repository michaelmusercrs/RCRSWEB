'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, FileText, Users, Image as ImageIcon, Settings, ChevronRight,
  Globe, BookOpen, BarChart3, TrendingUp, Eye, Clock, Sparkles, Home,
  DollarSign, AlertTriangle
} from 'lucide-react';

export default function AdminPortal() {
  const [stats, setStats] = useState({ posts: 0, members: 0, images: 0 });

  useEffect(() => {
    // Load stats
    const loadStats = async () => {
      try {
        const [blogRes, teamRes] = await Promise.all([
          fetch('/api/cms/blog'),
          fetch('/api/cms/team'),
        ]);
        const [blogData, teamData] = await Promise.all([
          blogRes.json(),
          teamRes.json(),
        ]);
        setStats({
          posts: Array.isArray(blogData) ? blogData.length : 0,
          members: Array.isArray(teamData) ? teamData.length : 0,
          images: 100,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };
    loadStats();
  }, []);

  const adminSections = [
    {
      id: 'blog',
      title: 'Blog Posts',
      description: 'Create, edit, and publish articles',
      icon: FileText,
      href: '/portal/admin/blog',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      iconColor: '#3b82f6',
      stat: stats.posts,
      statLabel: 'articles',
    },
    {
      id: 'team',
      title: 'Team Members',
      description: 'Manage profiles, bios, and photos',
      icon: Users,
      href: '/portal/admin/team',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-500/10',
      iconColor: '#10b981',
      stat: stats.members,
      statLabel: 'members',
    },
    {
      id: 'images',
      title: 'Image Gallery',
      description: 'Upload and organize media files',
      icon: ImageIcon,
      href: '/portal/admin/images',
      color: 'from-violet-500 to-purple-500',
      bgColor: 'bg-violet-500/10',
      iconColor: '#8b5cf6',
      stat: stats.images,
      statLabel: 'images',
    },
    {
      id: 'areas',
      title: 'Service Areas',
      description: 'Manage cities and coverage zones',
      icon: Globe,
      href: '/portal/admin/areas',
      color: 'from-orange-500 to-amber-500',
      bgColor: 'bg-orange-500/10',
      iconColor: '#f97316',
      stat: '50+',
      statLabel: 'cities',
    },
    {
      id: 'pricing',
      title: 'Price Verification',
      description: 'Audit invoices & track overcharges',
      icon: DollarSign,
      href: '/portal/admin/pricing',
      color: 'from-red-500 to-rose-500',
      bgColor: 'bg-red-500/10',
      iconColor: '#ef4444',
      stat: '$0',
      statLabel: 'pending credits',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30">
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
                  href="/portal"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Admin Portal</h1>
                  <p className="text-sm text-neutral-400">Manage website content</p>
                </div>
              </div>
              <Link
                href="/"
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
              >
                <Home size={16} />
                View Site
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-12">
          {/* Welcome Section */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium mb-4">
              <Sparkles size={16} />
              Content Management
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
              Website Admin
            </h2>
            <p className="text-neutral-400 max-w-xl">
              Create and manage blog posts, team profiles, images, and service areas.
            </p>
          </div>

          {/* Admin Cards Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {adminSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.id}
                  href={section.href}
                  className="group relative overflow-hidden rounded-2xl border border-white/5 hover:border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 transition-all duration-300 hover:bg-white/[0.05] hover:scale-[1.02] hover:shadow-2xl"
                >
                  {/* Gradient Glow */}
                  <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${section.color} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                  <div className="relative z-10 flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 ${section.bgColor} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                        <Icon size={28} style={{ color: section.iconColor }} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-brand-green transition-colors">
                          {section.title}
                        </h3>
                        <p className="text-sm text-neutral-400 mb-3">
                          {section.description}
                        </p>
                        <div className="flex items-center text-sm text-neutral-500 group-hover:text-brand-green transition-colors">
                          <span>Manage</span>
                          <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{section.stat}</div>
                      <div className="text-xs text-neutral-500">{section.statLabel}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Training Portal Banner */}
          <Link
            href="/portal/admin/training"
            className="group relative block overflow-hidden rounded-2xl border border-brand-green/30 bg-gradient-to-r from-brand-green/10 via-emerald-500/5 to-cyan-500/10 p-6 transition-all duration-300 hover:border-brand-green/50 hover:shadow-2xl hover:shadow-brand-green/10"
          >
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand-green rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity" />

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-brand-green/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="text-brand-green" size={28} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-brand-green transition-colors">
                    Training Portal
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Learn how to use all features with interactive lessons
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-brand-green/20 text-brand-green text-xs font-medium">
                  New
                </span>
                <ChevronRight className="text-brand-green group-hover:translate-x-1 transition-transform" size={24} />
              </div>
            </div>
          </Link>

          {/* Quick Stats */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: FileText, label: 'Blog Posts', value: stats.posts, color: 'text-blue-400' },
              { icon: Users, label: 'Team Members', value: stats.members, color: 'text-emerald-400' },
              { icon: Globe, label: 'Service Areas', value: '50+', color: 'text-orange-400' },
              { icon: ImageIcon, label: 'Media Files', value: `${stats.images}+`, color: 'text-violet-400' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                <stat.icon size={20} className={`mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-neutral-500">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Recent Activity (placeholder) */}
          <div className="mt-12">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-neutral-400" />
              Quick Actions
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Link
                href="/portal/admin/blog"
                className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors"
              >
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <FileText size={18} className="text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Write New Post</div>
                  <div className="text-xs text-neutral-500">Create blog article</div>
                </div>
              </Link>
              <Link
                href="/portal/admin/team"
                className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors"
              >
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Users size={18} className="text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Add Team Member</div>
                  <div className="text-xs text-neutral-500">New employee profile</div>
                </div>
              </Link>
              <Link
                href="/portal/admin/images"
                className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors"
              >
                <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center">
                  <ImageIcon size={18} className="text-violet-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Upload Images</div>
                  <div className="text-xs text-neutral-500">Add new photos</div>
                </div>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 mt-12">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
              <p>River City Roofing Solutions - Admin Portal</p>
              <p>Data synced with Google Sheets</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
