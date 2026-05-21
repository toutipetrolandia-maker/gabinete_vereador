import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatProperName(name: string): string {
  if (!name) return '';
  const prepositions = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'a', 'o', 'em']);
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return '';
      if (index === 0 || !prepositions.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .filter(Boolean)
    .join(' ');
}
