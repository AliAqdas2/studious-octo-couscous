import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Bold,
  Download,
  FileText,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  beoHtmlPreview,
  buildBeoHtml,
  wrapBeoDocument,
} from '@/lib/beoTemplate';

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

function downloadBeoHtml(html, eventName) {
  const safeName = (eventName || 'BEO').replace(/[^\w\-]+/g, '_').slice(0, 60);
  const bodyHtml = normalizeSheetHtml(html);
  const doc = wrapBeoDocument(bodyHtml, {
    title: `BEO — ${safeName}`,
    editable: false,
  });
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_BEO.html`;
  a.click();
  URL.revokeObjectURL(url);

  const printWin = window.open('', '_blank');
  if (printWin) {
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
}

/**
 * Admin BEO builder — same formatted HTML as download, edited in contentEditable iframe.
 */
export default function BeoDocumentPanel({ event, canEdit = false }) {
  const eventId = event?.id;
  const queryClient = useQueryClient();
  const iframeRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [accordionValue, setAccordionValue] = useState([]);
  const [draftHtml, setDraftHtml] = useState(null);
  const [srcDoc, setSrcDoc] = useState('');
  const [iframeReady, setIframeReady] = useState(false);

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
      setAccordionValue([]);
      setDraftHtml(null);
      return;
    }
    setAccordionValue(['editor']);
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            BEO document
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse bg-slate-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  const eventName = event?.event_name || event?.eventName || 'Event';
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

  const handleDownload = () => {
    const html =
      !showSummary && iframeReady
        ? readIframeHtml()
        : state?.html || buildFromState(state, event);
    downloadBeoHtml(html, eventName);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              BEO document
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Generate a Banquet Event Order from deposit + Run of Show, edit,
              save, and download.
            </p>
          </div>
          {hasDocument ? (
            <Badge className="bg-green-600 text-white">Saved</Badge>
          ) : (
            <Badge variant="outline">Not generated</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {softHint ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
            {softHint}
          </p>
        ) : null}

        {showSummary ? (
          <Card className="border-green-200 bg-green-50/60">
            <CardContent className="p-4 space-y-3">
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
                  <Badge className="bg-green-600 text-white">Done</Badge>
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
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
            </CardContent>
          </Card>
        ) : null}

        {!showSummary ? (
          <Accordion
            type="multiple"
            value={accordionValue}
            onValueChange={setAccordionValue}
          >
            <AccordionItem value="editor" className="border rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <span className="font-semibold text-sm">
                  {hasDocument ? 'Edit BEO' : 'Create BEO'}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
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
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </Button>
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
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </CardContent>
    </Card>
  );
}
