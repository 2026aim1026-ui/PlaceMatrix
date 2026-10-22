// Seed dataset for the PlaceMatrix demo. All records are fictional and illustrative.
// Dates are generated relative to the moment the data is first seeded so countdowns are always live.

import { DAY, HOUR } from '../utils/dateUtils';

export const DEMO_PASSWORD = 'demo123';

const DOMAIN = 'placematrix.edu';

export const ADMIN_USERS = [
  { id: 'u-ccpc', name: 'CCPC Office', email: `admin@${DOMAIN}`, role: 'CCPC', title: 'CCPC Administrator · FIC Desk' },
  { id: 'u-ver1', name: 'Dr. Subrat Kar', email: `verifier@${DOMAIN}`, role: 'VERIFIER', title: 'Authorized Faculty Verifier' },
  { id: 'u-ver2', name: 'Prof. Neha Gupta', email: `neha.gupta@${DOMAIN}`, role: 'VERIFIER', title: 'Staff Verifier' },
  { id: 'u-spoc1', name: 'Ananya Sharma', email: `spoc@${DOMAIN}`, role: 'SPOC', title: 'Student SPOC', linkedStudentId: 's-14' },
  { id: 'u-spoc2', name: 'Simran Kaur', email: `simran.kaur@${DOMAIN}`, role: 'SPOC', title: 'Student SPOC' },
];

// Quick-login cards shown on the login page and in the account switcher.
export const DEMO_ACCOUNTS = [
  { key: 'student', label: 'Student', email: `2026aim1028@${DOMAIN}`, name: 'Rohan Verma', hint: 'M.Tech AI · Verified & locked' },
  { key: 'verifier', label: 'Verifier', email: `verifier@${DOMAIN}`, name: 'Dr. Subrat Kar', hint: 'Faculty verification desk' },
  { key: 'spoc', label: 'SPOC', email: `spoc@${DOMAIN}`, name: 'Ananya Sharma', hint: 'Acme, Orbit, Vertex, Atlas' },
  { key: 'ccpc', label: 'CCPC Admin', email: `admin@${DOMAIN}`, name: 'CCPC Office', hint: 'Full governance access' },
];

const studentRows = [
  // id, roll, name, degree, branch, cgpa, sem, c10, c12, backlogs, verification, extras
  ['s-01', '2026AIM1028', 'Rohan Verma', 'M.Tech', 'AI', 8.42, [8.24, 8.48, 8.54], 91.2, 88.6, 0, 'VERIFIED',
    { skills: ['Python', 'PyTorch', 'SQL', 'Machine Learning', 'React'], phone: '+91 98765 41028' }],
  ['s-02', '2026AIB1026', 'Kalki Dang', 'B.Tech', 'AI', 9.15, [9.02, 9.1, 9.2, 9.21, 9.18, 9.2], 95.8, 95.2, 0, 'VERIFIED',
    { skills: ['Python', 'C++', 'PyTorch', 'Distributed Systems'] }],
  ['s-03', '2026CSB1033', 'Karan Mehta', 'B.Tech', 'CSE', 8.65, [8.4, 8.6, 8.7, 8.72, 8.7, 8.8], 92.4, 90.0, 0, 'VERIFIED',
    { skills: ['Java', 'Spring', 'SQL', 'System Design'] }],
  ['s-04', '2026AIB1007', 'Ishita Rao', 'B.Tech', 'AI', 8.8, [8.6, 8.7, 8.9, 8.85, 8.9, 8.85], 93.6, 92.8, 0, 'VERIFIED',
    { skills: ['Python', 'TensorFlow', 'SQL', 'Tableau'] }],
  ['s-05', '2026EEB1015', 'Aman Deep', 'B.Tech', 'EE', 7.4, [7.1, 7.3, 7.5, 7.4, 7.6, 7.5], 86.0, 82.4, 0, 'PENDING',
    { skills: ['MATLAB', 'Verilog', 'Python'] }],
  ['s-06', '2026CEB1014', 'Tanvi Joshi', 'B.Tech', 'CE', 8.1, [7.6, 7.8, 7.9, 7.8, 7.9, 7.9], 90.2, 87.0, 0, 'PENDING',
    { skills: ['AutoCAD', 'STAAD Pro', 'Python'], proof: { cgpa: 7.82 } }],
  ['s-07', '2026CSB1050', 'Nikhil Bansal', 'B.Tech', 'CSE', 8.2, [8.0, 8.1, 8.3, 8.2, 8.25, 8.3], 89.4, 88.2, 0, 'PENDING',
    { skills: ['JavaScript', 'React', 'Node.js'] }],
  ['s-08', '2026EEB1031', 'Pooja Rathi', 'B.Tech', 'EE', 7.9, [7.7, 7.8, 8.0, 7.9, 8.0, 8.0], 88.0, 89.4, 0, 'REVISION',
    { skills: ['Power Systems', 'MATLAB'], proof: { class12: 86.4 },
      revisionReason: 'Class 12 marksheet shows 86.40 % — please correct the claimed value or upload the revised marksheet.' }],
  ['s-09', '2026MEB1012', 'Harsh Vardhan', 'B.Tech', 'ME', 7.2, [6.9, 7.1, 7.2, 7.3, 7.2, 7.4], 84.6, 78.4, 1, 'VERIFIED',
    { skills: ['SolidWorks', 'ANSYS', 'Python'] }],
  ['s-10', '2026AIB1020', 'Sana Qureshi', 'B.Tech', 'AI', 8.9, [8.7, 8.8, 9.0, 8.9, 9.0, 8.95], 94.0, 92.0, 0, 'NOT_SUBMITTED',
    { skills: ['Python', 'NLP', 'SQL'] }],
  ['s-11', '2026ECB1044', 'Meera Iyer', 'B.Tech', 'ECE', 8.55, [8.3, 8.5, 8.6, 8.6, 8.55, 8.6], 92.0, 91.0, 0, 'VERIFIED',
    { skills: ['Python', 'Spark', 'SQL'], placement: 'PLACED', placedCompany: 'Nova Labs' }],
  ['s-12', '2026CSM1002', 'Arjun Nair', 'M.Tech', 'CSE', 8.95, [8.9, 9.0, 8.95], 93.0, 90.6, 0, 'VERIFIED',
    { skills: ['Python', 'PyTorch', 'Kubernetes', 'Go'] }],
  ['s-13', '2026MCB1019', 'Divya Menon', 'B.Tech', 'MNC', 9.02, [8.9, 9.0, 9.1, 9.0, 9.05, 9.05], 96.2, 94.8, 0, 'VERIFIED',
    { skills: ['C++', 'Python', 'Statistics', 'SQL'] }],
  ['s-14', '2026CSB1011', 'Ananya Sharma', 'B.Tech', 'CSE', 8.7, [8.5, 8.6, 8.8, 8.7, 8.75, 8.8], 93.2, 91.4, 0, 'VERIFIED',
    { skills: ['Python', 'Go', 'SQL', 'Machine Learning'] }],
  ['s-15', '2026CEB1007', 'Yash Thakur', 'B.Tech', 'CE', 6.8, [6.5, 6.7, 6.9, 6.8, 6.9, 6.9], 80.2, 76.0, 2, 'VERIFIED',
    { skills: ['AutoCAD', 'Revit'] }],
];

const docSizes = [182344, 241002, 156870, 98234, 312500, 204811, 142090];

function buildStudentsAndDocs(now) {
  const students = [];
  const documents = [];
  let docN = 1;

  studentRows.forEach(([id, roll, name, degree, branch, cgpa, semCgpa, class10, class12, backlogs, verification, extra], i) => {
    const r = roll.toLowerCase();
    const submittedAt = new Date(now - (i + 1) * 7 * HOUR).toISOString();
    const isVerified = verification === 'VERIFIED';
    const proof = { cgpa, class10, class12, backlogs, branch, degree, ...(extra.proof || {}) };

    const docStatus = isVerified ? 'APPROVED' : verification === 'NOT_SUBMITTED' ? 'PENDING' : 'PENDING';
    const mk = (type, fileName, claimedValue, status = docStatus, more = {}) => {
      const doc = {
        id: `doc-${String(docN).padStart(3, '0')}`,
        studentId: id,
        type,
        label: more.label || null,
        fileName,
        fileType: 'application/pdf',
        size: docSizes[docN % docSizes.length],
        uploadedAt: new Date(now - (i + 2) * DAY - docN * HOUR).toISOString(),
        status,
        remarks: more.remarks || '',
        claimedValue,
        isDefault: more.isDefault || false,
      };
      docN += 1;
      documents.push(doc);
      return doc;
    };

    const academic = verification !== 'NOT_SUBMITTED' || id === 's-10';
    if (academic) {
      mk('GRADE_CARD', `${r}_grade_card.pdf`, `CGPA ${cgpa.toFixed(2)}`);
      mk('CLASS10', `${r}_10th.pdf`, `${class10.toFixed(2)} %`);
      if (id !== 's-10') {
        mk('CLASS12', `${r}_12th.pdf`, `${class12.toFixed(2)} %`,
          id === 's-08' ? 'REVISION' : docStatus,
          id === 's-08' ? { remarks: extra.revisionReason } : {});
      }
    }

    let defaultResumeId = null;
    if (id !== 's-10') {
      const res = mk('RESUME', `${r}_resume_sde.pdf`, null, docStatus, { label: 'Software Resume', isDefault: true });
      defaultResumeId = res.id;
    }

    if (id === 's-01') {
      mk('RESUME', `${r}_resume_data.pdf`, null, 'APPROVED', { label: 'Data Resume' });
      mk('ID_PROOF', `${r}_aadhaar_masked.pdf`, null, 'APPROVED');
      mk('PORTFOLIO', `${r}_portfolio.pdf`, null, 'PENDING');
      mk('CERTIFICATE', `${r}_nptel_deep_learning.pdf`, null, 'APPROVED');
    }
    if (id === 's-12') mk('RESUME', `${r}_resume_core_ml.pdf`, null, 'PENDING', { label: 'Core ML Resume' });
    if (id === 's-04') mk('RESUME', `${r}_resume_ml.pdf`, null, 'PENDING', { label: 'ML Resume' });

    students.push({
      id,
      roll,
      name,
      email: `${r}@${DOMAIN}`,
      phone: extra.phone || `+91 98${String(100 + i * 37).padStart(3, '0')} ${41000 + i * 113}`,
      degree,
      branch,
      gradYear: 2026,
      cgpa,
      semCgpa,
      class10,
      class12,
      backlogs,
      skills: extra.skills || [],
      verification,
      locked: isVerified,
      verifiedBy: isVerified ? (i % 3 === 0 ? 'Dr. Subrat Kar' : 'Prof. Neha Gupta') : null,
      verifiedAt: isVerified ? new Date(now - (i + 1) * DAY).toISOString() : null,
      submittedAt: verification === 'NOT_SUBMITTED' ? null : submittedAt,
      revisionReason: extra.revisionReason || null,
      placement: extra.placement || 'UNPLACED',
      placedCompany: extra.placedCompany || null,
      proof,
      defaultResumeId,
      createdAt: new Date(now - 20 * DAY).toISOString(),
    });
  });

  return { students, documents };
}

const companies = [
  { id: 'c-01', name: 'Acme Systems', industry: 'Enterprise Software', website: 'https://acme-systems.example',
    description: 'Builds workflow automation and observability platforms for large enterprises.',
    contactName: 'Priya Raman', recruiterEmail: 'campus.hiring@acme-recruiter.example', phone: '+91 80 4012 3300', spocId: 'u-spoc1' },
  { id: 'c-02', name: 'Nova Labs', industry: 'Machine Learning Research', website: 'https://novalabs.example',
    description: 'Applied ML lab building ranking, forecasting and speech models.',
    contactName: 'Daniel Fernandes', recruiterEmail: 'university@novalabs-recruiter.example', phone: '+91 40 6610 0045', spocId: 'u-spoc2' },
  { id: 'c-03', name: 'Orbit Tech', industry: 'Consumer Internet', website: 'https://orbittech.example',
    description: 'Consumer commerce and logistics platform serving 40M monthly users.',
    contactName: 'Sneha Kulkarni', recruiterEmail: 'campus@orbit-recruiter.example', phone: '+91 80 4455 7788', spocId: 'u-spoc1' },
  { id: 'c-04', name: 'Helix AI', industry: 'Generative AI', website: 'https://helix-ai.example',
    description: 'Foundation-model tooling for enterprise document understanding.',
    contactName: 'Rahul Bhatia', recruiterEmail: 'talent@helix-recruiter.example', phone: '+91 124 470 1200', spocId: 'u-spoc2' },
  { id: 'c-05', name: 'Quantum Grid', industry: 'Semiconductors', website: 'https://quantumgrid.example',
    description: 'Mixed-signal chip design for power management and EV charging.',
    contactName: 'Kavita Menon', recruiterEmail: 'campus@qgrid-recruiter.example', phone: '+91 120 455 9000', spocId: 'u-spoc2' },
  { id: 'c-06', name: 'Vertex Analytics', industry: 'Analytics & Consulting', website: 'https://vertexanalytics.example',
    description: 'Decision-science consulting for retail and financial-services clients.',
    contactName: 'Imran Shaikh', recruiterEmail: 'hiring@vertex-recruiter.example', phone: '+91 20 6720 1100', spocId: 'u-spoc1' },
  { id: 'c-07', name: 'Atlas Robotics', industry: 'Robotics', website: 'https://atlasrobotics.example',
    description: 'Warehouse autonomy and robotic picking systems.',
    contactName: 'Meghna Rao', recruiterEmail: 'campus@atlas-recruiter.example', phone: '+91 80 4920 3311', spocId: 'u-spoc1' },
  { id: 'c-08', name: 'Cobalt Fintech', industry: 'Financial Technology', website: 'https://cobaltfintech.example',
    description: 'Payments infrastructure and risk engines for neo-banks.',
    contactName: 'Aditya Jain', recruiterEmail: 'campus@cobalt-recruiter.example', phone: '+91 22 6110 4400', spocId: null, status: 'PENDING_APPROVAL' },
];

function buildDrives(now) {
  const at = (ms) => new Date(now + ms).toISOString();
  return [
    { id: 'd-01', companyId: 'c-01', role: 'Software Engineer', ctc: 42, location: 'Bengaluru', category: 'Software',
      description: 'Backend and platform engineering on the Acme automation suite. Two coding rounds followed by system design and HR.',
      criteria: { minCgpa: 8.0, branches: ['CSE', 'AI', 'MNC'], maxBacklogs: 0, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(2 * DAY + 2 * HOUR + 17 * 60000), status: 'OPEN', createdBy: 'Ananya Sharma', createdAt: at(-6 * DAY) },
    { id: 'd-02', companyId: 'c-02', role: 'Machine Learning Engineer', ctc: 38, location: 'Hyderabad', category: 'Data & AI',
      description: 'Train and ship ranking models. Online assessment on ML fundamentals and Python.',
      criteria: { minCgpa: 8.5, branches: ['AI', 'CSE'], maxBacklogs: 0, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(4 * DAY + 5 * HOUR), status: 'OPEN', createdBy: 'Simran Kaur', createdAt: at(-5 * DAY) },
    { id: 'd-03', companyId: 'c-03', role: 'SDE-1', ctc: 32, location: 'Bengaluru', category: 'Software',
      description: 'Full-stack development on the commerce platform. DSA round, machine coding and a hiring-manager round.',
      criteria: { minCgpa: 7.5, branches: ['CSE', 'AI', 'MNC', 'EE'], maxBacklogs: 1, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(6 * DAY + 9 * HOUR), status: 'OPEN', createdBy: 'Ananya Sharma', createdAt: at(-8 * DAY) },
    { id: 'd-04', companyId: 'c-04', role: 'Research Engineer — GenAI', ctc: 36, location: 'Gurugram (Hybrid)', category: 'Data & AI',
      description: 'Research engineering on document-understanding models. Open to M.Tech students with deep-learning experience.',
      criteria: { minCgpa: 8.0, branches: ['AI', 'CSE'], maxBacklogs: 0, gradYears: [2026], degrees: ['M.Tech'], skills: ['Python', 'PyTorch'] },
      deadline: at(1 * DAY + 5 * HOUR), status: 'OPEN', createdBy: 'Simran Kaur', createdAt: at(-4 * DAY) },
    { id: 'd-05', companyId: 'c-05', role: 'Analog Design Engineer', ctc: 24, location: 'Noida', category: 'Core Engineering',
      description: 'Analog and mixed-signal IC design. Written test on circuits followed by technical interviews.',
      criteria: { minCgpa: 7.0, branches: ['EE', 'ECE'], maxBacklogs: 0, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(5 * DAY + 3 * HOUR), status: 'OPEN', createdBy: 'Simran Kaur', createdAt: at(-3 * DAY) },
    { id: 'd-06', companyId: 'c-06', role: 'Data Analyst', ctc: 18, location: 'Pune', category: 'Analytics',
      description: 'Client analytics and dashboarding. Aptitude test, case study and interview.',
      criteria: { minCgpa: 7.0, branches: [], maxBacklogs: 2, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(8 * DAY + 4 * HOUR), status: 'OPEN', createdBy: 'Ananya Sharma', createdAt: at(-2 * DAY) },
    { id: 'd-07', companyId: 'c-03', role: 'Product Engineer', ctc: 22, location: 'Gurugram', category: 'Product',
      description: 'Product engineering for seller tools. Applications frozen while the recruiter revises headcount.',
      criteria: { minCgpa: 7.0, branches: ['CSE', 'AI', 'MNC', 'EE', 'ECE', 'CE'], maxBacklogs: 1, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(3 * DAY), status: 'FROZEN', createdBy: 'Ananya Sharma', createdAt: at(-7 * DAY) },
    { id: 'd-08', companyId: 'c-01', role: 'Cloud Infrastructure Engineer', ctc: 26, location: 'Bengaluru', category: 'Software',
      description: 'Infrastructure automation on Kubernetes. Applications closed; assessments in progress.',
      criteria: { minCgpa: 7.5, branches: ['CSE', 'AI', 'MNC', 'EE'], maxBacklogs: 0, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(-3 * DAY), status: 'CLOSED', createdBy: 'Ananya Sharma', createdAt: at(-15 * DAY) },
    { id: 'd-09', companyId: 'c-02', role: 'Data Engineer', ctc: 26, location: 'Hyderabad', category: 'Data & AI',
      description: 'Streaming data pipelines. Process completed.',
      criteria: { minCgpa: 7.5, branches: ['CSE', 'AI', 'MNC', 'ECE'], maxBacklogs: 0, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(-12 * DAY), status: 'CLOSED', createdBy: 'Simran Kaur', createdAt: at(-25 * DAY) },
    { id: 'd-10', companyId: 'c-04', role: 'Platform Engineer', ctc: 30, location: 'Gurugram', category: 'Software',
      description: 'Draft JAF awaiting final recruiter confirmation.',
      criteria: { minCgpa: 7.5, branches: ['CSE', 'AI'], maxBacklogs: 0, gradYears: [2026], degrees: [], skills: [] },
      deadline: at(10 * DAY), status: 'DRAFT', createdBy: 'Simran Kaur', createdAt: at(-1 * DAY) },
  ];
}

const appRows = [
  ['a-01', 's-01', 'd-03', 'SHORTLISTED', 5],
  ['a-02', 's-01', 'd-08', 'ASSESSMENT', 12],
  ['a-03', 's-02', 'd-01', 'INTERVIEW', 5],
  ['a-04', 's-03', 'd-01', 'SHORTLISTED', 5],
  ['a-05', 's-04', 'd-01', 'APPLIED', 4],
  ['a-06', 's-12', 'd-01', 'APPLIED', 3],
  ['a-07', 's-13', 'd-01', 'UNDER_REVIEW', 4],
  ['a-08', 's-14', 'd-02', 'APPLIED', 2],
  ['a-09', 's-02', 'd-02', 'SHORTLISTED', 4],
  ['a-10', 's-04', 'd-02', 'APPLIED', 3],
  ['a-11', 's-12', 'd-02', 'ASSESSMENT', 4],
  ['a-12', 's-02', 'd-03', 'APPLIED', 6],
  ['a-13', 's-03', 'd-03', 'INTERVIEW', 7],
  ['a-14', 's-09', 'd-06', 'APPLIED', 1],
  ['a-15', 's-13', 'd-06', 'APPLIED', 1],
  ['a-16', 's-12', 'd-04', 'SHORTLISTED', 3],
  ['a-17', 's-11', 'd-09', 'OFFERED', 22],
  ['a-18', 's-03', 'd-08', 'REJECTED', 13],
  ['a-19', 's-13', 'd-08', 'INTERVIEW', 13],
  ['a-20', 's-14', 'd-03', 'UNDER_REVIEW', 6],
  ['a-21', 's-13', 'd-03', 'SHORTLISTED', 7],
  ['a-22', 's-04', 'd-06', 'WITHDRAWN', 2],
  ['a-23', 's-12', 'd-09', 'REJECTED', 22],
];

const PATH = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFERED'];

function buildApplications(now, students) {
  return appRows.map(([id, studentId, driveId, stage, daysAgo]) => {
    const appliedAt = now - daysAgo * DAY;
    const steps = stage === 'REJECTED' || stage === 'WITHDRAWN'
      ? ['APPLIED', 'UNDER_REVIEW', stage]
      : PATH.slice(0, PATH.indexOf(stage) + 1);
    const span = Math.max(1, daysAgo * DAY - 2 * HOUR);
    const history = steps.map((s, i) => ({
      stage: s,
      at: new Date(appliedAt + (span * i) / Math.max(1, steps.length)).toISOString(),
      by: i === 0 ? 'Student' : s === 'WITHDRAWN' ? 'Student' : 'SPOC',
      note: i === 0 ? 'Application submitted with default resume' : s === 'REJECTED' ? 'Not shortlisted after assessment' : '',
    }));
    const student = students.find((s) => s.id === studentId);
    return {
      id,
      studentId,
      driveId,
      resumeId: student?.defaultResumeId || null,
      appliedAt: new Date(appliedAt).toISOString(),
      stage,
      updatedAt: history[history.length - 1].at,
      history,
    };
  });
}

function buildInvitations(now, students) {
  const registered = students.map((s, i) => ({
    id: `inv-${String(i + 1).padStart(2, '0')}`,
    entryNo: s.roll,
    name: s.name,
    email: s.email,
    branch: s.branch,
    degree: s.degree,
    feePaid: true,
    status: 'REGISTERED',
    updatedAt: new Date(now - (18 - i * 0.5) * DAY).toISOString(),
    studentId: s.id,
  }));
  const pending = [
    ['2026AIB1033', 'Nisha Patel', 'AI', 'B.Tech', 'INVITED', -1 * DAY],
    ['2026CSB1045', 'Farhan Ali', 'CSE', 'B.Tech', 'NOT_INVITED', null],
    ['2026MEB1018', 'Vikram Singh', 'ME', 'B.Tech', 'NOT_INVITED', null],
    ['2026ECB1022', 'Riya Sen', 'ECE', 'B.Tech', 'NOT_INVITED', null],
    ['2026EEB1040', 'Rahul Gupta', 'EE', 'B.Tech', 'DECLINED', -2 * DAY],
  ].map(([roll, name, branch, degree, status, offset], i) => ({
    id: `inv-${String(registered.length + i + 1).padStart(2, '0')}`,
    entryNo: roll,
    name,
    email: `${roll.toLowerCase()}@${DOMAIN}`,
    branch,
    degree,
    feePaid: true,
    status,
    updatedAt: offset === null ? null : new Date(now + offset).toISOString(),
    studentId: null,
  }));
  return [...registered, ...pending];
}

function buildTickets(now) {
  return [
    { id: 't-01', studentId: 's-09', type: 'CORRECTION', field: 'class12', fieldLabel: 'Class 12 %', currentValue: '78.40', requestedValue: '79.40',
      justification: 'Re-evaluation result for Physics was published after my profile was verified. Revised marksheet attached in Documents.',
      status: 'OPEN', createdAt: new Date(now - 26 * HOUR).toISOString(), resolvedAt: null, resolvedBy: null, resolution: '' },
    { id: 't-02', studentId: 's-01', type: 'CORRECTION', field: 'semCgpa', fieldLabel: 'Semester SGPA', currentValue: '8.24, 8.48, 8.54', requestedValue: '8.24, 8.48, 8.56',
      justification: 'Semester 3 SGPA was rounded incorrectly.',
      status: 'REJECTED', createdAt: new Date(now - 6 * DAY).toISOString(), resolvedAt: new Date(now - 5 * DAY).toISOString(),
      resolvedBy: 'CCPC Office', resolution: 'Semester 3 grade card shows SGPA 8.54. No change required.' },
    { id: 't-03', studentId: 's-15', type: 'UNFREEZE', field: 'backlogs', fieldLabel: 'Active backlogs', currentValue: '2', requestedValue: '1',
      justification: 'Cleared MA201 in the supplementary examination held in September. Result notification is available on the academic portal.',
      status: 'OPEN', createdAt: new Date(now - 9 * HOUR).toISOString(), resolvedAt: null, resolvedBy: null, resolution: '' },
  ];
}

function buildAudit(now) {
  const rows = [
    [-20 * DAY, 'CCPC Office', 'CCPC', 'Invitation', 'FEE_LIST_IMPORTED', '15 fee-paid students imported from the Academic Section list.'],
    [-19 * DAY, 'CCPC Office', 'CCPC', 'Invitation', 'INVITATION_SENT', 'Bulk onboarding invitation sent to 15 fee-paid students.'],
    [-15 * DAY, 'Ananya Sharma', 'SPOC', 'Drive', 'DRIVE_CREATED', 'Acme Systems — Cloud Infrastructure Engineer published (₹26 LPA).'],
    [-14 * DAY, 'Dr. Subrat Kar', 'VERIFIER', 'Profile', 'PROFILE_VERIFIED', '2026AIM1028 (Rohan Verma) verified and auto-locked.'],
    [-12 * DAY, 'System Engine', 'SYSTEM', 'Drive', 'DRIVE_CLOSED', 'Nova Labs — Data Engineer closed at deadline.'],
    [-8 * DAY, 'Ananya Sharma', 'SPOC', 'Drive', 'DRIVE_CREATED', 'Orbit Tech — SDE-1 published (₹32 LPA).'],
    [-7 * DAY, 'Ananya Sharma', 'SPOC', 'Drive', 'DRIVE_FROZEN', 'Orbit Tech — Product Engineer frozen pending headcount revision.'],
    [-6 * DAY, 'Ananya Sharma', 'SPOC', 'Drive', 'DRIVE_CREATED', 'Acme Systems — Software Engineer published (₹42 LPA).'],
    [-6 * DAY + 2 * HOUR, 'Rohan Verma', 'STUDENT', 'Ticket', 'CORRECTION_REQUESTED', '2026AIM1028 requested a Semester SGPA correction.'],
    [-5 * DAY, 'CCPC Office', 'CCPC', 'Ticket', 'TICKET_REJECTED', 'Correction ticket t-02 for 2026AIM1028 rejected.'],
    [-5 * DAY + HOUR, 'Simran Kaur', 'SPOC', 'Drive', 'DRIVE_CREATED', 'Nova Labs — Machine Learning Engineer published (₹38 LPA).'],
    [-4 * DAY, 'Simran Kaur', 'SPOC', 'Application', 'BATCH_SHORTLIST_EXECUTED', 'Helix AI: 1 candidate moved to SHORTLISTED (2026CSM1002).'],
    [-3 * DAY, 'Prof. Neha Gupta', 'VERIFIER', 'Profile', 'REVISION_REQUESTED', '2026EEB1031 (Pooja Rathi): Class 12 value does not match the marksheet.'],
    [-2 * DAY, 'CCPC Office', 'CCPC', 'Drive', 'DEADLINE_EXTENDED', 'Vertex Analytics — Data Analyst deadline extended by 48 hours.'],
    [-2 * DAY + 3 * HOUR, 'Ananya Sharma', 'SPOC', 'Application', 'ROSTER_EXPORTED', 'Acme Systems — Software Engineer: 5 applicant rows exported as CSV.'],
    [-1 * DAY, 'CCPC Office', 'CCPC', 'Invitation', 'INVITATION_SENT', 'Invitation sent to 2026AIB1033 (Nisha Patel).'],
    [-26 * HOUR, 'Harsh Vardhan', 'STUDENT', 'Ticket', 'CORRECTION_REQUESTED', '2026MEB1012 requested a Class 12 % correction.'],
    [-20 * HOUR, 'Ananya Sharma', 'SPOC', 'Application', 'BATCH_SHORTLIST_EXECUTED', 'Orbit Tech — SDE-1: 2 candidates moved to SHORTLISTED (2026AIM1028, 2026MCB1019).'],
    [-9 * HOUR, 'Yash Thakur', 'STUDENT', 'Ticket', 'UNFREEZE_REQUESTED', '2026CEB1007 requested profile unfreeze (Active backlogs).'],
    [-3 * HOUR, 'System Engine', 'SYSTEM', 'Profile', 'PROFILE_SUBMITTED', '2026CSB1050 (Nikhil Bansal) submitted profile for verification.'],
  ];
  return rows.map(([offset, actorName, actorRole, entity, action, description], i) => ({
    id: `ev-${String(i + 1).padStart(3, '0')}`,
    at: new Date(now + offset).toISOString(),
    actorName,
    actorRole,
    entity,
    action,
    description,
  }));
}

function buildNotifications(now) {
  return [
    { id: 'n-01', userId: 's-01', message: 'You were shortlisted for Orbit Tech — SDE-1.', at: new Date(now - 20 * HOUR).toISOString(), read: false, link: '/student/applications' },
    { id: 'n-02', userId: 's-01', message: 'Acme Systems — Software Engineer closes in 2 days.', at: new Date(now - 4 * HOUR).toISOString(), read: false, link: '/student/opportunities/d-01' },
    { id: 'n-03', userId: 's-01', message: 'Your correction ticket for Semester SGPA was rejected.', at: new Date(now - 5 * DAY).toISOString(), read: true, link: '/student/profile' },
    { id: 'n-04', userId: 's-08', message: 'Revision requested on your Profile Audit: Class 12 value mismatch.', at: new Date(now - 3 * DAY).toISOString(), read: false, link: '/student/profile' },
  ];
}

export function buildSeed(now = Date.now()) {
  const { students, documents } = buildStudentsAndDocs(now);
  return {
    version: 1,
    seededAt: new Date(now).toISOString(),
    adminUsers: ADMIN_USERS,
    students,
    documents,
    companies: companies.map((c) => ({
      status: 'APPROVED',
      active: true,
      approvedAt: new Date(now - 10 * DAY).toISOString(),
      ...c,
      ...(c.status === 'PENDING_APPROVAL' ? { approvedAt: null } : {}),
    })),
    drives: buildDrives(now),
    applications: buildApplications(now, students),
    invitations: buildInvitations(now, students),
    tickets: buildTickets(now),
    audit: buildAudit(now),
    notifications: buildNotifications(now),
  };
}
