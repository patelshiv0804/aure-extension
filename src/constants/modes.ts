// ──────────────────────────────────────────────────────────────
// Enhancement Roles & Modes Definitions (Synced with Prompt_Enhancer-FE)
// ──────────────────────────────────────────────────────────────

import type { EnhancementModeConfig } from '@/types/enhancement';

export interface RoleItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
}

export const ROLES: RoleItem[] = [
  { id: 'general', label: 'General', icon: 'Sparkles', color: '#7C5CFC', description: 'General purpose prompt optimization across all domains.' },
  { id: 'student', label: 'Student', icon: 'GraduationCap', color: '#10B981', description: 'Study notes, exam prep, research, and academic learning.' },
  { id: 'marketer', label: 'Marketer', icon: 'Megaphone', color: '#A855F7', description: 'Social ads, SEO, email marketing, and conversion copy.' },
  { id: 'consultant', label: 'Consultant', icon: 'Briefcase', color: '#0F172A', description: 'Business strategy, management frameworks, and advisory.' },
  { id: 'researcher', label: 'Researcher', icon: 'Search', color: '#14B8A6', description: 'Deep research, literature review, and fact synthesis.' },
  { id: 'developer', label: 'Developer', icon: 'Code2', color: '#06B6D4', description: 'Code generation, debugging, system design, and API building.' },
  { id: 'educator', label: 'Educator', icon: 'School', color: '#6366F1', description: 'Lesson planning, quizzes, course design, and grading rubrics.' },
  { id: 'entrepreneur', label: 'Entrepreneur', icon: 'Rocket', color: '#EF4444', description: 'Pitch decks, business models, SaaS growth, and pricing.' },
  { id: 'writer', label: 'Writer', icon: 'PenTool', color: '#F59E0B', description: 'Copywriting, essays, stories, editing, and technical docs.' },
  { id: 'analyst', label: 'Analyst', icon: 'BarChart3', color: '#3B82F6', description: 'Data analysis, financial metrics, SWOT, and KPI reports.' },
  { id: 'designer', label: 'Designer', icon: 'Palette', color: '#EC4899', description: 'UI/UX briefs, Figma components, branding, and motion.' },
  { id: 'creator', label: 'Creator', icon: 'Video', color: '#8B5CF6', description: 'Video scripts, podcast outlines, YouTube & social content.' },
];

export const ROLE_MODES: Record<string, string[]> = {
  general: [],
  student: [
    'Study', 'Exams', 'Learnings', 'Projects', 'Research',
    'Competitive Programming', 'Productivity', 'Certifications',
    'Interview Preparation', 'Career',
  ],
  marketer: [
    'Market Research', 'Positioning', 'Branding', 'Content Marketing', 'SEO',
    'Social Media Marketing', 'Email Marketing', 'Paid Advertising', 'Lead Generation',
    'Funnels', 'Conversion Optimization', 'Growth Marketing', 'Product Marketing',
    'Analytics', 'Retention', 'E-commerce Marketing', 'B2B Marketing', 'Local Marketing',
    'Marketing Strategy',
  ],
  consultant: [
    'Strategy Consulting', 'Business Consulting', 'Startup Consulting', 'Product Consulting',
    'Marketing Consulting', 'Operations Consulting', 'Technology Consulting',
    'Financial Consulting', 'HR Consulting', 'Career Consulting', 'Management Consulting',
    'Audit & Review', 'Recommendations', 'Implementation Support',
  ],
  researcher: [
    'Deep Research', 'Literature Research', 'Source Analysis', 'Fact Checking',
    'Comparison', 'Reports', 'Market Research', 'Data Research', 'Historical Research',
    'Scientific Research', 'Academic Research', 'Competitive Intelligence',
    'Forecasting', 'Investigative Research', 'Synthesis',
  ],
  developer: [
    'Frontend', 'Backend', 'Full Stack', 'Mobile', 'Desktop', 'Database', 'APIs',
    'DSA', 'Competitive Programming', 'Debugging', 'Testing', 'System Design',
    'DevOps', 'Cloud', 'Cybersecurity', 'Operating Systems', 'Networking',
    'AI/ML', 'Agentic AI', 'Blockchain', 'Game Development', 'Embedded Systems',
    'Open Source', 'Developer Career',
  ],
  educator: [
    'Lesson Planning', 'Teaching Materials', 'Assessments', 'Quiz & Test Creation',
    'Course Design', 'Teaching Strategies', 'Explanation & Simplification',
    'Classroom Management', 'Educational Technology', 'Online Education',
    'Special Education', 'Educational Research', 'Content Creation',
    'Feedback & Evaluation', 'Professional Development',
  ],
  entrepreneur: [
    'Idea & Validation', 'Market Research', 'Business Planning', 'Product',
    'Branding', 'Marketing', 'Sales', 'Pricing', 'Finance', 'Fundraising',
    'Operations', 'Legal', 'E-Commerce', 'SaaS', 'AI Startups', 'Growth',
    'Founder Career',
  ],
  writer: [
    'Creative Writing', 'Content Writing', 'Marketing Copywriting', 'Social Media Writing',
    'Business Writing', 'Academic Writing', 'Technical Writing', 'Career Writing',
    'Editing & Rewriting', 'Specialized Writing',
  ],
  analyst: [
    'Data Analysis', 'Business Analysis', 'Financial Analysis', 'Market Analysis',
    'Competitor Analysis', 'SWOT Analysis', 'Risk Analysis', 'Root Cause Analysis',
    'Decision Support', 'Scenario Analysis', 'KPI & Metrics Analysis', 'Product Analysis',
    'Operations Analysis', 'Visualization & Reporting', 'Strategy',
  ],
  designer: [
    'UI Design', 'UX Design', 'Figma', 'Design Systems', 'Branding', 'Graphics',
    'Landing Pages', 'Motion Design', 'Product Design', 'Presentation Design',
    'E-commerce Design', 'Email Design', '3D Design', 'Game Design',
    'AI-Assisted Design',
  ],
  creator: [
    'YouTube', 'Instagram', 'TikTok', 'X/Twitter', 'LinkedIn', 'Facebook',
    'Blogging', 'Podcast', 'Streaming', 'Email Content', 'Community Building',
    'Branding', 'Monetization', 'Analytics', 'Content Strategy',
  ],
};

export const ENHANCEMENT_MODES: EnhancementModeConfig[] = ROLES.map((role) => ({
  id: role.id,
  label: role.label,
  icon: role.icon,
  color: role.color,
  colorClass: 'from-purple-500 to-indigo-600',
  description: role.description,
  examples: (ROLE_MODES[role.id] || []).slice(0, 3).map((m) => `Optimize for ${m}`),
}));

export const MODE_MAP = Object.fromEntries(
  ENHANCEMENT_MODES.map((m) => [m.id, m])
) as Record<string, EnhancementModeConfig>;

export function getModeIconName(mode: string): string {
  const m = mode.toLowerCase();
  if (m.includes('study') || m.includes('learn')) return 'BookOpen';
  if (m.includes('exam') || m.includes('certif')) return 'GraduationCap';
  if (m.includes('project') || m.includes('dsa')) return 'Layers';
  if (m.includes('productiv') || m.includes('zap')) return 'Zap';
  if (m.includes('interview') || m.includes('social') || m.includes('community')) return 'Users';
  if (m.includes('youtube') || m.includes('video') || m.includes('podcast') || m.includes('streaming')) return 'Video';
  if (m.includes('email') || m.includes('mail')) return 'Mail';
  if (m.includes('blog') || m.includes('writing') || m.includes('copywriting')) return 'PenTool';
  if (m.includes('code') || m.includes('frontend') || m.includes('backend') || m.includes('dev') || m.includes('api')) return 'Code2';
  if (m.includes('data') || m.includes('analyt') || m.includes('kpi') || m.includes('swot') || m.includes('financial')) return 'BarChart3';
  if (m.includes('market') || m.includes('seo') || m.includes('growth') || m.includes('ads')) return 'Megaphone';
  if (m.includes('design') || m.includes('ui') || m.includes('ux') || m.includes('figma') || m.includes('brand')) return 'Palette';
  if (m.includes('teaching') || m.includes('lesson') || m.includes('course') || m.includes('quiz')) return 'School';
  if (m.includes('consulting') || m.includes('business') || m.includes('management')) return 'Briefcase';
  if (m.includes('idea') || m.includes('concept')) return 'Lightbulb';
  if (m.includes('research') || m.includes('fact') || m.includes('source')) return 'Search';
  if (m.includes('startup') || m.includes('product') || m.includes('saas')) return 'Rocket';
  return 'Sparkles';
}
