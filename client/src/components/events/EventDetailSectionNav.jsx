import React, { useEffect, useState } from 'react';

/** Matches Layout.jsx fixed header height (pt-[73px]). */
const APP_HEADER_PX = 73;
/** Approximate sticky nav bar height for scroll-spy rootMargin. */
const NAV_BAR_PX = 56;

/**
 * Sticky jump links for Event Detail → Details tab panels (CRM-19).
 *
 * @param {{
 *   items: Array<{ id: string, label: string }>,
 * }} props
 */
const EventDetailSectionNav = ({ items = [] }) => {
  const [activeId, setActiveId] = useState(items[0]?.id || '');

  useEffect(() => {
    if (!items.length) return undefined;

    const ids = items.map((i) => i.id);
    const ratios = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let bestId = ids[0];
        let bestRatio = -1;
        for (const id of ids) {
          const r = ratios.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            bestId = id;
          }
        }
        // Prefer the topmost intersecting section when ratios are tied/low.
        if (bestRatio <= 0) {
          const topPad = APP_HEADER_PX + NAV_BAR_PX + 8;
          let closest = ids[0];
          let closestDist = Number.POSITIVE_INFINITY;
          for (const id of ids) {
            const el = document.getElementById(id);
            if (!el) continue;
            const dist = Math.abs(el.getBoundingClientRect().top - topPad);
            if (dist < closestDist) {
              closestDist = dist;
              closest = id;
            }
          }
          setActiveId(closest);
          return;
        }
        setActiveId(bestId);
      },
      {
        root: null,
        // Shrink viewport so “in view” is below sticky chrome.
        rootMargin: `-${APP_HEADER_PX + NAV_BAR_PX}px 0px -45% 0px`,
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    // Honor hash on mount.
    const hash = String(window.location.hash || '').replace(/^#/, '');
    if (hash && ids.includes(hash)) setActiveId(hash);

    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <nav
      aria-label="Event detail sections"
      className="sticky top-[73px] z-30 -mx-1 px-1 py-2 bg-[#FDF8F4] border-b border-orange-100/80"
    >
      <div className="flex w-full flex-wrap sm:flex-nowrap gap-1 rounded-lg border border-orange-100 bg-white p-1.5 shadow-sm">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? 'true' : undefined}
              className={[
                'flex-1 min-w-[4.5rem] text-center rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-orange-50 text-[#C84B31] ring-1 ring-[#C84B31]/40 shadow-sm'
                  : 'text-gray-700 hover:bg-orange-50/80 hover:text-[#C84B31]',
              ].join(' ')}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(item.id);
                if (el) {
                  setActiveId(item.id);
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
          );
        })}
      </div>
    </nav>
  );
};

export default EventDetailSectionNav;
