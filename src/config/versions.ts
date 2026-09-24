// src/config/versions.ts
// Single source of truth for version metadata.
// Consumed by VersionSelect component and sidebar config.

export interface Version {
  slug: string;       // URL path segment: 'latest' or 'v1-27-1'
  label: string;      // Display label: 'Latest' or 'v1.27.1'
  badge?: string;     // Optional badge text
  isCurrent: boolean; // true for latest
}

export const versions: Version[] = [
  { slug: 'latest', label: 'Latest', badge: 'Atual', isCurrent: true },
  { slug: 'v1-27-1', label: 'v1.27.1', isCurrent: false },
  { slug: 'v1-27-2', label: 'v1.27.2', isCurrent: false },
  { slug: 'v1-31-0', label: 'v1.31.0', isCurrent: false },
  { slug: 'v1-32-0', label: 'v1.32.0', isCurrent: false },
  { slug: 'v1-33-0', label: 'v1.33.0', isCurrent: false },
  { slug: 'v1-34-0', label: 'v1.34.0', isCurrent: false },
  { slug: 'v1-35-0', label: 'v1.35.0', isCurrent: false },
  { slug: 'v1-36-1', label: 'v1.36.1', isCurrent: false },
];

export const defaultVersion = 'latest';
