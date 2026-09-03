import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Heading2, Italic, List, ListOrdered } from 'lucide-react';

/**
 * Convert legacy plain-text guidelines (one bullet per line) into simple HTML.
 */
export function plainTextToGuidelinesHtml(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Lightweight contentEditable editor with Bold / Italic / Heading / lists.
 * Matches the BEO toolbar pattern (execCommand) — no extra package.
 */
export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = '',
  minHeight = 140,
  className = '',
}) {
  const ref = useRef(null);
  const lastExternal = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = plainTextToGuidelinesHtml(value);
    if (next === lastExternal.current) return;
    // Only sync when the parent value changed from outside (seed / save reload).
    if (document.activeElement === el) return;
    lastExternal.current = next;
    el.innerHTML = next || '';
  }, [value]);

  const run = (command, arg = null) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      document.execCommand(command, false, arg);
    } catch {
      /* ignore */
    }
    emitChange();
  };

  const emitChange = () => {
    const el = ref.current;
    if (!el || !onChange) return;
    const html = el.innerHTML.trim();
    lastExternal.current = html;
    onChange(html === '<br>' ? '' : html);
  };

  const btn = (onClick, children, title) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 px-2"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  return (
    <div
      className={`rounded-md border border-input bg-white overflow-hidden ${className}`}
    >
      <div className="flex flex-wrap gap-1 border-b border-orange-100 p-1.5 bg-[#FFF9F0]/60">
        {btn(() => run('bold'), <Bold className="w-3.5 h-3.5" />, 'Bold')}
        {btn(() => run('italic'), <Italic className="w-3.5 h-3.5" />, 'Italic')}
        {btn(
          () => run('formatBlock', 'h3'),
          <Heading2 className="w-3.5 h-3.5" />,
          'Heading'
        )}
        {btn(
          () => run('insertUnorderedList'),
          <List className="w-3.5 h-3.5" />,
          'Bullet list'
        )}
        {btn(
          () => run('insertOrderedList'),
          <ListOrdered className="w-3.5 h-3.5" />,
          'Numbered list'
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className="px-3 py-2 text-sm outline-none prose prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        style={{ minHeight }}
        onInput={emitChange}
        onBlur={emitChange}
      />
    </div>
  );
}
