import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Calendar, User, Building2, ExternalLink, AlertTriangle } from 'lucide-react';

export default function CalendarEventPopover({ item, type, children }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const timerRef = useRef(null);

  const showPopover = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 280;
      const viewportWidth = window.innerWidth;

      let left = rect.right + 8;
      if (left + popoverWidth > viewportWidth - 16) {
        left = rect.left - popoverWidth - 8;
      }

      setPos({ top: rect.top + window.scrollY, left });
      setVisible(true);
    }, 300);
  };

  const hidePopover = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 100);
  };

  const keepOpen = () => clearTimeout(timerRef.current);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const date = new Date(item.date);
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const isTodo = item.isTodo;
  const todoColor = item.warningType === 'no_response'
    ? 'border-red-300 bg-red-50'
    : item.warningType === 'no_email'
    ? 'border-orange-300 bg-orange-50'
    : 'border-green-300 bg-green-50';

  const todoBadgeColor = item.warningType === 'no_response'
    ? 'bg-red-100 text-red-800'
    : item.warningType === 'no_email'
    ? 'bg-orange-100 text-orange-800'
    : 'bg-green-100 text-green-800';

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showPopover}
        onMouseLeave={hidePopover}
      >
        {children}
      </div>

      {visible && (
        <div
          ref={popoverRef}
          onMouseEnter={keepOpen}
          onMouseLeave={hidePopover}
          style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 280 }}
          className={`rounded-xl border shadow-xl bg-white text-sm overflow-hidden ${isTodo ? todoColor : 'border-gray-200'}`}
        >
          {/* Header */}
          <div className={`px-4 py-3 border-b ${isTodo ? '' : 'bg-orange-50 border-orange-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                  isTodo
                    ? item.warningType === 'no_response' ? 'text-red-500'
                    : item.warningType === 'no_email' ? 'text-orange-500'
                    : item.warningType === 'followup' ? 'text-green-600'
                    : 'text-gray-400'
                  : type === 'event' ? 'text-emerald-600' : 'text-blue-500'
                }">
                  {isTodo
                    ? item.warningType === 'followup' ? '📅 Follow-Up'
                    : item.warningType === 'no_response' ? '⚠️ No Response'
                    : item.warningType === 'no_email' ? '📧 Email Needed'
                    : 'To-Do'
                    : type === 'event' ? '🎉 Event'
                    : '🤝 Meeting'
                  }
                </p>
                <p className="font-semibold text-gray-900 leading-tight">{item.title}</p>
              </div>
              {isTodo
                ? <Badge className={`text-xs flex-shrink-0 ${todoBadgeColor}`}>{item.status}</Badge>
                : item.badge && <Badge className={`text-xs flex-shrink-0 ${item.badgeClass}`}>{item.badge}</Badge>
              }
            </div>
            {item.subtitle && (
              <p className="text-xs text-gray-500 mt-1">{item.subtitle}</p>
            )}
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="text-xs">{dateStr}</span>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="text-xs">{timeStr}</span>
            </div>

            {/* Lead-specific */}
            {!isTodo && type === 'lead' && item.company && (
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span className="text-xs">{item.company}</span>
              </div>
            )}
            {!isTodo && type === 'lead' && item.name && item.company && (
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span className="text-xs">{item.name}</span>
              </div>
            )}
            {!isTodo && item.stage && (
              <div className="mt-1">
                <Badge className={`text-xs ${item.stageClass}`}>{item.stage}</Badge>
              </div>
            )}

            {/* Event-specific */}
            {!isTodo && type === 'event' && item.venue && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                <span className="text-xs">{item.venue}</span>
              </div>
            )}

            {/* Todo warning text */}
            {isTodo && item.warningText && (
              <div className="flex items-start gap-2 text-gray-600">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500 mt-0.5" />
                <span className="text-xs">{item.warningText}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <Link to={item.link} className="flex items-center gap-1 text-xs text-[#C84B31] hover:underline font-medium">
              <ExternalLink className="w-3 h-3" />
              {isTodo ? 'View Lead' : type === 'lead' ? 'View Lead' : 'View Event'}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}