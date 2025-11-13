'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Users,
  MapPin,
  MessageSquare,
  FileText,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { testGitHubConnection } from '@/app/admin/dashboard/actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const adminSections = [
  {
    title: 'Team Members',
    description: 'Edit and manage your team profiles',
    icon: Users,
    href: '/admin/team',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    title: 'Locations',
    description: 'Update service area pages and content',
    icon: MapPin,
    href: '/admin/locations',
    color: 'bg-brand-green/10 text-brand-blue',
  },
  {
    title: 'Reviews',
    description: 'Manage customer testimonials',
    icon: MessageSquare,
    href: '/admin/reviews',
    color: 'bg-purple-500/10 text-purple-600',
  },
  {
    title: 'Blog Posts',
    description: 'Edit and manage blog articles',
    icon: FileText,
    href: '/admin/blog',
    color: 'bg-orange-500/10 text-orange-600',
  },
  {
    title: 'Form Settings',
    description: 'Configure contact form endpoint',
    icon: Settings,
    href: '/admin/forms',
    color: 'bg-red-500/10 text-red-600',
  },
];

export default function AdminDashboard() {
  const [gitHubStatus, setGitHubStatus] = useState<{
    connected: boolean;
    user?: string;
    message: string;
    loading: boolean;
  }>({ connected: false, message: '', loading: true });

  useEffect(() => {
    async function checkConnection() {
      const result = await testGitHubConnection();
      setGitHubStatus({
        connected: result.success,
        user: result.user,
        message: result.message,
        loading: false,
      });
    }

    checkConnection();
  }, []);

  return (
    <div className="container mx-auto px-4 py-12">
      <section className="text-center mb-12">
        <h1 className="font-headline text-4xl md:text-5xl font-bold mb-4">
          Admin Dashboard
        </h1>
        <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
          Manage your website content, team, and settings from here.
        </p>
      </section>

      {/* GitHub Connection Status */}
      <Card className="max-w-2xl mx-auto mb-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {gitHubStatus.loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : gitHubStatus.connected ? (
              <CheckCircle className="h-5 w-5 text-brand-blue" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            GitHub Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gitHubStatus.loading ? (
            <p className="text-muted-foreground">Checking connection...</p>
          ) : gitHubStatus.connected ? (
            <div className="space-y-3">
              <p className="text-brand-blue font-semibold">✓ Connected</p>
              <p className="text-muted-foreground">
                Logged in as: <span className="font-mono">{gitHubStatus.user}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Your changes will automatically commit to GitHub and deploy to Vercel.
              </p>
            </div>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>GitHub Not Connected</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-3">{gitHubStatus.message}</p>
                <div className="bg-black/20 p-3 rounded text-sm font-mono mb-3">
                  Error: {gitHubStatus.message}
                </div>
                <p className="mb-3 font-semibold">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>
                    Go to{' '}
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      GitHub Settings → Personal Access Tokens
                    </a>
                  </li>
                  <li>Create a new token with repo permissions</li>
                  <li>Copy the token</li>
                  <li>
                    Go to Vercel Dashboard → Project Settings → Environment Variables
                  </li>
                  <li>
                    Add a new variable: Name = <code>GITHUB_TOKEN</code>, Value = your token
                  </li>
                  <li>Redeploy your Vercel project</li>
                  <li>Return here and refresh</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="h-full hover:border-primary/50 transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className={`w-fit p-3 rounded-lg mb-4 ${section.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{section.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Quick Start Guide */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <p className="text-muted-foreground">
                This admin panel lets you edit your website content without touching code.
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong>Team Members:</strong> Add/edit/delete team profiles
                </li>
                <li>
                  <strong>Locations:</strong> Update service area pages
                </li>
                <li>
                  <strong>Reviews:</strong> Manage customer testimonials
                </li>
                <li>
                  <strong>Blog Posts:</strong> Edit blog articles
                </li>
                <li>
                  <strong>Forms:</strong> Configure where form submissions go
                </li>
              </ul>
            </TabsContent>

            <TabsContent value="workflow" className="space-y-3">
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Click a section above (e.g., "Team Members")</li>
                <li>Make your changes in the edit form</li>
                <li>Click "Publish to GitHub"</li>
                <li>Your changes automatically commit and deploy to Vercel</li>
                <li>Your live site updates within 1-2 minutes</li>
              </ol>
            </TabsContent>

            <TabsContent value="troubleshooting" className="space-y-3">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold mb-1">Changes not appearing?</p>
                  <p className="text-sm text-muted-foreground">
                    Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R). Vercel
                    deployments take 1-2 minutes.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Publish button doesn't work?</p>
                  <p className="text-sm text-muted-foreground">
                    Check the GitHub connection status above. You need GITHUB_TOKEN set in
                    Vercel environment variables.
                  </p>
                </div>
                <div>
                  <p className="font-semibold mb-1">Can't find a field to edit?</p>
                  <p className="text-sm text-muted-foreground">
                    Some advanced edits may need direct file editing. Contact your developer
                    for complex changes.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
