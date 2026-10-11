import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '../constants';
import { formatBytes } from './format';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const URL_PATTERN = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i;
export const PHONE_PATTERN = /^\+?[\d\s-]{10,15}$/;

export function validateFile(file, { types = ACCEPTED_FILE_TYPES, maxSize = MAX_FILE_SIZE } = {}) {
  if (!file) return 'Please choose a file';
  if (!types.includes(file.type)) return `Unsupported file type. Allowed: PDF, PNG, JPG`;
  if (file.size > maxSize) return `File is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(maxSize)}`;
  if (file.size === 0) return 'File is empty';
  return null;
}

export const numberInRange = (min, max, label) => (v) => {
  if (v === '' || v === null || v === undefined) return `${label} is required`;
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a number`;
  if (n < min || n > max) return `${label} must be between ${min} and ${max}`;
  return true;
};
