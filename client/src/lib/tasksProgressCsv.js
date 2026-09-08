/**
 * Build and download a CSV of task progress rows.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCsvCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {string}
 */
export function buildTasksProgressCsv(rows) {
  const headers = [
    'Event',
    'Task',
    'Status',
    'Responsible Role',
    'Assignee',
    'Due Date',
    'Overdue',
    'Category',
    'Phase',
    'Event ID',
    'Task ID',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows || []) {
    lines.push(
      [
        row.eventName,
        row.title,
        row.status,
        row.responsibleRole,
        row.assigneeName,
        row.dueDate,
        row.overdue,
        row.category,
        row.phase,
        row.eventId,
        row.taskId,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

/**
 * @param {string} filename
 * @param {string} text
 */
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * @param {Date} [now]
 * @returns {string}
 */
export function taskProgressCsvFilename(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `task-progress-${y}-${m}-${d}.csv`;
}
