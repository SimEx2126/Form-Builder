// Pre-made form templates, grouped by audience.
//
// This is just data — edit freely to add/remove audiences, categories, or
// fields. Field shape matches the builder: { type, label, required, options? }.
// Field types: short_text | long_text | email | dropdown | multiple_choice | file

export const AUDIENCES = [
  { key: "parent", label: "Parent / Guardian", icon: "👪" },
  { key: "volunteer", label: "Volunteer", icon: "🙌" },
  { key: "event", label: "Event / Program", icon: "📅" },
  { key: "student", label: "Student", icon: "🎓" },
  { key: "teacher", label: "Teacher", icon: "🧑‍🏫" },
  { key: "employer", label: "Employer", icon: "💼" },
  { key: "church", label: "Church", icon: "⛪" },
  { key: "organization", label: "Organization", icon: "🏢" },
  { key: "other", label: "Other", icon: "✏️" },
];

export const audienceLabel = (key) =>
  AUDIENCES.find((a) => a.key === key)?.label || key;

const t = (type, label, required = false, options) => ({
  type,
  label,
  required,
  ...(options ? { options } : {}),
});

export const TEMPLATES = {
  parent: [
    {
      id: "consent",
      name: "Permission / Consent Slip",
      description: "Get a parent's permission for an activity or trip.",
      fields: [
        t("short_text", "Parent / guardian name", true),
        t("short_text", "Child's name", true),
        t("short_text", "Activity / event", true),
        t("short_text", "Date(s)"),
        t("dropdown", "I give permission", true, ["Yes", "No"]),
        t("short_text", "Emergency contact number", true),
        t("long_text", "Notes / conditions"),
      ],
    },
    {
      id: "enrolment",
      name: "Enrolment / Registration",
      description: "Register a child, with supporting documents.",
      fields: [
        t("short_text", "Child's full name", true),
        t("short_text", "Date of birth (YYYY-MM-DD)"),
        t("short_text", "Parent / guardian name", true),
        t("email", "Email", true),
        t("short_text", "Phone"),
        t("long_text", "Allergies / special needs"),
        t("file", "Supporting documents"),
      ],
    },
    {
      id: "absence",
      name: "Absence Notification",
      description: "Notify of a student's absence.",
      fields: [
        t("short_text", "Student name", true),
        t("short_text", "Parent / guardian name", true),
        t("short_text", "Date(s) of absence", true),
        t("dropdown", "Reason", true, ["Illness", "Family", "Appointment", "Other"]),
        t("long_text", "Details"),
      ],
    },
    {
      id: "feedback",
      name: "Feedback",
      description: "Collect feedback from parents.",
      fields: [
        t("short_text", "Name (optional)"),
        t("email", "Email"),
        t("dropdown", "Overall rating", false, ["1", "2", "3", "4", "5"]),
        t("long_text", "Your message", true),
      ],
    },
  ],

  volunteer: [
    {
      id: "application",
      name: "Volunteer Application",
      description: "Sign up new volunteers.",
      fields: [
        t("short_text", "Full name", true),
        t("email", "Email", true),
        t("short_text", "Phone"),
        t("multiple_choice", "Areas of interest", false, [
          "Events", "Hospitality", "Children / Youth", "Admin", "Outreach", "Media",
        ]),
        t("long_text", "Relevant experience"),
      ],
    },
    {
      id: "availability",
      name: "Availability / Roster Sign-up",
      description: "Find out when volunteers are available.",
      fields: [
        t("short_text", "Name", true),
        t("email", "Email"),
        t("multiple_choice", "Available days", false, [
          "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
        ]),
        t("long_text", "Preferred times / notes"),
      ],
    },
    {
      id: "clearance",
      name: "Clearance / Documents",
      description: "Collect police checks, WWC, or references.",
      fields: [
        t("short_text", "Full name", true),
        t("dropdown", "Document type", true, [
          "Police check", "Working with Children", "Reference", "Other",
        ]),
        t("file", "Upload document", true),
        t("short_text", "Expiry date (YYYY-MM-DD)"),
      ],
    },
    {
      id: "hours_log",
      name: "Hours Log",
      description: "Log volunteer hours.",
      fields: [
        t("short_text", "Volunteer name", true),
        t("short_text", "Date (YYYY-MM-DD)", true),
        t("short_text", "Hours", true),
        t("long_text", "Activity"),
      ],
    },
  ],

  event: [
    {
      id: "registration",
      name: "Event Registration / RSVP",
      description: "Let people register or RSVP for an event.",
      fields: [
        t("short_text", "Full name", true),
        t("email", "Email", true),
        t("short_text", "Number attending"),
        t("long_text", "Dietary / accessibility needs"),
      ],
    },
    {
      id: "booking",
      name: "Booking Request",
      description: "Request a venue, space, or program slot.",
      fields: [
        t("short_text", "Name", true),
        t("email", "Email", true),
        t("short_text", "Space / resource requested", true),
        t("short_text", "Preferred date (YYYY-MM-DD)"),
        t("long_text", "Details"),
      ],
    },
    {
      id: "post_event_feedback",
      name: "Post-event Feedback",
      description: "Gather feedback after an event.",
      fields: [
        t("short_text", "Name (optional)"),
        t("dropdown", "Overall rating", true, ["1", "2", "3", "4", "5"]),
        t("long_text", "What went well?"),
        t("long_text", "Suggestions"),
      ],
    },
    {
      id: "roster",
      name: "Volunteer Roster",
      description: "Sign up helpers for an event.",
      fields: [
        t("short_text", "Name", true),
        t("email", "Email"),
        t("dropdown", "Preferred role", false, [
          "Setup", "Welcome / door", "Catering", "Tech / media", "Pack-down",
        ]),
        t("multiple_choice", "Available", false, ["Morning", "Afternoon", "Evening"]),
      ],
    },
  ],

  student: [
    {
      id: "attendance",
      name: "Attendance",
      description: "Record who attended a class or session.",
      fields: [
        t("short_text", "Student name", true),
        t("short_text", "Student ID"),
        t("short_text", "Date (YYYY-MM-DD)", true),
        t("dropdown", "Status", true, ["Present", "Absent", "Late", "Excused"]),
        t("long_text", "Notes"),
      ],
    },
    {
      id: "survey",
      name: "Survey",
      description: "Collect feedback or opinions from students.",
      fields: [
        t("short_text", "Name"),
        t("email", "Email"),
        t("dropdown", "Overall rating", true, ["1", "2", "3", "4", "5"]),
        t("long_text", "What went well?"),
        t("long_text", "What could be improved?"),
      ],
    },
    {
      id: "project",
      name: "Project Submission",
      description: "Submit a project with files.",
      fields: [
        t("short_text", "Project title", true),
        t("long_text", "Team members"),
        t("long_text", "Description"),
        t("file", "Project files", true),
      ],
    },
  ],

  teacher: [
    {
      id: "survey",
      name: "Survey",
      description: "Gather feedback from students.",
      fields: [
        t("short_text", "Student name"),
        t("short_text", "Class / section"),
        t("dropdown", "Overall rating", true, ["1", "2", "3", "4", "5"]),
        t("long_text", "What did you enjoy most?"),
        t("long_text", "What could be improved?"),
      ],
    },
    {
      id: "quiz",
      name: "Quiz",
      description: "A short quiz — edit the questions to suit.",
      fields: [
        t("short_text", "Student name", true),
        t("short_text", "Class / section"),
        t("long_text", "Question 1"),
        t("long_text", "Question 2"),
        t("long_text", "Question 3"),
      ],
    },
    {
      id: "exam",
      name: "Exam",
      description: "An exam with written answers and an optional answer sheet.",
      fields: [
        t("short_text", "Student name", true),
        t("short_text", "Student ID"),
        t("short_text", "Subject"),
        t("long_text", "Answers"),
        t("file", "Upload answer sheet"),
      ],
    },
    {
      id: "essay",
      name: "Essay",
      description: "Collect a written essay, typed or attached.",
      fields: [
        t("short_text", "Student name", true),
        t("short_text", "Class / section"),
        t("short_text", "Essay title"),
        t("long_text", "Your essay"),
        t("file", "Upload essay (optional)"),
      ],
    },
  ],

  employer: [
    {
      id: "report",
      name: "Report",
      description: "Submit a periodic report, with an optional attachment.",
      fields: [
        t("short_text", "Employee name", true),
        t("short_text", "Department"),
        t("short_text", "Reporting period"),
        t("long_text", "Summary", true),
        t("file", "Attach report"),
      ],
    },
    {
      id: "attendance",
      name: "Attendance",
      description: "Log employee attendance.",
      fields: [
        t("short_text", "Employee name", true),
        t("short_text", "Employee ID"),
        t("short_text", "Date (YYYY-MM-DD)", true),
        t("dropdown", "Status", true, ["Present", "Absent", "Leave", "Remote"]),
      ],
    },
    {
      id: "leave_request",
      name: "Leave Request",
      description: "Request time off, with supporting documents.",
      fields: [
        t("short_text", "Employee name", true),
        t("dropdown", "Leave type", true, ["Annual", "Sick", "Unpaid", "Other"]),
        t("short_text", "Start date (YYYY-MM-DD)", true),
        t("short_text", "End date (YYYY-MM-DD)", true),
        t("long_text", "Reason"),
        t("file", "Supporting document"),
      ],
    },
  ],

  church: [
    {
      id: "event_registration",
      name: "Event Registration",
      description: "Let people register for an event.",
      fields: [
        t("short_text", "Full name", true),
        t("email", "Email", true),
        t("short_text", "Phone"),
        t("short_text", "Number attending"),
        t("long_text", "Notes / special requests"),
      ],
    },
    {
      id: "attendance",
      name: "Attendance",
      description: "Record attendance for a service or group.",
      fields: [
        t("short_text", "Member name", true),
        t("short_text", "Service / date", true),
        t("dropdown", "Group", false, ["Adults", "Youth", "Children", "Guest"]),
      ],
    },
    {
      id: "volunteer",
      name: "Volunteer Sign-up",
      description: "Recruit volunteers and their availability.",
      fields: [
        t("short_text", "Name", true),
        t("email", "Email", true),
        t("multiple_choice", "Areas of interest", false, [
          "Worship", "Hospitality", "Children", "Media", "Outreach",
        ]),
        t("long_text", "Availability"),
      ],
    },
    {
      id: "prayer_request",
      name: "Prayer Request",
      description: "Collect prayer requests.",
      fields: [
        t("short_text", "Name (optional)"),
        t("long_text", "Your request", true),
        t("dropdown", "Keep this private?", false, ["Yes", "No"]),
      ],
    },
  ],

  organization: [
    {
      id: "general_survey",
      name: "General Survey",
      description: "A simple feedback survey.",
      fields: [
        t("short_text", "Name"),
        t("email", "Email"),
        t("dropdown", "Overall rating", true, ["1", "2", "3", "4", "5"]),
        t("long_text", "Your feedback"),
      ],
    },
    {
      id: "incident_report",
      name: "Incident Report",
      description: "Report an incident, with photos or files.",
      fields: [
        t("short_text", "Reporter name", true),
        t("short_text", "Date (YYYY-MM-DD)", true),
        t("short_text", "Location"),
        t("long_text", "Description", true),
        t("file", "Photos / files"),
      ],
    },
    {
      id: "membership",
      name: "Membership Application",
      description: "Apply to join, with supporting documents.",
      fields: [
        t("short_text", "Full name", true),
        t("email", "Email", true),
        t("short_text", "Phone"),
        t("long_text", "Reason for joining"),
        t("file", "Supporting document"),
      ],
    },
    {
      id: "feedback",
      name: "Feedback",
      description: "Open feedback or complaints box.",
      fields: [
        t("short_text", "Name (optional)"),
        t("dropdown", "Category", false, ["Suggestion", "Complaint", "Compliment", "Other"]),
        t("long_text", "Your message", true),
      ],
    },
  ],
};

// Look up one template by "audienceKey.categoryId".
export function findTemplate(ref) {
  if (!ref) return null;
  const [aud, catId] = ref.split(".");
  const cat = (TEMPLATES[aud] || []).find((c) => c.id === catId);
  return cat ? { audience: aud, category: cat } : null;
}
