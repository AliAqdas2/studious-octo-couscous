/**
 * Event ops milestone deadlines (aligned with workflow phases).
 * Offsets are days before event_date.
 */

export const MILESTONE_OFFSETS = {
  deposit: null, // always until done once deposit exists
  ros_schedule: 18, // ~2.5 weeks
  ros_complete: 14,
  inventory: 7,
  beo: 3,
  artifacts: 3, // same window as BEO — Ops shell + FareHarbor
};

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole calendar days until event date (negative if past). */
export function daysUntilEvent(eventDate, now = new Date()) {
  if (!eventDate) return null;
  const event = startOfDay(eventDate);
  const today = startOfDay(now);
  return Math.round((event.getTime() - today.getTime()) / 86400000);
}

export function formatDaysUntilEvent(days) {
  if (days == null || Number.isNaN(days)) return null;
  if (days > 1) return `${days} days remaining`;
  if (days === 1) return '1 day remaining';
  if (days === 0) return 'Today';
  if (days === -1) return '1 day past';
  return `${Math.abs(days)} days past`;
}

/**
 * Days until a milestone due date (eventDate - offsetDays).
 * offsetDays null = due immediately (0 days left until "done").
 */
export function daysUntilMilestoneDue(eventDate, offsetDays, now = new Date()) {
  if (!eventDate) return null;
  if (offsetDays == null) return 0;
  const due = startOfDay(eventDate);
  due.setDate(due.getDate() - offsetDays);
  const today = startOfDay(now);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/** Human label for panel headings. */
export function formatMilestoneCountdown(daysLeft) {
  if (daysLeft == null || Number.isNaN(daysLeft)) return null;
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === -1) return 'Overdue by 1 day';
  return `Overdue by ${Math.abs(daysLeft)} days`;
}

function parseRos(event) {
  const raw = event?.run_of_show ?? event?.runOfShow;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return raw;
}

function hasDeposit(event) {
  return Boolean(
    event?.deposit_received ||
      event?.depositReceived ||
      event?.deposit_received_at ||
      event?.depositReceivedAt
  );
}

function depositComplete(event) {
  return Boolean(
    event?.deposit_intake_completed_at || event?.depositIntakeCompletedAt
  );
}

function beoSaved(event) {
  return Boolean(
    event?.beo_document_updated_at ||
      event?.beoDocumentUpdatedAt ||
      event?.beo_document_html ||
      event?.beoDocumentHtml
  );
}

/** Ops day-of essentials: BEO Shell + FareHarbor embed. */
export function artifactsComplete(event) {
  const shell = String(
    event?.beo_shell_url || event?.beoShellUrl || ''
  ).trim();
  const fh = String(
    event?.fareharbor_link || event?.fareharborLink || ''
  ).trim();
  return Boolean(shell) && Boolean(fh);
}

/**
 * @param {object} event
 * @param {{ hasInventory?: boolean, now?: Date }} [opts]
 * @returns {{ id: string, label: string, urgency: number, daysLeft: number|null }[]}
 */
export function getEventAlerts(event, opts = {}) {
  const now = opts.now || new Date();
  const days = daysUntilEvent(event?.event_date || event?.eventDate, now);
  if (days == null) return [];

  const ros = parseRos(event);
  const alerts = [];

  if (hasDeposit(event) && !depositComplete(event)) {
    alerts.push({
      id: 'deposit',
      label: 'Deposit intake incomplete',
      urgency: 100,
      daysLeft: daysUntilMilestoneDue(
        event.event_date || event.eventDate,
        MILESTONE_OFFSETS.deposit,
        now
      ),
    });
  }

  const inRosScheduleWindow =
    days <= MILESTONE_OFFSETS.ros_schedule;
  if (inRosScheduleWindow && !ros.scheduledAt) {
    const daysLeft = daysUntilMilestoneDue(
      event.event_date || event.eventDate,
      MILESTONE_OFFSETS.ros_schedule,
      now
    );
    alerts.push({
      id: 'ros_schedule',
      label: 'Run of Show not scheduled',
      urgency: 90 + Math.max(0, -daysLeft),
      daysLeft,
    });
  }

  const inRosCompleteWindow = days <= MILESTONE_OFFSETS.ros_complete;
  if (inRosCompleteWindow && ros.scheduledAt && !ros.completedAt) {
    const daysLeft = daysUntilMilestoneDue(
      event.event_date || event.eventDate,
      MILESTONE_OFFSETS.ros_complete,
      now
    );
    alerts.push({
      id: 'ros_complete',
      label: 'Run of Show incomplete',
      urgency: 80 + Math.max(0, -daysLeft),
      daysLeft,
    });
  }

  if (
    opts.hasInventory === false &&
    days <= MILESTONE_OFFSETS.inventory
  ) {
    const daysLeft = daysUntilMilestoneDue(
      event.event_date || event.eventDate,
      MILESTONE_OFFSETS.inventory,
      now
    );
    alerts.push({
      id: 'inventory',
      label: 'Inventory not loaded',
      urgency: 70 + Math.max(0, -daysLeft),
      daysLeft,
    });
  }

  if (!beoSaved(event) && days <= MILESTONE_OFFSETS.beo) {
    const daysLeft = daysUntilMilestoneDue(
      event.event_date || event.eventDate,
      MILESTONE_OFFSETS.beo,
      now
    );
    alerts.push({
      id: 'beo',
      label: 'BEO not saved',
      urgency: 60 + Math.max(0, -daysLeft),
      daysLeft,
    });
  }

  if (
    !artifactsComplete(event) &&
    days <= MILESTONE_OFFSETS.artifacts
  ) {
    const daysLeft = daysUntilMilestoneDue(
      event.event_date || event.eventDate,
      MILESTONE_OFFSETS.artifacts,
      now
    );
    alerts.push({
      id: 'artifacts',
      label: 'Artifact links incomplete',
      urgency: 55 + Math.max(0, -daysLeft),
      daysLeft,
    });
  }

  return alerts.sort((a, b) => b.urgency - a.urgency);
}

export function getTopEventAlerts(event, opts = {}, limit = 2) {
  return getEventAlerts(event, opts).slice(0, limit);
}

/**
 * Panel heading countdown for a specific milestone key.
 * Returns null when milestone is already complete.
 */
export function getPanelMilestoneLabel(milestoneId, event, opts = {}) {
  const now = opts.now || new Date();
  const eventDate = event?.event_date || event?.eventDate;
  const ros = parseRos(event);

  if (milestoneId === 'deposit') {
    if (depositComplete(event)) return null;
    if (!hasDeposit(event)) return null;
    const days = daysUntilEvent(eventDate, now);
    if (days != null && days < 0) return 'Overdue';
    return 'Complete ASAP';
  }
  if (milestoneId === 'ros_schedule') {
    if (ros.scheduledAt) return null;
    const daysLeft = daysUntilMilestoneDue(
      eventDate,
      MILESTONE_OFFSETS.ros_schedule,
      now
    );
    const label = formatMilestoneCountdown(daysLeft);
    return label ? `${label} to schedule` : null;
  }
  if (milestoneId === 'ros_complete') {
    if (ros.completedAt) return null;
    if (!ros.scheduledAt) return null;
    const daysLeft = daysUntilMilestoneDue(
      eventDate,
      MILESTONE_OFFSETS.ros_complete,
      now
    );
    const label = formatMilestoneCountdown(daysLeft);
    return label ? `${label} to complete` : null;
  }
  if (milestoneId === 'ros') {
    if (ros.completedAt && ros.scheduledAt) return null;
    if (!ros.scheduledAt) {
      return getPanelMilestoneLabel('ros_schedule', event, opts);
    }
    return getPanelMilestoneLabel('ros_complete', event, opts);
  }
  if (milestoneId === 'inventory') {
    if (opts.hasInventory) return null;
    const daysLeft = daysUntilMilestoneDue(
      eventDate,
      MILESTONE_OFFSETS.inventory,
      now
    );
    return formatMilestoneCountdown(daysLeft);
  }
  if (milestoneId === 'beo') {
    if (beoSaved(event)) return null;
    const daysLeft = daysUntilMilestoneDue(
      eventDate,
      MILESTONE_OFFSETS.beo,
      now
    );
    return formatMilestoneCountdown(daysLeft);
  }
  if (milestoneId === 'artifacts') {
    if (artifactsComplete(event)) return null;
    const daysLeft = daysUntilMilestoneDue(
      eventDate,
      MILESTONE_OFFSETS.artifacts,
      now
    );
    return formatMilestoneCountdown(daysLeft);
  }
  return null;
}
