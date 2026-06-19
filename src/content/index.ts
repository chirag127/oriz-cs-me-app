/**
 * Authored content barrel.
 *
 * The actual data lives as JSON in `src/content/authored/` so it can be
 * mirrored to `public/data/` for the public read API and edited by forkers
 * without touching TypeScript. This barrel re-exports the JSON contents as
 * typed named exports, matching the shape of the old `src/data/*.ts`
 * modules — so existing imports keep working with minimal diff.
 *
 * Generated (CI-fetched) data is NOT re-exported here — those files are
 * read directly from `src/content/generated/` by Astro pages, since they
 * depend on whether `pnpm run fetch-data` has run.
 */

import resumeJson from './authored/resume.json';
import socialJson from './authored/social.json';
import testimonialsJson from './authored/testimonials.json';
import usesJson from './authored/uses.json';
import amazonJson from './authored/amazon.json';
import type {
  AmazonData,
  AmazonOrder,
  AmazonProduct,
  ResumeData,
  SocialLink,
  Testimonial,
  UseCategory,
} from './types';

// Re-export every type so callers don't need a separate types import.
export type {
  AmazonData,
  AmazonOrder,
  AmazonProduct,
  Availability,
  Education,
  Experience,
  Honor,
  Project,
  ResumeData,
  Skill,
  SocialCategory,
  SocialLink,
  Testimonial,
  UseCategory,
  UseItem,
  ValueProp,
} from './types';

// ---- Resume ---------------------------------------------------------------
const resume = resumeJson as ResumeData;

export const tagline = resume.tagline;
export const summary = resume.summary;
export const extendedSummary = resume.extendedSummary;
export const valueProposition = resume.valueProposition;
export const availability = resume.availability;
export const skills = resume.skills;
export const experience = resume.experience;
export const education = resume.education;
export const projects = resume.projects;
export const honors = resume.honors;
export const certifications = resume.certifications;

// ---- Social ---------------------------------------------------------------
export const socialLinks: SocialLink[] = socialJson as SocialLink[];

// ---- Testimonials ---------------------------------------------------------
export const testimonials: Testimonial[] = testimonialsJson as Testimonial[];

// ---- Uses -----------------------------------------------------------------
export const usesData: UseCategory[] = usesJson as UseCategory[];

// ---- Amazon ---------------------------------------------------------------
const amazon = amazonJson as AmazonData;
export const amazonOrders: AmazonOrder[] = amazon.orders;
export const amazonBuyAgainProducts: AmazonProduct[] = amazon.buyAgainProducts;
