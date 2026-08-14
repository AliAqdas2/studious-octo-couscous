/**
 * Hire-sources playbook for advertising — labels must match HIRE_SOURCES in strings.js.
 * Content from Raisa’s 2026 Event Support Handbook + Dave’s hybrid recruitment notes.
 */

export const RECRUITMENT_CONTACTS = [
  {
    name: "Dr. Min Park, PhD",
    role: "HTEM Academic Program Coordinator; TOUR 241 Faculty Supervisor (Fall 2026)",
    email: "mparka@gmu.edu",
    phone: "(703) 993-7194",
  },
  {
    name: "Dr. Abena A. Aidoo Hewton, PhD",
    role: "TOUR 241 Faculty Supervisor (Spring 2027)",
    email: "aaidoo@gmu.edu",
    phone: "(703) 993-9047",
  },
  {
    name: "Ms. Tina R. Jones, MS",
    role: "Senior Instructor; TOUR 490 Internship Faculty Supervisor (Fall 2026 & Spring 2027)",
    email: "tjonesq@gmu.edu",
    phone: "(703) 993-2062",
  },
  {
    name: "Bernadette Davey",
    role: "Career Fair Manager, GMU Career Services (Welcome2Mason & Fall Career Fair)",
    email: null,
    phone: "(703) 993-2372",
  },
];

export const RECRUITMENT_TIMELINE = [
  {
    when: "July",
    activity: "Submit internship and job opportunities",
    contact: "Dr. Min Park",
  },
  {
    when: "August",
    activity: "Welcome2Mason Part-Time Job Fair",
    contact: "Career Services & Dr. Min Park",
  },
  {
    when: "Sept–Oct",
    activity: "George Mason Fall Career Fair",
    contact: "Bernadette Davey",
  },
  {
    when: "November",
    activity: "Recruit Spring practicum & internship students",
    contact: "Dr. Abena A. Aidoo Hewton & Tina Jones",
  },
  {
    when: "Spring",
    activity: "Recruit summer interns",
    contact: "Tina Jones",
  },
];

export const ACADEMIC_PROGRAMS = [
  {
    code: "TOUR 241",
    name: "Practicum",
    hours: "120 hours over 10–14 weeks (10 weeks in summer)",
    notes:
      "Student needs faculty + agency supervisor, hour verification, and employer evaluation.",
  },
  {
    code: "TOUR 490",
    name: "Internship",
    hours: "400 hours, typically 30–40 hrs/week in summer",
    notes:
      "Advanced professional experience; final internship presentation required.",
  },
];

/** @type {Array<{
 *   label: string,
 *   summary: string,
 *   bestFor: string[],
 *   howTo: string[],
 *   links: { label: string, url: string }[],
 *   contacts: typeof RECRUITMENT_CONTACTS,
 *   events: { title: string, date: string, startDate?: string, endDate?: string, time?: string, location: string, focus: string }[],
 *   activeMonths?: number[],
 *   copyHints: string[],
 *   status: 'ready' | 'needs_detail',
 *   notes: string[],
 * }>} */
export const HIRE_SOURCES_CATALOG = [
  {
    label: "Indeed",
    summary:
      "Primary online job board for part-time Event Support Associate roles (Dave: hybrid strategy).",
    bestFor: ["Part-time", "Contractor"],
    howTo: [
      "Get management approval before posting.",
      "Post the Event Support Associate (or relevant role) opening on Indeed.",
      "Use clear pay/rate, schedule flexibility, and DC event-work expectations in the blurb.",
      "When applications arrive, create candidates in Recruitment with source = Indeed.",
    ],
    links: [
      { label: "Indeed for employers", url: "https://www.indeed.com/hire" },
    ],
    contacts: [],
    events: [],
    copyHints: [
      "Mangia DC is hiring Event Support Associates for in-person events in the DC area. Flexible part-time shifts, hands-on guest experience work, paid training. Apply via Indeed or reply with your resume.",
    ],
    status: "ready",
    notes: [
      "LinkedIn is typically not used for Operations / Event Support Associate roles (Dave).",
    ],
  },
  {
    label: "Employee referral",
    summary:
      "Internal referrals from current staff — historically a strong channel for this role.",
    bestFor: ["Part-time", "Practicum", "Internship", "Contractor"],
    howTo: [
      "Ask managers/trainers to share the opening with trusted peers.",
      "Capture the referring employee’s name in Source detail when creating the candidate.",
      "Treat referrals like other applications: review → Belle contact ≤48h if qualified.",
    ],
    links: [],
    contacts: [],
    events: [],
    copyHints: [
      "We’re hiring Event Support Associates. If you know someone great with guest service and event energy, send them our way — reply with their name + resume and we’ll follow up.",
    ],
    status: "ready",
    notes: [],
  },
  {
    label: "University / career fair",
    summary:
      "GMU career fairs and HTEM partnership — main university in-person channel (model for other schools later).",
    bestFor: ["Part-time", "Practicum", "Internship"],
    howTo: [
      "Check the GMU recruiting events calendar and register early.",
      "Coordinate with Bernadette Davey (Career Services) for fair participation.",
      "Bring role one-pagers for part-time, practicum (TOUR 241 / 120h), and internship (TOUR 490 / 400h).",
      "After the fair, enter interested students as candidates with source = University / career fair and fair name in Source detail.",
    ],
    links: [
      {
        label: "GMU Career Fairs & Recruiting",
        url: "https://careers.gmu.edu/fairs-and-recruiting",
      },
      {
        label: "GMU Tourism & Events Management (HTEM)",
        url: "https://cehd.gmu.edu/tourism-and-events-management/",
      },
    ],
    contacts: [
      RECRUITMENT_CONTACTS[3],
      RECRUITMENT_CONTACTS[0],
    ],
    activeMonths: [8, 9, 10, 11],
    events: [
      {
        title: "Welcome2Mason Part-Time Job Fair",
        date: "Tuesday, August 25, 2026",
        startDate: "2026-08-25",
        endDate: "2026-08-25",
        time: "11:00 AM – 2:00 PM",
        location: "Dewberry Hall, Johnson Center",
        focus: "Part-time employees & practicum students",
      },
      {
        title: "Fall Career Fair",
        date: "September 29 – October 1, 2026",
        startDate: "2026-09-29",
        endDate: "2026-10-01",
        location: "Johnson Center, Fairfax Campus",
        focus: "Internship, seasonal, part-time, full-time",
      },
    ],
    copyHints: [
      "Mangia DC (events & hospitality in DC) is recruiting Event Support Associates and practicum/internship students from HTEM. Stop by our table or email your resume — paid training shifts and real event experience.",
    ],
    status: "ready",
    notes: [
      "GMU is the documented model; American University and others can reuse the same playbook when contacts are added.",
    ],
  },
  {
    label: "University email blast",
    summary:
      "Email department chairs / HTEM faculty so they forward openings to students (internships and part-time in one blast). Can repeat through the year.",
    bestFor: ["Part-time", "Practicum", "Internship"],
    howTo: [
      "Draft a short outreach to faculty/chairs announcing open roles.",
      "Ask them to forward to students (practicum, internship, and part-time).",
      "Follow the July timeline: submit opportunities to Dr. Min Park when recruiting for academic programs.",
      "Process detail (exact owners, cadence, GMU distribution timing) is still incomplete — confirm with Dave.",
    ],
    links: [
      {
        label: "GMU Tourism & Events Management (HTEM)",
        url: "https://cehd.gmu.edu/tourism-and-events-management/",
      },
    ],
    contacts: [
      RECRUITMENT_CONTACTS[0],
      RECRUITMENT_CONTACTS[1],
      RECRUITMENT_CONTACTS[2],
    ],
    activeMonths: [3, 4, 5, 7, 11],
    events: [],
    copyHints: [
      "Subject: Mangia DC — Event Support openings (part-time / practicum / internship)\n\nHello — Mangia DC is hiring Event Support Associates and welcoming TOUR 241 practicum (120h) and TOUR 490 internship (400h) students. Could you please forward this to interested HTEM students? Résumés can be sent to [insert inbox]. Thank you!",
    ],
    status: "needs_detail",
    notes: [
      "Handbook placeholder: INSERT DETAIL ON THE INTERNAL EMAIL BLAST — what is the process, who do you reach out to, and when does GMU distribute to students? Ask Dave.",
    ],
  },
  {
    label: "Company website",
    summary:
      "Post openings on Mangia DC’s own site / careers page for part-time and contractor roles.",
    bestFor: ["Part-time", "Contractor"],
    howTo: [
      "Confirm the live careers/apply URL with Dave or marketing before advertising it.",
      "Mirror the Indeed blurb for consistency.",
      "Tag inbound applicants with source = Company website.",
    ],
    links: [],
    contacts: [],
    events: [],
    copyHints: [
      "Join Mangia DC’s event team — flexible shifts, guest-facing hospitality work in Washington, DC. Apply on our website or email your resume.",
    ],
    status: "ready",
    notes: [
      "Exact public apply URL not in the handbook — add when confirmed.",
    ],
  },
  {
    label: "Other",
    summary:
      "Catch-all for channels not in the standard list (use Source detail).",
    bestFor: ["Part-time", "Practicum", "Internship", "Contractor"],
    howTo: [
      "Prefer a listed source when possible for reporting.",
      "If you must use Other, fill Source detail (e.g. American University fair, Facebook group).",
      "Do not default to LinkedIn for Event Support Associate unless Dave expands the channel list.",
    ],
    links: [],
    contacts: [],
    events: [],
    copyHints: [],
    status: "ready",
    notes: [
      "LinkedIn is typically not used for Operations Support Associates (Dave).",
    ],
  },
];
