// ──────────────────────────────────────────────────────────────
// RoleIcon — Unified Lucide icon registry for the entire extension
// ──────────────────────────────────────────────────────────────

import React from 'react';
import {
  // Role icons
  Sparkles,
  LineChart,
  BookOpen,
  Palette,
  PenTool,
  Rocket,
  GraduationCap,
  Code,
  Megaphone,
  Briefcase,
  Search,
  School,
  Code2,
  Video,
  Settings,
  HelpCircle,

  // General UI icons
  X,
  Check,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowRight,
  ExternalLink,

  // Navigation & actions
  Clock,
  History,
  BarChart3,
  FileText,
  Layers,
  Globe,
  Zap,
  Copy,
  Pencil,
  Trash2,
  RotateCcw,
  RefreshCw,
  Loader2,

  // Domain icons
  Bot,
  Shield,
  Database,
  Cloud,
  Key,
  Bug,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Filter,
  SlidersHorizontal,

  // Suggestion icons
  Target,
  ClipboardList,
  Lightbulb,
  Construction,
  Ruler,
  ListOrdered,
  PenLine,
  AlignLeft,

  // Status
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Info,
  Crown,
  LogOut,
  User,
} from 'lucide-react';

interface RoleIconProps {
  name: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  // Role icons
  Sparkles,
  LineChart,
  BookOpen,
  Palette,
  PenTool,
  Rocket,
  GraduationCap,
  Code,
  Megaphone,
  Briefcase,
  Search,
  School,
  Code2,
  Video,
  Settings,

  // General UI
  X,
  Check,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowRight,
  ExternalLink,

  // Navigation & actions
  Clock,
  History,
  BarChart3,
  FileText,
  Layers,
  Globe,
  Zap,
  Copy,
  Pencil,
  Trash2,
  RotateCcw,
  RefreshCw,
  Loader2,

  // Domain
  Bot,
  Shield,
  Database,
  Cloud,
  Key,
  Bug,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Filter,
  SlidersHorizontal,

  // Suggestions
  Target,
  ClipboardList,
  Lightbulb,
  Construction,
  Ruler,
  ListOrdered,
  PenLine,
  AlignLeft,

  // Status
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Info,
  Crown,
  LogOut,
  User,
};

export const RoleIcon: React.FC<RoleIconProps> = ({
  name,
  className,
  size = 16,
  strokeWidth = 1.75,
}) => {
  const Icon = ICON_MAP[name] || HelpCircle;
  return <Icon className={className} size={size} strokeWidth={strokeWidth} />;
};
