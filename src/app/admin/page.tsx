'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Users, 
  Image, 
  FileText, 
  MessageSquare, 
  Settings, 
  MapPin,
  Upload,
  Eye,
  BarChart
} from 'lucide-react';

export default function AdminDashboard() {
  const adminSections = [
    {
      title: 'Team Members',
      description: 'Add, edit, or remove team member profiles and photos',
      icon: Users,
      href: '/admin/team',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Image Manager',
      description: 'Upload and organize all site images in one place',
      icon: Image,
      href: '/admin/images',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Blog Posts',
      description: 'Create, edit, and publish blog articles',
      icon: FileText,
      href: '/admin/blog',
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Reviews',
      description: 'Manage customer testimonials and reviews',
      icon: MessageSquare,
      href: '/admin/reviews',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'Service Areas',
      description: 'Update location pages and service area content',
      icon: MapPin,
      href: '/admin/locations',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      title: 'Site Settings',
      description: 'Configure contact info, forms, and general settings',
      icon: Settings,
      href: '/admin/settings',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
  ];

  const quickActions = [
    {
      label: 'Upload Images',
      icon: Upload,
      href: '/admin/images/upload',
      variant: 'default' as const,
    },
    {
      label: 'Preview Site',
      icon: Eye,
      href: '/',
      variant: 'outline' as const,
    },
    {
      label: 'View Analytics',
      icon: BarChart,
      href: '/admin/analytics',
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">
          Admin Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage all aspects of River City Roofing Solutions website
        </p>
      </div>

      {/* Quick Actions */}
      <Card className="mb-8 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get things done fast</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {quickActions.map((action) => (
              <Button key={action.label} asChild variant={action.variant} size="lg">
                <Link href={action.href} className="flex items-center gap-2">
                  <action.icon className="h-5 w-5" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {adminSections.map((section) => (
          <Link key={section.title} href={section.href}>
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer">
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${section.bgColor} flex items-center justify-center mb-4`}>
                  <section.icon className={`h-6 w-6 ${section.color}`} />
                </div>
                <CardTitle className="text-xl">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full">
                  Manage →
                </Button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity (placeholder for future) */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest changes to your website</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Activity tracking coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
