import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock } from 'lucide-react';
import CalendarEventPopover from './CalendarEventPopover';

function getDaysInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth, year, month };
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function CalendarGrid({ currentDate, items, type, onDateChange }) {
  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentDate);
  const today = new Date();
  const [dragOverDay, setDragOverDay] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // Group items by day
  const itemsByDay = {};
  items.forEach(item => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!itemsByDay[key]) itemsByDay[key] = [];
    itemsByDay[key].push(item);
  });

  const handleDragStart = (e, item) => {
    setDraggingId(item.id);
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverDay(null);
  };

  const handleDrop = (e, day) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    const item = items.find(i => i.id === itemId);
    if (!item || !onDateChange) return;

    // Preserve the original time, just change the date
    const originalDate = new Date(item.date);
    const newDate = new Date(year, month, day,
      originalDate.getHours(),
      originalDate.getMinutes(),
      originalDate.getSeconds()
    );
    onDateChange(itemId, newDate.toISOString());
    setDragOverDay(null);
    setDraggingId(null);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="min-h-[120px] bg-gray-50/50 border border-gray-100 rounded-lg" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const key = `${year}-${month}-${day}`;
    const dayItems = itemsByDay[key] || [];
    const isToday = isSameDay(dateObj, today);
    const isDragOver = dragOverDay === day;

    cells.push(
      <div
        key={day}
        onDragOver={(e) => { e.preventDefault(); setDragOverDay(day); }}
        onDragLeave={() => setDragOverDay(null)}
        onDrop={(e) => handleDrop(e, day)}
        className={`min-h-[120px] border rounded-lg p-1.5 transition-colors ${
          isDragOver ? 'bg-orange-100 border-[#C84B31] border-2' :
          isToday ? 'bg-orange-50 border-[#C84B31]' :
          'bg-white border-gray-200 hover:border-orange-200'
        }`}
      >
        <div className={`text-xs font-semibold mb-1 px-1 ${isToday ? 'text-[#C84B31]' : 'text-gray-500'}`}>
          {day}
        </div>
        <div className="space-y-1 overflow-y-auto max-h-[90px]">
          {dayItems.map(item => (
            <CalendarEventPopover key={item.id} item={item} type={type}>
              <div
                draggable={!item.isTodo}
                onDragStart={!item.isTodo ? (e) => handleDragStart(e, item) : undefined}
                onDragEnd={!item.isTodo ? handleDragEnd : undefined}
                className={`px-1.5 py-1 rounded text-xs border transition-colors truncate select-none ${
                  item.isTodo
                    ? item.warningType === 'no_response'
                      ? 'bg-red-50 border-red-200 cursor-pointer'
                      : item.warningType === 'no_email'
                      ? 'bg-blue-50 border-blue-200 cursor-pointer'
                      : 'bg-green-50 border-green-200 cursor-pointer'
                    : `bg-orange-50 hover:bg-orange-100 border-orange-100 cursor-grab active:cursor-grabbing ${draggingId === item.id ? 'opacity-50' : ''}`
                }`}
              >
                <Link to={item.link} onClick={(e) => draggingId && e.preventDefault()}>
                  <p className={`font-medium truncate ${
                    item.isTodo
                      ? item.warningType === 'no_response' ? 'text-red-800'
                      : item.warningType === 'no_email' ? 'text-blue-800'
                      : 'text-green-800'
                      : 'text-gray-900'
                  }`}>{item.title}</p>
                  <p className="text-gray-500 truncate">{item.subtitle}</p>
                  {type === 'event' && item.venue && (
                    <p className="text-gray-400 truncate flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />{item.venue}
                    </p>
                  )}
                </Link>
              </div>
            </CalendarEventPopover>
          ))}
        </div>
      </div>
    );
  }

  const monthItems = items
    .filter(item => {
      const d = new Date(item.date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-6 mt-4">
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells}
        </div>
      </div>

      {monthItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">
            {type === 'lead' ? 'Lead Meetings' : 'Events'} this month ({monthItems.length})
          </h3>
          <div className="space-y-2">
            {monthItems.map(item => (
              <Link key={item.id} to={item.link}>
                <div className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-orange-200 transition-all cursor-pointer">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-gray-500">
                      {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className="text-lg font-bold text-[#C84B31]">
                      {new Date(item.date).getDate()}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                      {type === 'lead' && item.badge && (
                        <Badge className={`${item.badgeClass} text-xs`}>{item.badge}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                    {type === 'lead' && item.company && item.name && (
                      <p className="text-xs text-gray-400 truncate">Contact: {item.name}</p>
                    )}
                    {type === 'event' && item.venue && (
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{item.venue}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {item.stage && (
                      <Badge className={`${item.stageClass} text-xs mt-1`}>{item.stage}</Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {monthItems.length === 0 && (
        <p className="text-center text-gray-400 py-6 text-sm">
          No {type === 'lead' ? 'lead meetings' : 'events'} this month
        </p>
      )}
    </div>
  );
}