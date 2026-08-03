import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportLeadsDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  React.useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const [file, setFile] = useState(null);
  const [step, setStep] = useState('upload'); // upload, preview, importing, done
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const handleFileSelect = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const validTypes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const hasValidExt = validExtensions.some(ext => selected.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(selected.type) && !hasValidExt) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setFile(selected);
    setStep('preview');

    const { file_url } = await base44.integrations.Core.UploadFile({ file: selected });

    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            source: { type: "string" },
            event_type_interest: { type: "string" },
            headcount_estimate: { type: "number" },
            preferred_date: { type: "string" },
            notes: { type: "string" }
          }
        }
      }
    });

    if (result.status === 'error') {
      toast.error('Failed to parse file: ' + result.details);
      setStep('upload');
      setFile(null);
      return;
    }

    const rows = Array.isArray(result.output) ? result.output : (result.output?.items || []);
    setPreviewData(rows);
  };

  const handleImport = async () => {
    if (!previewData?.length) return;
    setStep('importing');

    const leadsToCreate = previewData
      .filter(row => row.name && row.email)
      .map(row => ({
        name: row.name,
        email: row.email,
        phone: row.phone || '',
        company: row.company || '',
        source: row.source || 'Other',
        event_type_interest: row.event_type_interest || '',
        headcount_estimate: row.headcount_estimate || undefined,
        preferred_date: row.preferred_date || undefined,
        notes: row.notes || '',
        stage: 'New Inquiry',
        inquiry_type: 'Unknown',
        client_type: 'New'
      }));

    const skipped = previewData.length - leadsToCreate.length;

    const createdLeads = await base44.entities.Lead.bulkCreate(leadsToCreate);
    
    // Log activity for each imported lead (with safety check on return value)
    const userName = currentUser?.full_name || 'Unknown';
    const userId = currentUser?.id || '';
    const now = new Date().toISOString();
    if (createdLeads && Array.isArray(createdLeads) && createdLeads.length > 0) {
      const activityLogs = createdLeads
        .filter(lead => lead && lead.id)
        .map(lead => ({
          entity_type: 'Lead',
          entity_id: lead.id,
          action: 'Lead Added',
          details: { method: 'Bulk Import', file_name: file?.name, added_by: userName },
          user_id: userId,
          user_name: userName,
          timestamp: now
        }));
      if (activityLogs.length > 0) {
        await base44.entities.ActivityLog.bulkCreate(activityLogs);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['leads'] });

    setImportResult({ imported: leadsToCreate.length, skipped });
    setStep('done');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#C84B31]" />
            Import Leads
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a CSV or Excel file with lead data. Required columns: <strong>name</strong> and <strong>email</strong>. 
              Optional: phone, company, source, event_type_interest, headcount_estimate, preferred_date, notes.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-orange-200 rounded-xl p-10 cursor-pointer hover:border-[#C84B31] hover:bg-orange-50/50 transition-all">
              <Upload className="w-10 h-10 text-gray-400 mb-3" />
              <span className="text-sm font-medium text-gray-700">Click to select file</span>
              <span className="text-xs text-gray-500 mt-1">CSV or Excel (.xlsx)</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}

        {step === 'preview' && !previewData && (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#C84B31] mb-3" />
            <p className="text-sm text-gray-600">Parsing {file?.name}...</p>
          </div>
        )}

        {step === 'preview' && previewData && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Found <strong>{previewData.length}</strong> rows in <strong>{file?.name}</strong>. 
              Rows without name or email will be skipped.
            </p>
            <div className="border rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Company</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Phone</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Valid</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.map((row, i) => {
                    const valid = row.name && row.email;
                    return (
                      <tr key={i} className={!valid ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2">{row.name || <span className="text-red-400">Missing</span>}</td>
                        <td className="px-3 py-2">{row.email || <span className="text-red-400">Missing</span>}</td>
                        <td className="px-3 py-2 text-gray-600">{row.company || '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{row.phone || '—'}</td>
                        <td className="px-3 py-2">
                          {valid ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); setPreviewData(null); }}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!previewData.some(r => r.name && r.email)}
                className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] text-white"
              >
                Import {previewData.filter(r => r.name && r.email).length} Leads
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-[#C84B31] mb-3" />
            <p className="text-sm text-gray-600">Importing leads...</p>
          </div>
        )}

        {step === 'done' && importResult && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">Import Complete</p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>{importResult.imported}</strong> leads imported successfully.
                {importResult.skipped > 0 && (
                  <span className="text-amber-600"> {importResult.skipped} rows skipped (missing name or email).</span>
                )}
              </p>
            </div>
            <Button onClick={onClose} className="bg-[#C84B31] text-white">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}