/**
 * Client Communication stage catalog + script bodies.
 * Cooking "simple track" = client's 11 named steps (showInSimpleTrack).
 */

export type ClientCommDueAnchor = "before_event" | "after_event" | "none";
export type ClientCommEventTypeScope = "all" | "food_tour" | "cooking";

export interface ClientCommStageDefSeed {
  slug: string;
  title: string;
  sortOrder: number;
  subject: string | null;
  body: string;
  defaultOwnerRole: string;
  dueOffsetDays: number | null;
  dueAnchor: ClientCommDueAnchor;
  eventTypeScope: ClientCommEventTypeScope;
  /** Cooking Class UI shows only these (client's short list). */
  showInSimpleTrack: boolean;
}

/** Ordered slugs for Cooking Class simple Client Communication track. */
export const COOKING_SIMPLE_COMM_SLUGS = [
  "request_participation_list",
  "participation_list_reminder",
  "schedule_ros_meeting",
  "conduct_ros_meeting",
  "collect_remaining_balance",
  "remaining_balance_reminder",
  "send_cc_authorization",
  "directional_flyer",
  "thank_you_no_invoice",
  "thank_you_with_invoice",
  "referral_request",
] as const;

/**
 * Duplicate extras removed from the catalog (same bodies as simple-track stages).
 * Kept as inactive in DB so existing event instances can be filtered/pruned.
 */
export const REMOVED_CLIENT_COMM_SLUGS = [
  "deposit_confirms_planning_timeline",
  "remaining_balance_cc_auth",
] as const;

/** Mutually exclusive thank-you variants (pick one). */
export const THANK_YOU_COMM_SLUGS = [
  "thank_you_no_invoice",
  "thank_you_with_invoice",
] as const;

export const CLIENT_COMM_STAGE_DEFS: ClientCommStageDefSeed[] = [
  // --- Cooking simple track (client's 11) ---
  {
    slug: "request_participation_list",
    title: "Request Participation List",
    sortOrder: 1,
    subject: "Participation details for <<event name>>",
    body: `Good morning <<name>>,

Payment received. We updated our system.
We need the following participation details to properly prepare for the upcoming <<event name>>: <<deposit Link>>
We'll need these details by <<14th day before the event>> or sooner.

Does this timeline work for you?
- <<name>> places deposit to reserve
- I send you a participation template
- <<name>> completes participation list by <<14th day before the event>>  send to me
- We schedule quick check-in to go over the run of show <<13th day before the event>>
- I send you the remaining balance invoice covering the final headcount <<12th day before the event>>

Look forward to further planning this with you… it's going to be a blast!`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 15,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "participation_list_reminder",
    title: "Send Participation List Reminder",
    sortOrder: 2,
    subject: "Friendly reminder — participation list for <<event name>>",
    body: `Good morning <<name>>

Hope you are well.

With the event soon coming around the corner, wanted to send you a friendly reminder to send us the final headcount to include:

First and Last Name Allergies Phone number (if in the event someone needs last-second directions) Insert Event Date

Please fill out the form for the participation list. We'll need these details by tomorrow noon.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 14,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "schedule_ros_meeting",
    title: "Schedule ROS Meeting",
    sortOrder: 3,
    subject:
      "Run of Show Planning Discussion – <<company name>>/ Mangia DC",
    body: `Run of Show Planning Discussion – <<company name>>/ Mangia DC
Dave from 202.769.4929 will contact <<POC>>from <<POC Number>>
If you could be by a computer for our discussion, I'd greatly appreciate it.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 14,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "conduct_ros_meeting",
    title: "Conduct ROS Meeting",
    sortOrder: 4,
    subject: "Run of Show Meeting — <<event name>>",
    body: `Refer to the CRM Checklist`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 12,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "collect_remaining_balance",
    title: "Collect Remaining Balance",
    sortOrder: 5,
    subject: "Remaining balance for <<event name>>",
    body: `Good morning <<name>>,

Hope you had a great weekend!

Thank you for sending us the attendee list. Attached is the itemized view.

Here is the remaining balance link -

Please let me know once processed and will confirm this hits our system.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 7,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "remaining_balance_reminder",
    title: "Send Remaining Balance Reminder",
    sortOrder: 6,
    subject: "Reminder — remaining balance for <<event name>>",
    body: `Good morning <<name>>,

Hope you had a great weekend.

A friendly reminder for the remaining balance for your upcoming retreat.
Here is the remaining balance invoice. (Remaining Balance Link:)
Please let me know once processed and will confirm this hits our system`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 5,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "send_cc_authorization",
    title: "Send Credit Card Authorization",
    sortOrder: 7,
    subject: "Credit card authorization — <<event name>>",
    body: `Good morning <<name>>,

We have two more items before the big day on <<event date>>.

Here is the remaining balance link: (Remaining Balance Link:). A separate email will be sent to you for the credit card authorization form for onsite consumption. Please fill it out and return it for our files.

Please let me know once processed today and will confirm it hits our system.

Happy Friday!`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 7,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "directional_flyer",
    title: "Create Directional Flyer",
    sortOrder: 8,
    subject: "Directions for <<event name>>",
    body: `Hi <<name>>,

Please find directions / the directional flyer for your upcoming <<event name>> on <<event date>>.

Starting location / venue: (INSERT STARTING LOCATION)

Let us know if you have any questions before the big day.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 3,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "thank_you_no_invoice",
    title: "Send Thank You Email",
    sortOrder: 9,
    subject: "Thank you from Mangia DC — <<event>>",
    body: `Hi <<name>>

On behalf of Mangia DC, I wanted to personally extend a warm thank you for joining us and to select us as your <<event>> experience provider to celebrate with you last Wednesday.

After speaking with my team, we can agree that we enjoyed working with you. Wonderful energy and an all-around great group. In the planning process, you were thorough, detail-oriented, and exactly the person we would want leading the group to successfully plan and implement this experience. Our goal was for everyone to have a blast and hope we accomplished that.

To kick your weekend off right, I've attached your team photo... we had a blast!

Your feedback is most welcome and appreciated. Look forward to your reply.

Sending warm vibes your way.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 1,
    dueAnchor: "after_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "thank_you_with_invoice",
    title: "Send Thank You Email – Consumption Invoice",
    sortOrder: 10,
    subject: "Thank you from Mangia DC — <<event>>",
    body: `Hi <<name>>,

On behalf of Mangia DC, I wanted to personally extend a warm thank you for joining us and to select us as your <<event>> experience provider to celebrate with you <<day of event>>.

After speaking with my team, we can agree that we enjoyed working with you. Wonderful energy and an all-around great group. In the planning process, you were thorough, detail-oriented, and exactly the person we would want leading the group to successfully plan and implement this experience. Our goal was for everyone to have a blast and hope we accomplished that.

I've attached your paid consumption invoice.

To kick your weekend off right, I've attached your team photo... we had a blast!

Your feedback is most welcome and appreciated. Look forward to your reply.

Sending warm vibes your way.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 1,
    dueAnchor: "after_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },
  {
    slug: "referral_request",
    title: "Referral Request",
    sortOrder: 11,
    subject: "Thank you for the kind introduction — Mangia DC family",
    body: `Our pleasure <<insert Client name>>. Introducing us to other colleagues is the kindest compliment we could receive!

As a token of our appreciation, I'd like to send you a Mangia DC T-shirt. You've been a wonderful champion of our organization, and can't thank you enough for your support. You've been part of the family, and now it's official! Thank you for being our champion and would love to mail you a T-Shirt...welcome to the family!

What is your T-shirt size preference and address do you recommend we send it to?

Also I'm attaching our fall/holiday catalog for in-person and remote group experiences.  As a quick sidebar I recall you had interest in considering a events (refer to notes: biannunally or quarterly or monthly) ...would welcome supporting you. Is that still an option?

Here to help and look forward to keeping in touch!`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 2,
    dueAnchor: "after_event",
    eventTypeScope: "all",
    showInSimpleTrack: true,
  },

  // --- Extra / non-simple (hidden on Cooking Class track) ---
  // Removed duplicates (same bodies as request_participation_list / send_cc_authorization):
  // deposit_confirms_planning_timeline, remaining_balance_cc_auth — see REMOVED_CLIENT_COMM_SLUGS
  {
    slug: "confirmed_payment",
    title: "Confirmed - Payment",
    sortOrder: 102,
    subject: "Thank you — payment confirmed",
    body: `Thank you so much for this. We updated our system.

Stay tuned for more details next week for planning this.

Look forward to further planning this with you.. it's going to be a blast!`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 0,
    dueAnchor: "none",
    eventTypeScope: "all",
    showInSimpleTrack: false,
  },
  {
    slug: "ros_discussion_calendar_invite",
    title: "Run of Show Discussion (Calendar Invite)",
    sortOrder: 103,
    subject:
      "Run of Show Planning Discussion – <<company name>>/ Mangia DC",
    body: `Run of Show Planning Discussion – <<company name>>/ Mangia DC
Dave from 202.769.4929 will contact <<POC>>from <<POC Number>>
If you could be by a computer for our discussion, I'd greatly appreciate it.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 13,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: false,
  },
  {
    slug: "ros_meeting",
    title: "Run of Show Meeting",
    sortOrder: 104,
    subject: "Run of Show Meeting — <<event name>>",
    body: `Refer to the CRM Checklist`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 13,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: false,
  },
  {
    slug: "post_ros_meeting_email",
    title: "Post Run of Show Meeting - Send email",
    sortOrder: 105,
    subject: "Menu recommendation after our Run of Show — <<event name>>",
    body: `Based on your allergies, my recommendation is to prepare a dish that will appeal to a wide range of participants, have an impressive presentation, and be delicious. I recommend our most popular and client favorite - starting with insalata caprese, followed by our competition to make ricotta gnocchi in a browned butter sage sauce, and concluding with our fall favorite - gelato, either salted caramel or mango sorbetto. I'm confident that your team will thoroughly enjoy this!

Menu Options:
Based on your allergies and goals to foster team building where everyone carnivores & vegetarians making everything together that they will both love. Our recommendations are below and our top picks are in bold & italics :

Appetizer
- Insalata Caprese with Strawberry Balsamic
- Risotto

Entree
- Ricotta and Gnocchi and brown butter sage sauce
Optional: Alfredo, Red, or White
- Ravioli in a Brown Butter Sauce sage sauce
- Optional: Alfredo, Red, or White

Dessert
- Tiramisu
- Gelato: Salted Caramel
- Sorbetto: Mango
- Dulce de leche`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 12,
    dueAnchor: "before_event",
    eventTypeScope: "cooking",
    showInSimpleTrack: false,
  },
  {
    slug: "remaining_balance",
    title: "Remaining Balance",
    sortOrder: 106,
    subject: "Remaining balance for <<event name>>",
    body: `Good morning <<name>>,

Hope you had a great weekend!

Thank you for sending us the attendee list. Attached is the itemized view.

Here is the remaining balance link -

Please let me know once processed and will confirm this hits our system.`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 12,
    dueAnchor: "before_event",
    eventTypeScope: "all",
    showInSimpleTrack: false,
  },
  {
    slug: "tour_guide_starting_location",
    title: "Tour Guide and Starting Location Template",
    sortOrder: 108,
    subject: "Food tour details — <<date>> <<time>>",
    body: `Please see the details below for your <<time>> food tour <<date>>.
   (INSERT STARTING LOCATION)

Tour guide:
Phone number:

Please contact your guide the day of should you have questions`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: 3,
    dueAnchor: "before_event",
    eventTypeScope: "food_tour",
    showInSimpleTrack: false,
  },
  {
    slug: "staffing_fee_conflict",
    title: "Staffing Fee Conflict Resolution Template",
    sortOrder: 109,
    subject: "Regarding your staffing fee question",
    body: `Good morning, <<name>>! Thank you for reaching out. I'm here to help address your question.

Please refer back to the documentation we discussed in detail over the phone, and take a look at the terms and conditions next to the booking process on the cost options page. During our conversation, we took the time to explain what you can expect and value transparency throughout the booking process. I appreciate your interest in reviewing the information to ensure everything is in order. I have forwarded the email to you to bring this to your attention.

I hope this clarifies things for you. Please let me know once you have reviewed the email and if no further questions, here is the remaining balance link: - Remaining Balance: CNO Financial Virtual Paint & Sip July 18th

Please let me know once processed and will confirm this hits our system.

Look forward to further planning this with you!`,
    defaultOwnerRole: "Sales",
    dueOffsetDays: null,
    dueAnchor: "none",
    eventTypeScope: "all",
    showInSimpleTrack: false,
  },
];
