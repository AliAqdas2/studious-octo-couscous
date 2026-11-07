import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users } from 'lucide-react';

function formatUpdatedAt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

/**
 * Read-only Attendee List status shared by Deposit Intake + Artifacts (CRM-11).
 * Source of truth is event_attendees + events.attendee_list_updated_*.
 */
export default function AttendeeListStatus({
  eventId,
  event = null,
  className = '',
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['event-attendees', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getEventAttendees', {
        eventId,
      });
      return res?.data ?? res;
    },
    enabled: Boolean(eventId),
  });

  const count =
    data?.count ??
    (Array.isArray(data?.attendees) ? data.attendees.length : null) ??
    null;

  const updatedAt =
    data?.attendee_list_updated_at ||
    event?.attendee_list_updated_at ||
    event?.attendeeListUpdatedAt ||
    null;
  const updatedBy =
    data?.attendee_list_updated_by_name ||
    event?.attendee_list_updated_by_name ||
    event?.attendeeListUpdatedByName ||
    null;

  const href = eventId
    ? `${window.location.pathname}?id=${encodeURIComponent(eventId)}#section-attendees`
    : '#section-attendees';

  return (
    <div
      className={`rounded-md border border-orange-100 bg-white/70 px-3 py-2.5 space-y-1 ${className}`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <Users className="w-4 h-4 text-[#C84B31] shrink-0" />
        <span>
          Attendee List
          {isLoading
            ? ': …'
            : count != null
              ? `: ${count} guest${count === 1 ? '' : 's'}`
              : ''}
        </span>
      </div>
      {updatedAt ? (
        <p className="text-xs text-gray-600">
          Last updated {formatUpdatedAt(updatedAt)}
          {updatedBy ? ` by ${updatedBy}` : ''}
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          No list imported yet — manage in Attendees.
        </p>
      )}
      <a
        href={href}
        className="inline-block text-xs font-medium text-[#C84B31] underline underline-offset-2 hover:text-[#A03A23]"
        onClick={(e) => {
          const el = document.getElementById('section-attendees');
          if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (eventId) {
              const params = new URLSearchParams(window.location.search);
              params.set('id', eventId);
              window.history.replaceState(
                {},
                '',
                `${window.location.pathname}?${params.toString()}#section-attendees`
              );
            }
          }
        }}
      >
        Open Attendees section
      </a>
    </div>
  );
}
