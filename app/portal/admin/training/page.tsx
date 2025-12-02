'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, ChevronDown, ChevronRight, CheckCircle2,
  FileText, Users, Image, Package, Truck, BarChart3,
  Play, Clock, Target, AlertCircle, HelpCircle, Phone, Mail,
  Sparkles, GraduationCap, Award
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';

type Section = {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  lessons: Lesson[];
};

type Lesson = {
  id: string;
  title: string;
  duration: string;
  content: string[];
  tips?: string[];
};

const trainingSections: Section[] = [
  {
    id: 'portal-overview',
    title: 'Portal Overview',
    icon: BookOpen,
    color: 'text-brand-green',
    bgColor: 'bg-brand-green/20',
    lessons: [
      {
        id: 'getting-started',
        title: 'Getting Started',
        duration: '5 min',
        content: [
          'The River City Roofing Portal is your central hub for managing all aspects of the business.',
          'Access the portal at: yoursite.com/portal',
          'From the main portal page, you can access:',
          '- Manager Dashboard: Orders, deliveries, analytics',
          '- Inventory Count: Weekly inventory and restock requests',
          '- Admin Portal: Blog, team, images, settings',
          '- Driver Portal: Delivery tracking (requires PIN login)',
        ],
        tips: [
          'Bookmark the portal page for quick access',
          'The portal works on phones and tablets too',
        ],
      },
      {
        id: 'navigation',
        title: 'Navigation Basics',
        duration: '3 min',
        content: [
          'Each section has a back arrow in the top-left corner to return to the previous page.',
          'Use the tabs at the top of each section to switch between different views.',
          'The refresh button (circular arrow) reloads data from the database.',
          'Most items are clickable - tap on cards to see more details or take actions.',
        ],
      },
    ],
  },
  {
    id: 'admin-blog',
    title: 'Blog Management',
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    lessons: [
      {
        id: 'view-posts',
        title: 'Viewing Blog Posts',
        duration: '3 min',
        content: [
          'Go to Admin Portal > Blog Posts',
          'You\'ll see a list of all blog articles with:',
          '- Title and publication date',
          '- Category (Maintenance, Insurance, etc.)',
          '- Status (Published/Draft)',
          '- Preview thumbnail',
          'Click any post to view or edit it.',
        ],
      },
      {
        id: 'create-post',
        title: 'Creating a New Post',
        duration: '5 min',
        content: [
          '1. Click the "New Post" button',
          '2. Fill in the required fields:',
          '   - Title: Clear, descriptive headline',
          '   - Slug: URL-friendly version (auto-generated)',
          '   - Category: Choose from dropdown',
          '   - Excerpt: Short summary (shown in listings)',
          '   - Content: Full article text',
          '3. Upload a featured image',
          '4. Set status to "Published" when ready',
          '5. Click "Save"',
        ],
        tips: [
          'Use keywords in your title for better SEO',
          'Keep excerpts under 160 characters',
          'Add images to break up long content',
        ],
      },
      {
        id: 'edit-post',
        title: 'Editing & Deleting Posts',
        duration: '3 min',
        content: [
          'To edit: Click on the post, make changes, click "Save"',
          'To delete: Click the trash icon (be careful - this is permanent!)',
          'To unpublish: Change status to "Draft"',
          'Changes are saved to Google Sheets automatically.',
        ],
      },
    ],
  },
  {
    id: 'admin-team',
    title: 'Team Management',
    icon: Users,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    lessons: [
      {
        id: 'view-team',
        title: 'Viewing Team Members',
        duration: '3 min',
        content: [
          'Go to Admin Portal > Team Members',
          'Team members are organized by category:',
          '- Leadership',
          '- Regional Partner',
          '- Production',
          '- Warehouse',
          'Each card shows name, role, and photo.',
        ],
      },
      {
        id: 'edit-member',
        title: 'Editing Team Profiles',
        duration: '5 min',
        content: [
          '1. Click on a team member card',
          '2. Edit their information:',
          '   - Name and role/title',
          '   - Bio (short description)',
          '   - Phone and email',
          '   - Category (determines where they appear)',
          '   - Display order (lower = first)',
          '3. Upload new photo if needed',
          '4. Click "Save Changes"',
        ],
        tips: [
          'Keep bios professional and friendly',
          'Use consistent photo sizes and styles',
          'Update display order to control who appears first',
        ],
      },
      {
        id: 'add-member',
        title: 'Adding New Team Members',
        duration: '3 min',
        content: [
          '1. Click "Add Team Member"',
          '2. Fill in all required fields',
          '3. Upload a professional headshot',
          '4. Set the correct category',
          '5. Click "Save"',
          'The new member will appear on the website team page.',
        ],
      },
    ],
  },
  {
    id: 'admin-images',
    title: 'Image Gallery',
    icon: Image,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    lessons: [
      {
        id: 'upload-images',
        title: 'Uploading Images',
        duration: '4 min',
        content: [
          'Go to Admin Portal > Image Gallery',
          '1. Click "Upload Image"',
          '2. Select file from your device',
          '3. Add a descriptive name',
          '4. Choose a category:',
          '   - Projects (before/after photos)',
          '   - Team (headshots)',
          '   - Services (service images)',
          '   - Blog (article images)',
          '5. Click "Upload"',
        ],
        tips: [
          'Use JPG for photos, PNG for logos/graphics',
          'Compress images before uploading for faster loading',
          'Use descriptive names (e.g., "smith-roof-after.jpg")',
        ],
      },
      {
        id: 'manage-images',
        title: 'Managing Images',
        duration: '3 min',
        content: [
          'Filter images by category using the dropdown',
          'Search by filename or description',
          'Click an image to:',
          '- Copy the URL for use in blog posts',
          '- Download the original file',
          '- Delete (if no longer needed)',
          'Images are stored and served from Google Sheets/Drive.',
        ],
      },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    icon: Package,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    lessons: [
      {
        id: 'view-inventory',
        title: 'Viewing Inventory',
        duration: '3 min',
        content: [
          'Go to Portal > Inventory Count',
          'The Inventory tab shows all tracked products:',
          '- Product name and SKU',
          '- Current quantity',
          '- Min/Max stock levels',
          '- Unit cost and supplier',
          'Items below minimum quantity show a red "LOW" badge.',
        ],
      },
      {
        id: 'weekly-count',
        title: 'Performing Weekly Count',
        duration: '5 min',
        content: [
          '1. Go to the "Weekly Count" tab',
          '2. Click "Start Count"',
          '3. For each product, enter actual quantity:',
          '   - Use +/- buttons or type directly',
          '   - Shows variance from expected',
          '4. Review all counts',
          '5. Click "Submit" to save',
          'Counts are logged with timestamp and who counted.',
        ],
        tips: [
          'Count at the same time each week for consistency',
          'Investigate large variances immediately',
          'Count by location/category for efficiency',
        ],
      },
      {
        id: 'restock',
        title: 'Restock Requests',
        duration: '4 min',
        content: [
          'When an item is low:',
          '1. Click "Request Restock" on the item',
          '2. Request is sent to the manager',
          '3. View pending requests in "Restock Requests" tab',
          'Request statuses:',
          '- Pending: Waiting for review',
          '- Approved: Ready to order',
          '- Ordered: Order placed with supplier',
          '- Received: Materials arrived and stocked',
        ],
      },
    ],
  },
  {
    id: 'manager',
    title: 'Manager Dashboard',
    icon: BarChart3,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    lessons: [
      {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        duration: '4 min',
        content: [
          'The Overview tab shows:',
          '- Today\'s Deliveries: Scheduled and completed',
          '- Pending Orders: Waiting to be scheduled',
          '- Low Stock Items: Links to inventory',
          '- Inventory Value: Total $ value',
          'Active Deliveries section shows in-progress deliveries.',
          'Driver Status shows who is available/on delivery.',
        ],
      },
      {
        id: 'create-order',
        title: 'Creating Material Orders',
        duration: '5 min',
        content: [
          '1. Click "Create Material Order"',
          '2. Fill in job details:',
          '   - Job name (e.g., "Smith Residence")',
          '   - Job address',
          '   - Customer name and phone',
          '   - Project manager',
          '3. List materials needed',
          '4. Add special instructions (gate codes, etc.)',
          '5. Set delivery date and priority',
          '6. Click "Create Order"',
        ],
      },
      {
        id: 'schedule-delivery',
        title: 'Scheduling Deliveries',
        duration: '3 min',
        content: [
          'Go to the Orders tab',
          'Find a "Pending" order',
          'Select a driver from the dropdown',
          'The delivery is automatically scheduled',
          'Driver will see it in their portal',
        ],
        tips: [
          'Check driver availability before assigning',
          'Consider delivery routes for efficiency',
          'Rush/Urgent orders should be prioritized',
        ],
      },
    ],
  },
  {
    id: 'driver',
    title: 'Driver Portal',
    icon: Truck,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/20',
    lessons: [
      {
        id: 'driver-login',
        title: 'Driver Login',
        duration: '2 min',
        content: [
          'Go to Portal main page',
          'Enter your 4-digit PIN',
          'Click "Login"',
          'You\'ll see your deliveries for today',
          'To logout, tap "Logout" in the header',
        ],
      },
      {
        id: 'delivery-workflow',
        title: 'Delivery Workflow',
        duration: '5 min',
        content: [
          'Each delivery follows this workflow:',
          '',
          '1. SCHEDULED - Delivery assigned to you',
          '   - Review materials list',
          '   - Load truck at warehouse',
          '',
          '2. CONFIRM LOAD - Tap when loaded',
          '   - Verify all materials on truck',
          '   - Tap "Confirm Load"',
          '',
          '3. EN ROUTE - Tap when leaving',
          '   - Tap "Start Delivery"',
          '   - Use "Open in Maps" for navigation',
          '',
          '4. ARRIVED - Tap when at job site',
          '   - Tap "Mark Arrived"',
          '   - Customer is notified',
          '',
          '5. DELIVERED - Tap when done',
          '   - Take photos if needed',
          '   - Tap "Complete Delivery"',
        ],
      },
      {
        id: 'driver-tips',
        title: 'Tips & Best Practices',
        duration: '3 min',
        content: [
          'Always verify materials before confirming load',
          'Take photos of:',
          '- Material condition before leaving',
          '- Delivery location on site',
          '- Any damage or issues',
          'Call customer if running late',
          'Report any problems immediately',
          'Keep your phone charged!',
        ],
      },
    ],
  },
];

export default function AdminTrainingPage() {
  const [expandedSection, setExpandedSection] = useState<string | null>('portal-overview');
  const [expandedLesson, setExpandedLesson] = useState<string | null>('getting-started');
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const toggleLesson = (lessonId: string) => {
    setExpandedLesson(expandedLesson === lessonId ? null : lessonId);
  };

  const markComplete = (lessonId: string) => {
    if (!completedLessons.includes(lessonId)) {
      setCompletedLessons([...completedLessons, lessonId]);
    }
  };

  const totalLessons = trainingSections.reduce((acc, s) => acc + s.lessons.length, 0);
  const progressPercent = Math.round((completedLessons.length / totalLessons) * 100);

  return (
    <AdminLayout
      title="Training Portal"
      subtitle="Learn how to use all portal features"
      actions={
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-green">{progressPercent}%</div>
            <div className="text-xs text-neutral-400">{completedLessons.length}/{totalLessons} lessons</div>
          </div>
          {progressPercent === 100 && (
            <div className="w-10 h-10 rounded-xl bg-brand-green/20 flex items-center justify-center">
              <Award className="text-brand-green" size={20} />
            </div>
          )}
        </div>
      }
    >
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-brand-green to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Quick Start Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-brand-green/10 via-emerald-500/10 to-cyan-500/10 border border-brand-green/20 rounded-2xl p-6 mb-8">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-green rounded-full blur-3xl opacity-10" />
        <div className="relative flex items-start gap-5">
          <div className="w-14 h-14 bg-brand-green/20 rounded-2xl flex items-center justify-center flex-shrink-0">
            <GraduationCap className="text-brand-green" size={28} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to Training!</h2>
            <p className="text-neutral-300 text-sm mb-4 leading-relaxed">
              This guide will teach you how to use all features of the River City Roofing portal system.
              Complete each lesson and mark it done to track your progress.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-300 flex items-center gap-2">
                <Clock size={14} className="text-neutral-400" /> ~45 min total
              </span>
              <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-300 flex items-center gap-2">
                <BookOpen size={14} className="text-neutral-400" /> {totalLessons} lessons
              </span>
              <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-neutral-300 flex items-center gap-2">
                <Target size={14} className="text-neutral-400" /> 7 sections
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Training Sections */}
      <div className="space-y-4">
        {trainingSections.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;
          const sectionComplete = section.lessons.every(l => completedLessons.includes(l.id));
          const sectionProgress = section.lessons.filter(l => completedLessons.includes(l.id)).length;

          return (
            <div key={section.id} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${section.bgColor} rounded-xl flex items-center justify-center`}>
                    <Icon className={section.color} size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-white text-lg">{section.title}</h3>
                    <p className="text-sm text-neutral-400 flex items-center gap-2">
                      {sectionProgress}/{section.lessons.length} lessons
                      {sectionComplete && <CheckCircle2 className="text-brand-green" size={14} />}
                    </p>
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-lg ${isExpanded ? 'bg-white/10' : 'bg-white/5'} flex items-center justify-center transition-colors`}>
                  {isExpanded ? (
                    <ChevronDown className="text-neutral-400" size={18} />
                  ) : (
                    <ChevronRight className="text-neutral-400" size={18} />
                  )}
                </div>
              </button>

              {/* Section Lessons */}
              {isExpanded && (
                <div className="border-t border-white/5">
                  {section.lessons.map((lesson, idx) => {
                    const isLessonExpanded = expandedLesson === lesson.id;
                    const isComplete = completedLessons.includes(lesson.id);

                    return (
                      <div key={lesson.id} className={idx > 0 ? 'border-t border-white/5' : ''}>
                        {/* Lesson Header */}
                        <button
                          onClick={() => toggleLesson(lesson.id)}
                          className="w-full p-4 pl-8 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                              isComplete
                                ? 'bg-brand-green'
                                : 'bg-white/5 border border-white/10'
                            }`}>
                              {isComplete ? (
                                <CheckCircle2 className="text-black" size={14} />
                              ) : (
                                <Play className="text-neutral-400" size={10} />
                              )}
                            </div>
                            <span className={`font-medium ${isComplete ? 'text-brand-green' : 'text-white'}`}>
                              {lesson.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-neutral-500 px-2 py-1 bg-white/5 rounded-lg">
                              {lesson.duration}
                            </span>
                            {isLessonExpanded ? (
                              <ChevronDown className="text-neutral-400" size={16} />
                            ) : (
                              <ChevronRight className="text-neutral-400" size={16} />
                            )}
                          </div>
                        </button>

                        {/* Lesson Content */}
                        {isLessonExpanded && (
                          <div className="px-8 pb-5 pl-16">
                            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 mb-4">
                              {lesson.content.map((line, i) => (
                                <p key={i} className={`text-sm leading-relaxed ${
                                  line.startsWith('-') || line.startsWith('   -')
                                    ? 'text-neutral-400 pl-4'
                                    : line === ''
                                      ? 'h-3'
                                      : 'text-neutral-300'
                                } ${i > 0 ? 'mt-2' : ''}`}>
                                  {line}
                                </p>
                              ))}
                            </div>

                            {lesson.tips && lesson.tips.length > 0 && (
                              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 mb-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Sparkles className="text-blue-400" size={16} />
                                  <span className="text-sm font-medium text-blue-400">Pro Tips</span>
                                </div>
                                {lesson.tips.map((tip, i) => (
                                  <p key={i} className="text-sm text-blue-300/80 pl-6 mt-1.5 leading-relaxed">
                                    - {tip}
                                  </p>
                                ))}
                              </div>
                            )}

                            <button
                              onClick={() => markComplete(lesson.id)}
                              disabled={isComplete}
                              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                isComplete
                                  ? 'bg-brand-green/20 text-brand-green cursor-default'
                                  : 'bg-gradient-to-r from-brand-green to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black shadow-lg shadow-brand-green/25'
                              }`}
                            >
                              {isComplete ? 'Completed!' : 'Mark as Complete'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="mt-10 bg-white/[0.02] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-brand-green/20 rounded-xl flex items-center justify-center">
            <HelpCircle className="text-brand-green" size={20} />
          </div>
          <h3 className="text-lg font-bold text-white">Need Help?</h3>
        </div>
        <p className="text-neutral-400 text-sm mb-5 leading-relaxed">
          If you have questions or run into issues, reach out to your manager or the admin team.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="tel:256-274-8530"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium transition-colors"
          >
            <Phone size={16} className="text-neutral-400" />
            (256) 274-8530
          </a>
          <a
            href="mailto:rcrs@rivercityroofingsolutions.com"
            className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium transition-colors"
          >
            <Mail size={16} className="text-neutral-400" />
            Email Support
          </a>
        </div>
      </div>

      {/* Download Guide */}
      <div className="mt-6 text-center">
        <Link
          href="/PORTAL-TRAINING-GUIDE.md"
          target="_blank"
          className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-brand-green transition-colors"
        >
          <BookOpen size={14} />
          Download Full Training Guide
        </Link>
      </div>
    </AdminLayout>
  );
}
