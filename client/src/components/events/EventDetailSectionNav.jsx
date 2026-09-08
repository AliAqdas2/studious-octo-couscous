import React from 'react';

/**
 * Sticky jump links for Event Detail → Details tab panels.
 *
 * @param {{
 *   items: Array<{ id: string, label: string }>,
 * }} props
 */
const EventDetailSectionNav = ({ items = [] }) => {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Event detail sections"
      className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-gradient-to-b from-[#FDF8F4] via-[#FDF8F4]/95 to-transparent"
    >
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-orange-100 bg-white/90 p-2 shadow-sm">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:text-[#C84B31]"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(item.id);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                window.history.replaceState(
                  null,
                  '',
                  `${window.location.pathname}${window.location.search}#${item.id}`
                );
              }
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
};

export default EventDetailSectionNav;
