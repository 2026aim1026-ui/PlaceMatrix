// Shared constants: roles, statuses, stages, branches and document types.

export const ROLES = {
  STUDENT: 'STUDENT',
  VERIFIER: 'VERIFIER',
  SPOC: 'SPOC',
  CCPC: 'CCPC',
};

export const ROLE_LABELS = {
  STUDENT: 'Student',
  VERIFIER: 'Faculty Verifier',
  SPOC: 'Student SPOC',
  CCPC: 'CCPC Administrator',
};

export const ADMIN_ROLES = [ROLES.VERIFIER, ROLES.SPOC, ROLES.CCPC];

export const BRANCHES = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'AI', name: 'Artificial Intelligence' },
  { code: 'MNC', name: 'Mathematics & Computing' },
  { code: 'EE', name: 'Electrical Engineering' },
  { code: 'ECE', name: 'Electronics & Communication' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'CE', name: 'Civil Engineering' },
];
export const BRANCH_CODES = BRANCHES.map((b) => b.code);

export const DEGREES = ['B.Tech', 'M.Tech'];
export const GRAD_YEARS = [2025, 2026, 2027];

export const JOB_CATEGORIES = ['Software', 'Data & AI', 'Core Engineering', 'Product', 'Analytics'];

export const DRIVE_STATUS = {
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
};

export const VERIFICATION = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REVISION: 'REVISION',
  REJECTED: 'REJECTED',
};

export const DOC_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REVISION: 'REVISION',
  REJECTED: 'REJECTED',
};

export const PLACEMENT = { UNPLACED: 'UNPLACED', PLACED: 'PLACED' };

export const TICKET_STATUS = { OPEN: 'OPEN', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };

export const INVITE_STATUS = {
  NOT_INVITED: 'NOT_INVITED',
  INVITED: 'INVITED',
  REGISTERED: 'REGISTERED',
  DECLINED: 'DECLINED',
};

// Application pipeline. `order` drives forward-only transitions.
export const STAGES = {
  APPLIED: 'APPLIED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  SHORTLISTED: 'SHORTLISTED',
  ASSESSMENT: 'ASSESSMENT',
  INTERVIEW: 'INTERVIEW',
  OFFERED: 'OFFERED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

export const STAGE_LABELS = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFERED: 'Offered',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const STAGE_ORDER = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFERED'];
export const TERMINAL_STAGES = ['OFFERED', 'REJECTED', 'WITHDRAWN'];

export const DOC_TYPES = {
  GRADE_CARD: { label: 'Grade Card / Transcript', academic: true, field: 'cgpa', required: true },
  CLASS10: { label: 'Class 10 Marksheet', academic: true, field: 'class10', required: true },
  CLASS12: { label: 'Class 12 Marksheet', academic: true, field: 'class12', required: true },
  ID_PROOF: { label: 'Identity Proof', academic: false, required: false },
  RESUME: { label: 'Resume', academic: false, required: true },
  PORTFOLIO: { label: 'Portfolio', academic: false, required: false },
  CERTIFICATE: { label: 'Certificate', academic: false, required: false },
  OTHER: { label: 'Other Document', academic: false, required: false },
};

export const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Roll numbers look like 2026CSB1028: year, branch code, degree letter (B/M), 4-digit serial.
export const ROLL_REGEX = /^(20\d{2})(CS|AI|MC|EE|EC|ME|CE)([BM])(\d{4})$/;

export const STORAGE_KEYS = {
  DB: 'placematrix.db.v1',
  SESSION: 'placematrix.session.v1',
};
