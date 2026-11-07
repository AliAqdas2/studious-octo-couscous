import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { confirmLeave } from '@/lib/useUnsavedNavigation';

/**
 * “Add more in Settings” deep link for settings-backed catalog dropdowns (CRM-14).
 *
 * @param {{
 *   hash: string,
 *   label?: string,
 *   dirty?: boolean,
 *   onBeforeNavigate?: () => void,
 *   className?: string,
 * }} props
 */
export default function SettingsCatalogLink({
  hash,
  label = 'Add more in Settings',
  dirty = false,
  onBeforeNavigate,
  className = '',
}) {
  const cleanHash = String(hash || '').replace(/^#/, '');
  const to = `${createPageUrl('Settings')}${cleanHash ? `#${cleanHash}` : ''}`;

  const handleClick = (e) => {
    onBeforeNavigate?.();
    if (!confirmLeave(dirty)) {
      e.preventDefault();
    }
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-xs font-medium text-[#C84B31] underline underline-offset-2 hover:text-[#A03A23] ${className}`}
    >
      <span>{label}</span>
      <ExternalLink className="w-3 h-3 shrink-0" />
    </Link>
  );
}
