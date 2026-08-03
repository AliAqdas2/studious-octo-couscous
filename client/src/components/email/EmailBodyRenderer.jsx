import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * EmailBodyRenderer
 * - HTML emails: rendered inside an isolated <iframe srcDoc> so email-specific
 *   CSS doesn't leak into the app and original formatting (line breaks, lists,
 *   signatures, tables, blockquotes) is preserved exactly as in Gmail.
 * - Plain-text emails: rendered with whitespace preserved.
 * - In both modes, the long quoted history (previous replies) is split off
 *   and hidden behind a "Show trimmed content" toggle so multi-reply threads
 *   stay readable.
 */
export default function EmailBodyRenderer({ content, mimeType = 'text/plain' }) {
  const isHtml = useMemo(() => {
    if (mimeType === 'text/html') return true;
    if (mimeType === 'text/plain') return false;
    // Heuristic fallback if mimeType missing
    return /<\/?(html|body|div|p|br|table|span|a)\b/i.test(content || '');
  }, [content, mimeType]);

  if (!content) {
    return <div className="p-5 text-sm text-gray-500 italic">(no content)</div>;
  }

  return isHtml ? (
    <HtmlBody html={content} />
  ) : (
    <PlainTextBody text={content} />
  );
}

/* ------------------------- Plain text ------------------------- */

// Split a plain-text email into [main, quoted] — quoted is everything from
// the first reply marker onward (e.g. "On Mon, Jan 1, 2024 at ... wrote:" or a
// run of lines starting with "> ").
function splitPlainTextQuote(text) {
  if (!text) return { main: '', quoted: '' };
  const lines = text.split(/\r?\n/);
  const onWroteRegex = /^On\s.+?wrote:\s*$/i;
  const fromHeaderRegex = /^(From|De|Von|De :)\s*:.+/i;
  const dashSeparatorRegex = /^-{2,}\s*Original Message\s*-{2,}/i;

  let cutIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].trim();
    if (onWroteRegex.test(ln) || dashSeparatorRegex.test(ln)) {
      cutIdx = i;
      break;
    }
    // Run of quoted lines (>) — only treat as cut point if preceded by a blank line
    if (/^>+\s/.test(ln) && i > 0 && lines[i - 1].trim() === '') {
      cutIdx = i;
      break;
    }
    if (fromHeaderRegex.test(ln) && i > 0 && lines[i - 1].trim() === '') {
      cutIdx = i;
      break;
    }
  }

  if (cutIdx === -1) return { main: text, quoted: '' };
  return {
    main: lines.slice(0, cutIdx).join('\n').trimEnd(),
    quoted: lines.slice(cutIdx).join('\n').trim()
  };
}

// Render a plain-text string with auto-linked URLs/emails preserved.
function linkify(text, keyPrefix = '') {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s<>()]+[^\s<>().,;!?'"])|([\w.+-]+@[\w-]+\.[\w.-]+)/g;
  const parts = [];
  let lastIdx = 0;
  let match;
  let i = 0;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const matched = match[0];
    if (match[1]) {
      parts.push(
        <a
          key={`${keyPrefix}-l-${i++}`}
          href={matched}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline break-all"
        >
          {matched}
        </a>
      );
    } else {
      parts.push(
        <a
          key={`${keyPrefix}-m-${i++}`}
          href={`mailto:${matched}`}
          className="text-blue-600 hover:underline break-all"
        >
          {matched}
        </a>
      );
    }
    lastIdx = match.index + matched.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

// Render plain-text content with `>` quote markers turned into nested
// styled blockquotes and bare URLs/emails auto-linked.
function renderPlainText(text, keyPrefix = 'p') {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let buffer = []; // { level: 0|1|2..., text: '' }[]

  const flush = () => {
    if (buffer.length === 0) return;
    const level = buffer[0].level;
    const content = buffer.map(b => b.text).join('\n');
    if (level === 0) {
      blocks.push({ type: 'text', content });
    } else {
      blocks.push({ type: 'quote', level, content });
    }
    buffer = [];
  };

  for (const raw of lines) {
    // Count leading > markers (allow "> > " nested form)
    let level = 0;
    let rest = raw;
    while (/^\s*>/.test(rest)) {
      rest = rest.replace(/^\s*>\s?/, '');
      level += 1;
    }
    if (buffer.length > 0 && buffer[0].level !== level) flush();
    buffer.push({ level, text: rest });
  }
  flush();

  return blocks.map((b, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (b.type === 'text') {
      return (
        <div
          key={key}
          className="whitespace-pre-wrap break-words text-[14px] leading-[1.6]"
        >
          {linkify(b.content, key)}
        </div>
      );
    }
    return (
      <blockquote
        key={key}
        className="border-l-2 border-gray-300 pl-3 my-2 text-gray-500 whitespace-pre-wrap break-words text-[13px] leading-[1.55]"
      >
        {linkify(b.content, key)}
      </blockquote>
    );
  });
}

function PlainTextBody({ text }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const { main, quoted } = useMemo(() => splitPlainTextQuote(text), [text]);

  return (
    <div className="p-5 text-sm text-gray-800 font-sans">
      {main ? renderPlainText(main, 'main') : <em className="text-gray-400">(empty message)</em>}

      {quoted && (
        <div className="mt-3">
          <button
            onClick={() => setShowQuoted(s => !s)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
            type="button"
          >
            {showQuoted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showQuoted ? 'Hide quoted text' : '… Show trimmed content'}
          </button>
          {showQuoted && (
            <div className="mt-2 border-l-2 border-gray-200 pl-3">
              {renderPlainText(quoted, 'q')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------- HTML ------------------------- */

// Strip a Gmail-style quoted block from HTML by finding common quote containers.
// Returns { main, quoted } HTML strings.
function splitHtmlQuote(html) {
  if (!html) return { main: '', quoted: '' };

  // Common quote containers used by Gmail / Outlook / Apple Mail
  const markers = [
    /<div\s+class="gmail_quote[^"]*"/i,
    /<blockquote\s+class="gmail_quote[^"]*"/i,
    /<div\s+id=["']?(divRplyFwdMsg|appendonsend)["']?/i,    // Outlook
    /<div\s+class="OutlookMessageHeader"/i,
    /<div\s+class="moz-cite-prefix"/i,                       // Thunderbird
    /<blockquote\s+type="cite"/i                             // Apple Mail
  ];

  let cutIdx = -1;
  for (const re of markers) {
    const m = html.search(re);
    if (m !== -1 && (cutIdx === -1 || m < cutIdx)) cutIdx = m;
  }

  if (cutIdx === -1) return { main: html, quoted: '' };
  return { main: html.slice(0, cutIdx), quoted: html.slice(cutIdx) };
}

function HtmlBody({ html }) {
  const [showQuoted, setShowQuoted] = useState(false);
  const mainRef = useRef(null);
  const quotedRef = useRef(null);
  const [mainHeight, setMainHeight] = useState(200);
  const [quotedHeight, setQuotedHeight] = useState(200);

  const { main, quoted } = useMemo(() => splitHtmlQuote(html), [html]);

  // Wrap content with safe base styles so emails look like Gmail
  const buildSrcDoc = (innerHtml) => `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<base target="_blank" />
<style>
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.55;
    color: #1f2937;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    padding: 16px;
  }
  img { max-width: 100% !important; height: auto !important; }
  a { color: #2563eb; }
  blockquote {
    border-left: 3px solid #e5e7eb;
    margin: 8px 0;
    padding: 4px 12px;
    color: #6b7280;
  }
  table { max-width: 100% !important; }
  pre { white-space: pre-wrap; word-wrap: break-word; }
  /* Strip stray fixed widths some marketing emails use */
  [width] { max-width: 100% !important; }
</style>
</head>
<body>${innerHtml || ''}</body>
</html>`;

  // Auto-size iframe to its content
  const handleLoad = (which) => () => {
    const iframe = which === 'main' ? mainRef.current : quotedRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const h = Math.max(
        doc.documentElement?.scrollHeight || 0,
        doc.body?.scrollHeight || 0
      );
      const final = Math.min(Math.max(h + 8, 80), 4000);
      if (which === 'main') setMainHeight(final);
      else setQuotedHeight(final);
    } catch (_) {
      /* cross-origin shouldn't happen with srcDoc, but be safe */
    }
  };

  return (
    <div className="bg-white">
      <iframe
        ref={mainRef}
        title="email-body"
        srcDoc={buildSrcDoc(main)}
        onLoad={handleLoad('main')}
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        style={{ width: '100%', height: `${mainHeight}px`, border: 0, display: 'block' }}
      />

      {quoted && (
        <div className="px-5 pb-4">
          <button
            onClick={() => setShowQuoted(s => !s)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200"
            type="button"
          >
            {showQuoted ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showQuoted ? 'Hide quoted text' : '… Show trimmed content'}
          </button>
          {showQuoted && (
            <iframe
              ref={quotedRef}
              title="email-quoted"
              srcDoc={buildSrcDoc(quoted)}
              onLoad={handleLoad('quoted')}
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              style={{
                width: '100%',
                height: `${quotedHeight}px`,
                border: 0,
                display: 'block',
                marginTop: 8,
                background: '#f9fafb',
                borderRadius: 6
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}