/**
 * Authored content type definitions.
 *
 * The data lives as JSON in `src/content/authored/*.json` so it can be
 * mirrored to `public/data/*.json` for the public read API and consumed
 * by forkers without parsing TypeScript. The interfaces here exist purely
 * to give Astro pages and React islands real types when they import the
 * JSON.
 *
 * Pattern:
 *   import resumeData from '../content/authored/resume.json';
 *   import type { ResumeData } from '../content/types';
 *   const resume = resumeData as ResumeData;
 */

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface Experience {
  title: string;
  company: string;
  location: string;
  date: string;
  items: string[];
}

export interface Education {
  degree: string;
  institution: string;
  location: string;
  date: string;
  items: string[];
}

export interface Project {
  name: string;
  tech: string;
  link: string;
  items: string[];
  featured?: boolean;
}

export interface Skill {
  category: string;
  items: string[];
}

export interface Honor {
  title: string;
  description: string;
  location: string;
  year: string;
}

export interface ValueProp {
  title: string;
  description: string;
  icon: string;
}

export interface Availability {
  status: 'available' | 'open-to-offers' | 'unavailable';
  message: string;
  preferredRoles: string[];
}

export interface ResumeData {
  tagline: string;
  summary: string;
  extendedSummary: string;
  valueProposition: ValueProp[];
  availability: Availability;
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  projects: Project[];
  honors: Honor[];
  certifications: string[];
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

export type SocialCategory =
  | 'dev'
  | 'social'
  | 'entertainment'
  | 'music'
  | 'gaming'
  | 'reading';

export interface SocialLink {
  name: string;
  url: string;
  icon: string;
  color: string;
  username: string;
  category: SocialCategory;
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------

export interface Testimonial {
  name: string;
  role: string;
  company: string;
  relationship: string;
  date: string;
  quote: string;
  linkedinUrl: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Uses
// ---------------------------------------------------------------------------

export interface UseItem {
  name: string;
  description: string;
}

export interface UseCategory {
  category: string;
  items: UseItem[];
}

// ---------------------------------------------------------------------------
// Amazon
// ---------------------------------------------------------------------------

export type AmazonOrderStatus =
  | 'Delivered'
  | 'Cancelled'
  | 'Payment Needed'
  | 'Processing';

export interface AmazonProduct {
  name: string;
  price: number;
  category: string;
  imageUrl?: string;
  url?: string;
  purchased: boolean;
  notes?: string;
}

export interface AmazonOrder {
  orderNumber: string;
  date: string;
  total: number;
  status: AmazonOrderStatus;
  items: string[];
}

export interface AmazonData {
  orders: AmazonOrder[];
  buyAgainProducts: AmazonProduct[];
}
