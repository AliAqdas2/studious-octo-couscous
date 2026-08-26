import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bold,
  Download,
  FileText,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Printer,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  beoHtmlPreview,
  buildBeoHtml,
  wrapBeoDocument,
} from '@/lib/beoTemplate';
import OpsPanelShell from '@/components/events/OpsPanelShell';
import { getPanelMilestoneLabel } from '@/lib/eventMilestones';

function beoLogoSrc() {
  if (typeof window === 'undefined') return '/mangiadc-logo.png';
  return `${window.location.origin}/mangiadc-logo.png`;
}

function buildFromState(state, event) {
  return buildBeoHtml({
    event: state?.event || event,
    runOfShow: state?.runOfShow,
    rosConfirmLabel: state?.rosConfirmLabel,
    logoSrc: beoLogoSrc(),
  });
}

function normalizeSheetHtml(html) {
  if (!html) return '';
  return String(html).replace(
    /src="\/mangiadc-logo\.png"/g,
    `src="${beoLogoSrc()}"`
  );
}

function extractSheetHtml(doc) {
  if (!doc) return '';
  const sheet = doc.querySelector('.beo-sheet');
  if (sheet) return sheet.outerHTML;
  return doc.body?.innerHTML?.trim() || '';
}

function Toolbar({ iframeRef, canEdit }) {
  const run = (command, value = null) => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc || !canEdit) return;
    doc.body?.focus();
    try {
      doc.execCommand(command, false, value);
    } catch {
      /* ignore */
    }
    iframe?.contentWindow?.focus();
  };

  const btn = (onClick, children, title) => (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 px-2"
      title={title}
      disabled={!canEdit}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-1 border-b pb-2 mb-2">
      {btn(() => run('bold'), <Bold className="w-3.5 h-3.5" />, 'Bold')}
      {btn(() => run('italic'), <Italic className="w-3.5 h-3.5" />, 'Italic')}
      {btn(
        () => run('formatBlock', 'h2'),
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
  );
}

function buildBeoDocHtml(html, eventName) {
  const safeName = (eventName || 'BEO').replace(/[^\w\-]+/g, '_').slice(0, 60);
  const bodyHtml = normalizeSheetHtml(html);
  return {
    safeName,
    doc: wrapBeoDocument(bodyHtml, {
      title: `BEO — ${safeName}`,
      editable: false,
    }),
  };
}

/** Current print behavior: open a window and trigger the browser print dialog. */
function printBeo(html, eventName) {
  const { doc } = buildBeoDocHtml(html, eventName);
  const printWin = window.open('', '_blank');
  if (!printWin) {
    toast.error('Pop-up blocked — allow pop-ups to print');
    return;
  }
  printWin.document.write(doc);
  printWin.document.close();
  printWin.focus();
  setTimeout(() => {
    try {
      printWin.print();
    } catch {
      /* ignore */
    }
  }, 400);
}

/** Render BEO HTML to a multi-page PDF and download it. */
async function downloadBeoPdf(html, eventName) {
  const { safeName, doc } = buildBeoDocHtml(html, eventName);
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:794px;border:0;background:#fff;';
  host.appendChild(iframe);
  document.body.appendChild(host);

  try {
    await new Promise((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Failed to load BEO for PDF'));
      iframe.srcdoc = doc;
    });

    const iframeDoc = iframe.contentDocument;
    const target =
      iframeDoc?.querySelector('.beo-sheet') || iframeDoc?.body;
    if (!target) throw new Error('BEO content missing');

    // Let images (logo) settle before capture
    const imgs = Array.from(target.querySelectorAll('img'));
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = () => res();
                img.onerror = () => res();
              })
      )
    );
    await new Promise((r) => setTimeout(r, 150));

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;
    const imgData = canvas.toDataURL('image/png');

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    pdf.save(`${safeName}_BEO.pdf`);
  } finally {
    host.remove();
  }
}

/**
 * Admin BEO builder — same formatted HTML as download, edited in contentEditable iframe.
 */
export default function BeoDocumentPanel({ event, canEdit = false }) {
  const eventId = event?.id;
  const queryClient = useQueryClient();
  const iframeRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftHtml, setDraftHtml] = useState(null);
  const [srcDoc, setSrcDoc] = useState('');
  const [iframeReady, setIframeReady] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data: state, isLoading } = useQuery({
    queryKey: ['beo-document', eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getBeoDocument', { eventId });
      return res?.data ?? res;
    },
    enabled: !!eventId,
  });

  const hasDocument = Boolean(state?.hasDocument);
  const showSummary = hasDocument && !isEditing;

  useEffect(() => {
    if (!state) return;
    setIsEditing(false);
    setDraftHtml(null);
  }, [state?.updatedAt, state?.hasDocument]);

  useEffect(() => {
    if (showSummary) {
      setDraftHtml(null);
      return;
    }
    if (draftHtml == null && state) {
      setDraftHtml(state.html || buildFromState(state, event));
    }
  }, [showSummary, state, event, draftHtml]);

  useEffect(() => {
    if (showSummary || draftHtml == null) return;
    setIframeReady(false);
    setSrcDoc(
      wrapBeoDocument(normalizeSheetHtml(draftHtml), {
        title: 'BEO editor',
        editable: canEdit,
      })
    );
  }, [draftHtml, showSummary, canEdit]);

  const readIframeHtml = () => {
    const doc = iframeRef.current?.contentDocument;
    return extractSheetHtml(doc);
  };

  const saveMutation = useMutation({
    mutationFn: async (html) => {
      const res = await base44.functions.invoke('saveBeoDocument', {
        eventId,
        html,
      });
      return res?.data ?? res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['beo-document', eventId]);
      queryClient.invalidateQueries(['event', eventId]);
      queryClient.invalidateQueries(['event-tasks', eventId]);
      setIsEditing(false);
      setDraftHtml(null);
      toast.success('BEO document saved');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save BEO');
    },
  });

  const preview = useMemo(
    () => beoHtmlPreview(state?.html || ''),
    [state?.html]
  );

  if (!eventId || isLoading) {
    return (
      <OpsPanelShell title="BEO document" icon={FileText} forceOpen>
        <div className="h-20 animate-pulse bg-slate-100 rounded" />
      </OpsPanelShell>
    );
  }

  const eventName = event?.event_name || event?.eventName || 'Event';
  const beoMilestone = getPanelMilestoneLabel('beo', event);
  const softHint =
    !state?.rosCompleted && !state?.rosScheduled
      ? 'Tip: schedule and complete Run of Show first for a fuller BEO. You can still draft early.'
      : !state?.rosCompleted
        ? 'Tip: complete Run of Show details for the richest prefill. Early draft is OK.'
        : null;

  const generateFresh = () => {
    if (hasDocument) {
      const ok = window.confirm(
        'Regenerate will replace your current BEO edits with a fresh template from deposit + ROS. Continue?'
      );
      if (!ok) return;
    }
    const html = buildFromState(state, event);
    setIsEditing(true);
    setDraftHtml(html);
    toast.success('BEO draft generated — review, then Save');
  };

  const openEdit = () => {
    setDraftHtml(state?.html || buildFromState(state, event));
    setIsEditing(true);
  };

  const handleSave = () => {
    const html = readIframeHtml();
    if (!html.trim()) {
      toast.error('BEO document is empty');
      return;
    }
    saveMutation.mutate(html);
  };

  const currentBeoHtml = () =>
    !showSummary && iframeReady
      ? readIframeHtml()
      : state?.html || buildFromState(state, event);

  const handlePrint = () => {
    const html = currentBeoHtml();
    if (!html?.trim()) {
      toast.error('BEO document is empty');
      return;
    }
    printBeo(html, eventName);
  };

  const handleDownloadPdf = async () => {
    const html = currentBeoHtml();
    if (!html?.trim()) {
      toast.error('BEO document is empty');
      return;
    }
    setPdfBusy(true);
    try {
      await downloadBeoPdf(html, eventName);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err?.message || 'Failed to create PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const exportButtons = (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handlePrint}
      >
        <Printer className="w-4 h-4 mr-1" />
        Print
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pdfBusy}
        onClick={handleDownloadPdf}
      >
        <Download className="w-4 h-4 mr-1" />
        {pdfBusy ? 'Creating PDF…' : 'Download PDF'}
      </Button>
    </>
  );

  return (
    <OpsPanelShell
      title="BEO document"
      icon={FileText}
      complete={showSummary}
      forceOpen={!showSummary}
      doneBadge={hasDocument && showSummary}
      milestoneLabel={beoMilestone}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Generate a Banquet Event Order from deposit + Run of Show, edit,
            save, and download.
          </p>
          {hasDocument ? (
            <Badge className="bg-green-600 text-white">Saved</Badge>
          ) : (
            <Badge variant="outline">Not generated</Badge>
          )}
        </div>

        {softHint ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
            {softHint}
          </p>
        ) : null}

        {showSummary ? (
          <div className="rounded-lg border border-green-200 bg-green-50/60 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium text-green-900">BEO saved</p>
                <p className="text-sm text-green-700">
                  {state?.updatedAt
                    ? `Updated ${new Date(state.updatedAt).toLocaleString()}`
                    : 'In-app Admin BEO document'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-800 hover:bg-green-100"
                    onClick={openEdit}
                  >
                    View / Edit
                  </Button>
                ) : null}
                {exportButtons}
              </div>
            </div>
            {preview ? (
              <p className="text-sm text-green-950/80 line-clamp-3">{preview}</p>
            ) : null}
            {state?.beoUrl ? (
              <p className="text-xs text-green-800">
                External BEO link still on file:{' '}
                <a
                  href={state.beoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Open URL
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        {!showSummary ? (
          <div className="space-y-3">
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-[#C84B31] hover:bg-[#A03A23]"
                  onClick={generateFresh}
                >
                  {hasDocument ? 'Regenerate from CRM' : 'Generate BEO'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saveMutation.isPending || !iframeReady}
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save
                </Button>
                {exportButtons}
                {isEditing && hasDocument ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setDraftHtml(null);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-gray-500">View only for your role.</p>
            )}
            <Toolbar iframeRef={iframeRef} canEdit={canEdit} />
            <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
              <iframe
                ref={iframeRef}
                title="BEO editor"
                srcDoc={srcDoc}
                className="w-full bg-white border-0"
                style={{ minHeight: 720, height: 900 }}
                onLoad={() => setIframeReady(true)}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        ) : null}
      </div>
    </OpsPanelShell>
  );
}
