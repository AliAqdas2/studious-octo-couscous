import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X, CheckCircle } from 'lucide-react';

export default function InlineEditField({ label, value, onSave, icon: Icon, type = 'text', options }) {
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const toInputValue = (val) => {
    if (!val) return '';
    if (type === 'datetime-local') {
      try { return new Date(val).toISOString().slice(0, 16); } catch { return ''; }
    }
    return val;
  };

  const [editValue, setEditValue] = useState(toInputValue(value));

  useEffect(() => {
    setEditValue(toInputValue(value));
  }, [value]);

  const handleSave = () => {
    onSave(editValue);
    setEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-start gap-3">
        {Icon && <Icon className="w-5 h-5 text-gray-500 mt-2" />}
        <div className="flex-1 space-y-1">
          <p className="text-sm text-gray-500">{label}</p>
          {options ? (
            <select
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#C84B31] focus:border-transparent"
            >
              <option value="">Not set</option>
              {options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
          )}
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleSave} className="h-6 px-2 text-green-600 hover:text-green-700">
              <Check className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-6 px-2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group">
      {Icon && <Icon className="w-5 h-5 text-gray-500 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 mt-0.5">{value || 'Not set'}</p>
          {justSaved && (
            <span className="flex items-center gap-1 text-xs text-green-600 animate-fade-in">
              <CheckCircle className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => { setEditValue(toInputValue(value)); setEditing(true); }}
        className="h-6 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#C84B31]"
      >
        <Pencil className="w-3 h-3" />
      </Button>
    </div>
  );
}