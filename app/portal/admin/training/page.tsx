'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, ChevronDown, ChevronRight, CheckCircle2,
  FileText, Users, Image, Globe, Settings, Package, Truck, BarChart3,
  Play, Clock, Target, AlertCircle, HelpCircle, Phone, Mail
} from 'lucide-react';

type Section = {
  id: string;
  title: string;
  icon: any;
  color: string;
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
    color: 'brand-green',
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
    color: 'blue-500',
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
    color: 'green-500',
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
    color: 'purple-500',
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
    color: 'orange-500',
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
    color: 'blue-500',
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
    color: 'blue-500',
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
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <div className="bg-neutral-800 border-b border-neutral-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/admin" className="text-neutral-400 hover:text-white">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Training Portal</h1>
              <p className="text-sm text-neutral-400">Learn how to use all portal features</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-green">{progressPercent}%</div>
            <div className="text-xs text-neutral-400">{completedLessons.length}/{totalLessons} lessons</div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-neutral-800 border-b border-neutral-700">
        <div className="max-w-4xl mx-auto">
          <div className="h-1 bg-neutral-700">
            <div
              className="h-1 bg-brand-green transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Quick Start Card */}
        <div className="bg-gradient-to-r from-brand-green/20 to-blue-500/20 border border-brand-green/30 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-brand-green rounded-full flex items-center justify-center flex-shrink-0">
              <Target className="text-black" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Welcome to Training!</h2>
              <p className="text-neutral-300 text-sm mb-3">
                This guide will teach you how to use all features of the River City Roofing portal system.
                Complete each lesson and mark it done to track your progress.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300">
                  <Clock size={12} className="inline mr-1" /> ~45 min total
                </span>
                <span className="px-3 py-1 bg-neutral-800 rounded-full text-xs text-neutral-300">
                  <BookOpen size={12} className="inline mr-1" /> {totalLessons} lessons
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
              <div key={section.id} className="bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-neutral-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 bg-${section.color}/20 rounded-lg flex items-center justify-center`}>
                      <Icon className={`text-${section.color}`} size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{section.title}</h3>
                      <p className="text-sm text-neutral-400">
                        {sectionProgress}/{section.lessons.length} lessons
                        {sectionComplete && <CheckCircle2 className="inline ml-2 text-brand-green" size={14} />}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="text-neutral-400" size={20} />
                  ) : (
                    <ChevronRight className="text-neutral-400" size={20} />
                  )}
                </button>

                {/* Section Lessons */}
                {isExpanded && (
                  <div className="border-t border-neutral-700">
                    {section.lessons.map((lesson, idx) => {
                      const isLessonExpanded = expandedLesson === lesson.id;
                      const isComplete = completedLessons.includes(lesson.id);

                      return (
                        <div key={lesson.id} className={idx > 0 ? 'border-t border-neutral-700/50' : ''}>
                          {/* Lesson Header */}
                          <button
                            onClick={() => toggleLesson(lesson.id)}
                            className="w-full p-4 pl-8 flex items-center justify-between hover:bg-neutral-700/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                isComplete ? 'bg-brand-green' : 'bg-neutral-700'
                              }`}>
                                {isComplete ? (
                                  <CheckCircle2 className="text-black" size={14} />
                                ) : (
                                  <Play className="text-neutral-400" size={12} />
                                )}
                              </div>
                              <span className={`font-medium ${isComplete ? 'text-brand-green' : 'text-white'}`}>
                                {lesson.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-neutral-500">{lesson.duration}</span>
                              {isLessonExpanded ? (
                                <ChevronDown className="text-neutral-400" size={16} />
                              ) : (
                                <ChevronRight className="text-neutral-400" size={16} />
                              )}
                            </div>
                          </button>

                          {/* Lesson Content */}
                          {isLessonExpanded && (
                            <div className="px-8 pb-4 pl-16">
                              <div className="bg-neutral-900 rounded-lg p-4 mb-4">
                                {lesson.content.map((line, i) => (
                                  <p key={i} className={`text-sm ${
                                    line.startsWith('-') || line.startsWith('   -')
                                      ? 'text-neutral-400 pl-4'
                                      : line === ''
                                        ? 'h-2'
                                        : 'text-neutral-300'
                                  } ${i > 0 ? 'mt-2' : ''}`}>
                                    {line}
                                  </p>
                                ))}
                              </div>

                              {lesson.tips && lesson.tips.length > 0 && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="text-blue-400" size={16} />
                                    <span className="text-sm font-medium text-blue-400">Pro Tips</span>
                                  </div>
                                  {lesson.tips.map((tip, i) => (
                                    <p key={i} className="text-sm text-blue-300/80 pl-6 mt-1">
                                      - {tip}
                                    </p>
                                  ))}
                                </div>
                              )}

                              <button
                                onClick={() => markComplete(lesson.id)}
                                disabled={isComplete}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  isComplete
                                    ? 'bg-brand-green/20 text-brand-green cursor-default'
                                    : 'bg-brand-green hover:bg-lime-400 text-black'
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
        <div className="mt-8 bg-neutral-800 border border-neutral-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <HelpCircle className="text-brand-green" size={24} />
            <h3 className="text-lg font-bold text-white">Need Help?</h3>
          </div>
          <p className="text-neutral-400 text-sm mb-4">
            If you have questions or run into issues, reach out to your manager or the admin team.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="tel:256-274-8530"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-700 rounded-lg text-white text-sm hover:bg-neutral-600 transition-colors"
            >
              <Phone size={16} />
              (256) 274-8530
            </a>
            <a
              href="mailto:rcrs@rivercityroofingsolutions.com"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-700 rounded-lg text-white text-sm hover:bg-neutral-600 transition-colors"
            >
              <Mail size={16} />
              Email Support
            </a>
          </div>
        </div>

        {/* Download Guide */}
        <div className="mt-4 text-center">
          <Link
            href="/PORTAL-TRAINING-GUIDE.md"
            target="_blank"
            className="text-sm text-neutral-400 hover:text-brand-green transition-colors"
          >
            Download Full Training Guide (PDF)
          </Link>
        </div>
      </div>
    </div>
  );
}
