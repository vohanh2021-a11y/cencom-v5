/**
 * SkipLink — WCAG accessibility requirement.
 * Hidden until focused via Tab, then jumps to main content.
 */
'use client';

export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[99999] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--c-primary-lighter)] focus:ring-offset-2 focus:text-sm focus:font-medium"
    >
      Skip to main content
    </a>
  );
}
