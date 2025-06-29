/**
 * Patterns for detecting and cleaning problematic directories
 */

export interface SuspiciousPattern {
  pattern: string;
  description: string;
  category: 'safe' | 'careful' | 'dangerous';
  reason: string;
}

/**
 * Patterns that are generally safe to clean automatically
 */
export const SAFE_PATTERNS: SuspiciousPattern[] = [
  {
    pattern: 'node_modules',
    description: 'Node.js dependencies',
    category: 'safe',
    reason: 'Can be regenerated with npm/yarn install',
  },
  {
    pattern: '.venv',
    description: 'Python virtual environments',
    category: 'safe',
    reason: 'Can be regenerated with pip install',
  },
  {
    pattern: 'cache',
    description: 'Cache directories',
    category: 'safe',
    reason: 'Temporary files that can be regenerated'
  },
  {
    pattern: 'build',
    description: 'Build artifacts',
    category: 'safe',
    reason: 'Generated files that can be rebuilt'
  },
  {
    pattern: 'dist',
    description: 'Distribution files',
    category: 'safe',
    reason: 'Generated files that can be rebuilt'
  },
  {
    pattern: '.next',
    description: 'Next.js build cache',
    category: 'safe',
    reason: 'Next.js build cache, regenerated on next build'
  },
  {
    pattern: '.nuxt',
    description: 'Nuxt.js build cache',
    category: 'safe',
    reason: 'Nuxt.js build cache, regenerated on next build'
  }
];

/**
 * Patterns that require careful consideration before cleaning
 */
export const CAREFUL_PATTERNS: SuspiciousPattern[] = [
  {
    pattern: '.vscode',
    description: 'VS Code settings',
    category: 'careful',
    reason: 'Contains user preferences and workspace settings'
  },
  {
    pattern: 'target',
    description: 'Rust/Java build artifacts',
    category: 'careful',
    reason: 'Build artifacts, but may contain important compiled binaries'
  },
  {
    pattern: 'tmp',
    description: 'Temporary directories',
    category: 'careful',
    reason: 'Usually temporary, but may contain important temporary files'
  },
  {
    pattern: '.cache',
    description: 'Hidden cache directories',
    category: 'careful',
    reason: 'Cache files, but may contain important application data'
  }
];

/**
 * Patterns that are dangerous to clean automatically
 */
export const DANGEROUS_PATTERNS: SuspiciousPattern[] = [
  {
    pattern: '.git',
    description: 'Git repositories',
    category: 'dangerous',
    reason: 'Contains version control history - permanent loss if deleted'
  },
  {
    pattern: '.config',
    description: 'Configuration directories',
    category: 'dangerous',
    reason: 'May contain important application configuration'
  }
];

/**
 * All patterns combined
 */
export const ALL_PATTERNS: SuspiciousPattern[] = [
  ...SAFE_PATTERNS,
  ...CAREFUL_PATTERNS,
  ...DANGEROUS_PATTERNS
];

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: 'safe' | 'careful' | 'dangerous'): SuspiciousPattern[] {
  return ALL_PATTERNS.filter(p => p.category === category);
}

/**
 * Get pattern by name
 */
export function getPattern(patternName: string): SuspiciousPattern | undefined {
  return ALL_PATTERNS.find(p => p.pattern === patternName);
} 