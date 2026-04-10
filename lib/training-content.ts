/**
 * RCRS Training Content Data
 *
 * Training media lives in publichttps://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/ — 32 files:
 *   15 videos (.mp4) + 17 audio deep dives (.wav)
 *
 * Quizzes, flashcards, and study guides in public/training/
 *   7 quiz JSONs + 7 flashcard JSONs + 7 study guide MDs
 */

export interface TrainingContent {
  audioDeepDive?: string;
  trainingVideo?: string;
  briefVideo?: string;
  quiz?: string;
  flashcards?: string;
  studyGuide?: string;
  mindMap?: string;
  infographic?: string;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  audience: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  content: TrainingContent;
}

export const TRAINING_MODULES: TrainingModule[] = [
  {
    id: 'sales-performance',
    title: 'Sales Performance Metrics',
    description: 'Learn the key metrics that drive RCRS sales success: conversion rates, inspection targets, pipeline management, and team performance analysis.',
    audience: ['all', 'sales_rep', 'manager'],
    difficulty: 'beginner',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-performance-funnel.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-data-driven.mp4',
      quiz: '/training/quizzes/sales-performance-quiz.json',
      flashcards: '/training/flashcards/sales-performance-flashcards.json',
      studyGuide: '/training/guides/sales-performance-guide.md',
    },
  },
  {
    id: 'sales-mastery',
    title: 'Sales Territory & CRM Mastery',
    description: 'Master territory analysis, storm tracking, CRM pipeline management, commission structure, supplement filing, and canvassing techniques.',
    audience: ['sales_rep', 'manager'],
    difficulty: 'intermediate',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/advanced-sales-deep-dive.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-2024-cracking-code.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-brendon-playbook.mp4',
      quiz: '/training/quizzes/sales-mastery-quiz.json',
      flashcards: '/training/flashcards/sales-mastery-flashcards.json',
      studyGuide: '/training/guides/sales-mastery-guide.md',
    },
  },
  {
    id: 'platform-onboarding',
    title: 'Platform & Tools Onboarding',
    description: 'Get up to speed on the RCRS portal, Google Sheets backend, JobNimbus CRM, TeamUp calendar, GroupMe chat, and all platform tools.',
    audience: ['all'],
    difficulty: 'beginner',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/portal-digital-hub.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/portal-overview-video.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/portal-training-video.mp4',
      quiz: '/training/quizzes/platform-onboarding-quiz.json',
      flashcards: '/training/flashcards/platform-onboarding-flashcards.json',
      studyGuide: '/training/guides/platform-onboarding-guide.md',
    },
  },
  {
    id: 'field-operations',
    title: 'Field Operations & Delivery',
    description: 'Learn material ordering, delivery lifecycle, loading checklists, inventory management, route planning, safety requirements, and documentation.',
    audience: ['driver', 'office_staff'],
    difficulty: 'intermediate',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/contractor-pipeline.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/contractor-data-decisions.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/contractor-chaos-clarity.mp4',
      quiz: '/training/quizzes/field-operations-quiz.json',
      flashcards: '/training/flashcards/field-operations-flashcards.json',
      studyGuide: '/training/guides/field-operations-guide.md',
    },
  },
  {
    id: 'customer-service',
    title: 'Customer Service & Communication',
    description: 'Master response time standards, customer portal features, objection handling, insurance terminology, referral generation, and follow-up cadence.',
    audience: ['sales_rep', 'office_staff'],
    difficulty: 'beginner',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-2024-trust-dividends.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-construction-balance.mp4',
      quiz: '/training/quizzes/customer-service-quiz.json',
      flashcards: '/training/flashcards/customer-service-flashcards.json',
      studyGuide: '/training/guides/customer-service-guide.md',
    },
  },
  {
    id: 'admin-deep-dive',
    title: 'Administration & System Architecture',
    description: 'Deep dive into Next.js architecture, security model, Google Sheets data structure, JN sync engine, API routes, SEO, and deployment workflow.',
    audience: ['admin', 'manager'],
    difficulty: 'advanced',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/portal-training-deep-dive.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-2025-plan.mp4',
      quiz: '/training/quizzes/admin-deep-dive-quiz.json',
      flashcards: '/training/flashcards/admin-deep-dive-flashcards.json',
      studyGuide: '/training/guides/admin-deep-dive-guide.md',
    },
  },
  {
    id: 'delivery-operations',
    title: 'Delivery Operations & Logistics',
    description: 'Complete guide to the RCRS delivery ecosystem including the 12-status lifecycle, loading procedures, vehicle capacity planning, safety protocols, QC checklists, returns workflow, and warehouse IoT systems.',
    audience: ['driver', 'office_staff', 'manager'],
    difficulty: 'intermediate',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/meeting-data-cracking-code.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-year-balance.mp4',
      quiz: '/training/quizzes/delivery-operations-quiz.json',
      flashcards: '/training/flashcards/delivery-operations-flashcards.json',
      studyGuide: '/training/guides/delivery-operations-guide.md',
    },
  },
  // === Additional modules from the remaining media files ===
  {
    id: 'iko-product-knowledge',
    title: 'IKO Product Knowledge',
    description: 'Deep dive into IKO ROOFPRO certification, shingle products, warranty programs, budget considerations, and the IKO promise to contractors.',
    audience: ['all', 'sales_rep'],
    difficulty: 'intermediate',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/iko-shingles-exposed.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/iko-the-promise.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/iko-investigation-video.mp4',
    },
  },
  {
    id: 'iko-advanced',
    title: 'IKO Advanced: Investigators Guide & Ironclad',
    description: 'Advanced IKO training covering the investigators guide to shingle evaluation, ironclad warranty deep dive, and budget analysis for IKO products.',
    audience: ['sales_rep', 'manager'],
    difficulty: 'advanced',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/iko-ironclad-deep-dive.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/iko-investigators-guide.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/iko-budget-deep-dive.wav',
    },
  },
  {
    id: 'sales-commission-hiring',
    title: 'Commission Structure & Hiring',
    description: 'Understand the RCRS commission structure, hiring blueprint for sales talent, screening process, and building a winning team.',
    audience: ['manager', 'admin'],
    difficulty: 'intermediate',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-commission-structure.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-hiring-video.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-hunter-record.mp4',
    },
  },
  {
    id: 'sales-talent-recruiting',
    title: 'Sales Talent War & Recruiting',
    description: 'Winning the talent war: hiring blueprint, screening techniques, gold rush mentality, and building a self-sustaining sales pipeline.',
    audience: ['manager', 'admin'],
    difficulty: 'advanced',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-talent-war.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-hiring-video.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-gold-rush.wav',
    },
  },
  {
    id: 'sales-team-analytics',
    title: 'Sales Team Performance Analytics',
    description: 'Data-driven approach to team performance: success deconstruction, screening metrics, team balance analysis, and performance benchmarking.',
    audience: ['sales_rep', 'manager'],
    difficulty: 'intermediate',
    content: {
      audioDeepDive: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-team-performance.wav',
      trainingVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-data-driven.mp4',
      briefVideo: 'https://m8ev5du8fbyp5uff.public.blob.vercel-storage.com/training-media/sales-success-deconstructed.wav',
    },
  },
];

export const TRAINING_PATHS = {
  sales: TRAINING_MODULES.filter(m =>
    ['sales-performance', 'sales-mastery', 'sales-team-analytics', 'sales-commission-hiring', 'sales-talent-recruiting'].includes(m.id)
  ),
  onboarding: TRAINING_MODULES.filter(m => m.id === 'platform-onboarding'),
  fieldOps: TRAINING_MODULES.filter(m => ['field-operations', 'delivery-operations'].includes(m.id)),
  customerService: TRAINING_MODULES.filter(m => m.id === 'customer-service'),
  adminDeepDive: TRAINING_MODULES.filter(m => m.id === 'admin-deep-dive'),
  deliveryOps: TRAINING_MODULES.filter(m => m.id === 'delivery-operations'),
  iko: TRAINING_MODULES.filter(m => ['iko-product-knowledge', 'iko-advanced'].includes(m.id)),
};

export function getModulesForRole(role: string): TrainingModule[] {
  return TRAINING_MODULES.filter(
    m => m.audience.includes('all') || m.audience.includes(role)
  );
}

export function getContentUrl(moduleId: string, contentType: keyof TrainingContent): string | undefined {
  const mod = TRAINING_MODULES.find(m => m.id === moduleId);
  return mod?.content[contentType];
}
