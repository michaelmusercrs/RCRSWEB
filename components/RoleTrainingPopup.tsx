'use client';

import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, CheckCircle2, BookOpen, Truck, Package,
  FileText, Users, BarChart3, Shield, Target, Phone, ArrowRight, GraduationCap
} from 'lucide-react';
import { TeamRole } from '@/lib/team-roles';

interface RoleTrainingPopupProps {
  role: TeamRole;
  userName: string;
  onComplete: () => void;
  onSkip: () => void;
}

type TrainingSlide = {
  title: string;
  icon: React.ElementType;
  content: string[];
  tips?: string[];
};

const roleTraining: Record<TeamRole, TrainingSlide[]> = {
  owner: [
    {
      title: 'Welcome to the Admin Portal',
      icon: Shield,
      content: [
        'As an Owner, you have full access to all portal features.',
        '',
        'YOUR KEY AREAS:',
        '- Dashboard: Monitor all operations at a glance',
        '- Orders: Create and manage material orders',
        '- Drivers: Assign deliveries and track status',
        '- Reports: View analytics and business metrics',
        '- Admin: Manage blog, team, and gallery content',
      ],
      tips: [
        'Check the dashboard first thing each morning',
        'Use reports to track team performance',
        'Set up alerts for low inventory items',
      ],
    },
    {
      title: 'Managing Orders',
      icon: Package,
      content: [
        'Create and track material orders for job sites.',
        '',
        'ORDER WORKFLOW:',
        '1. Click "Create Order" on dashboard',
        '2. Select customer and job site',
        '3. Add materials from inventory',
        '4. Set delivery date and time',
        '5. Assign to available driver',
        '6. Track delivery status in real-time',
        '',
        'STATUSES: Pending > Assigned > In Transit > Delivered',
      ],
    },
    {
      title: 'Team & Content Management',
      icon: Users,
      content: [
        'Keep your website content fresh and team info current.',
        '',
        'ADMIN FEATURES:',
        '- Blog Posts: Add SEO-optimized articles',
        '- Team Members: Update profiles and photos',
        '- Image Gallery: Showcase completed projects',
        '- Service Areas: Manage coverage zones',
        '',
        'Best practice: Post 2-4 blog articles per month for SEO.',
      ],
    },
  ],
  admin: [
    {
      title: 'Welcome to the Admin Portal',
      icon: Shield,
      content: [
        'As an Admin, you have full access to manage operations and content.',
        '',
        'YOUR KEY AREAS:',
        '- Dashboard: Monitor orders and deliveries',
        '- Admin Panel: Manage website content',
        '- Reports: Generate business analytics',
        '- Inventory: Track material levels',
      ],
      tips: [
        'Review pending orders each morning',
        'Keep blog content updated for SEO',
        'Monitor low stock alerts',
      ],
    },
    {
      title: 'Content Management',
      icon: FileText,
      content: [
        'Keep the website content fresh and optimized.',
        '',
        'BLOG MANAGEMENT:',
        '- Create SEO-friendly articles (800-1500 words)',
        '- Use keywords naturally in content',
        '- Add quality images to each post',
        '- Schedule posts in advance',
        '',
        'TEAM PROFILES:',
        '- Keep bios updated and professional',
        '- Add professional headshot photos',
        '- Update contact information',
      ],
    },
    {
      title: 'Order Management',
      icon: Package,
      content: [
        'Create and manage material orders efficiently.',
        '',
        'QUICK ORDER STEPS:',
        '1. Dashboard > Create Order',
        '2. Enter customer info and address',
        '3. Add materials from product list',
        '4. Set delivery window',
        '5. Save and assign driver',
        '',
        'Monitor the "In Progress" tab for active deliveries.',
      ],
    },
  ],
  office: [
    {
      title: 'Welcome to the Portal',
      icon: BookOpen,
      content: [
        'As Office Staff, you can view and manage daily operations.',
        '',
        'YOUR ACCESS INCLUDES:',
        '- View all active orders',
        '- Track delivery status',
        '- Update customer information',
        '- Generate standard reports',
        '- View inventory levels',
      ],
      tips: [
        'Keep customer contact info updated',
        'Check delivery status before customer calls',
        'Report any issues to your manager',
      ],
    },
    {
      title: 'Order Tracking',
      icon: Package,
      content: [
        'Stay on top of all material deliveries.',
        '',
        'STATUS MEANINGS:',
        '- Pending: Order created, awaiting assignment',
        '- Assigned: Driver assigned, awaiting pickup',
        '- In Transit: Driver en route to job site',
        '- Delivered: Order completed successfully',
        '',
        'Click any order to see full details and history.',
      ],
    },
    {
      title: 'Helpful Tips',
      icon: Target,
      content: [
        'Work efficiently with these best practices.',
        '',
        'DAILY CHECKLIST:',
        '- Check for new orders each morning',
        '- Review delivery schedule for the day',
        '- Follow up on any delayed deliveries',
        '- Update customer notes as needed',
        '',
        'Need help? Contact your manager or admin.',
      ],
    },
  ],
  project_manager: [
    {
      title: 'Welcome, Project Manager',
      icon: Target,
      content: [
        'Manage your projects and coordinate deliveries.',
        '',
        'YOUR KEY FEATURES:',
        '- View and create orders for your jobs',
        '- Track delivery status in real-time',
        '- Coordinate with drivers',
        '- Access job schedules',
      ],
      tips: [
        'Schedule deliveries 24-48 hours ahead',
        'Keep customer contact info handy',
        'Communicate delivery times to your crew',
      ],
    },
    {
      title: 'Scheduling Deliveries',
      icon: Package,
      content: [
        'Get materials to your job sites on time.',
        '',
        'SCHEDULING TIPS:',
        '- Order materials 2-3 days before needed',
        '- Specify morning or afternoon windows',
        '- Include gate codes or special instructions',
        '- Verify delivery address before submitting',
        '',
        'For urgent needs, call the office directly.',
      ],
    },
    {
      title: 'Communication',
      icon: Phone,
      content: [
        'Stay connected with the team.',
        '',
        'CONTACT OPTIONS:',
        '- Office: (256) 274-8530',
        '- Urgent issues: Call immediately',
        '- Updates: Check portal notifications',
        '',
        'Keep notes updated on orders for office reference.',
      ],
    },
  ],
  driver: [
    {
      title: 'Welcome to Driver Portal',
      icon: Truck,
      content: [
        'Your mobile hub for daily deliveries.',
        '',
        'WHAT YOU CAN DO:',
        '- View your assigned deliveries',
        '- Get navigation to job sites',
        '- Update delivery status',
        '- Take delivery photos',
        '- Contact office if needed',
      ],
      tips: [
        'Check assignments at start of shift',
        'Update status at each delivery step',
        'Take photos of every delivery',
      ],
    },
    {
      title: 'Delivery Workflow',
      icon: Package,
      content: [
        'Follow these steps for each delivery.',
        '',
        'DELIVERY PROCESS:',
        '1. Tap delivery card to see details',
        '2. Click "Start Delivery" when leaving',
        '3. Use navigation to reach job site',
        '4. Unload materials as specified',
        '5. Take delivery photo',
        '6. Mark as "Complete"',
        '',
        'Always verify address before unloading!',
      ],
    },
    {
      title: 'Important Reminders',
      icon: Target,
      content: [
        'Safety and customer service first.',
        '',
        'BEST PRACTICES:',
        '- Wear PPE at all job sites',
        '- Be professional with customers',
        '- Report delays immediately',
        '- Take clear, well-lit photos',
        '- Keep your PIN secure',
        '',
        'Questions? Call office at (256) 274-8530',
      ],
    },
  ],
  viewer: [
    {
      title: 'Welcome to the Portal',
      icon: BookOpen,
      content: [
        'You have view-only access to the portal.',
        '',
        'YOU CAN VIEW:',
        '- Dashboard overview',
        '- Order status and history',
        '- Basic reports',
        '',
        'Contact admin if you need additional access.',
      ],
      tips: [
        'Use the search to find specific orders',
        'Export reports for offline review',
      ],
    },
  ],
};

export default function RoleTrainingPopup({
  role,
  userName,
  onComplete,
  onSkip,
}: RoleTrainingPopupProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = roleTraining[role] || roleTraining.viewer;
  const totalSlides = slides.length;
  const isLastSlide = currentSlide === totalSlides - 1;
  const currentContent = slides[currentSlide];
  const Icon = currentContent.icon;

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10 bg-gradient-to-r from-brand-green/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-green/20 rounded-xl flex items-center justify-center">
                <GraduationCap className="text-brand-green" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Quick Start Guide</h2>
                <p className="text-sm text-neutral-400">Welcome, {userName.split(' ')[0]}!</p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mt-4">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  idx <= currentSlide ? 'bg-brand-green' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[400px] max-h-[60vh] overflow-y-auto">
          {/* Slide Title */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-brand-blue/20 rounded-2xl flex items-center justify-center">
              <Icon className="text-brand-blue" size={28} />
            </div>
            <h3 className="text-2xl font-bold text-white">{currentContent.title}</h3>
          </div>

          {/* Content Lines */}
          <div className="space-y-2 mb-6">
            {currentContent.content.map((line, idx) => (
              <p
                key={idx}
                className={`text-base leading-relaxed ${
                  line === ''
                    ? 'h-2'
                    : line.includes(':') && !line.startsWith('-') && !line.startsWith(' ')
                    ? 'text-brand-green font-semibold mt-4'
                    : line.startsWith('-') || line.startsWith(' ')
                    ? 'text-neutral-300 pl-4'
                    : 'text-neutral-300'
                }`}
              >
                {line}
              </p>
            ))}
          </div>

          {/* Tips */}
          {currentContent.tips && currentContent.tips.length > 0 && (
            <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-4 mt-6">
              <p className="text-brand-green font-semibold mb-3 flex items-center gap-2">
                <Target size={18} />
                Quick Tips
              </p>
              <ul className="space-y-2">
                {currentContent.tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-300">
                    <CheckCircle2 className="text-brand-green flex-shrink-0 mt-0.5" size={16} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">
              {currentSlide + 1} of {totalSlides}
            </span>
            <button
              onClick={onSkip}
              className="text-sm text-neutral-400 hover:text-white transition-colors ml-4"
            >
              Skip training
            </button>
          </div>

          <div className="flex items-center gap-3">
            {currentSlide > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-brand-green to-emerald-500 hover:from-brand-green/90 hover:to-emerald-500/90 text-black font-semibold transition-all shadow-lg shadow-brand-green/25"
            >
              {isLastSlide ? (
                <>
                  Get Started
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
