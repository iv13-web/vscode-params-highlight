export const DEFAULT_COLOR = '#CC7832';

const ALLOWED = /^[#a-zA-Z0-9(),.\s%-]+$/;
const FORBIDDEN = /[;{}<>"'\\/*:@]/;

export function isSafeCssColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > 64) return false;
  if (FORBIDDEN.test(value)) return false;
  return ALLOWED.test(value);
}

export function sanitizeColor(value: unknown): string {
  return isSafeCssColor(value) ? value : DEFAULT_COLOR;
}
