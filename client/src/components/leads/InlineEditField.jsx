import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X, CheckCircle } from 'lucide-react';
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/lib/localDateTime';

export default function InlineEditField({
  label,
  value,
  onSave,
  icon: Icon,
  type = 'text',
  options,
  otherOption = null,
  otherValue = '',
}) {
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const toInputValue = (val) => {
    if (!val) return '';
    if (type === 'datetime-local') {
      return toDatetimeLocalValue(val);
    }
    return val;
  };

  const [editValue, setEditValue] = useState(toInputValue(value));
  const [editOther, setEditOther] = useState(otherValue || '');

  useEffect(() => {
    setEditValue(toInputValue(value));
  }, [value]);

  useEffect(() => {
    setEditOther(otherValue || '');
  }, [otherValue]);

  const showOtherInput =
    Boolean(otherOption) && Array.isArray(options) && editValue === otherOption;

  const handleSave = () => {
    const savedValue =
      type === 'datetime-local'
        ? fromDatetimeLocalValue(editValue) || editValue
        : editValue;
    if (otherOption) {
      onSave(
        savedValue,
        editValue === otherOption ? (editOther || '') : ''
      );
    } else {
      onSave(savedValue);
    }
    setEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleCancel = () => {
    setEditValue(toInputValue(value));
    setEditOther(otherValue || '');
    setEditing(false);
  };

  const displayValue = (() => {
    if (otherOption && value === otherOption && otherValue) {
      return `${value} — ${otherValue}`;
    }
    if (type === 'datetime-local' && value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    return value;
  })();

  if (editing) {
    return (
      <div className="flex items-start gap-3">
        {Icon && <Icon className="w-5 h-5 text-gray-500 mt-2" />}
        <div className="flex-1 space-y-1">
          <p className="text-sm text-gray-500">{label}</p>
          {options ? (
            <>
              <select
                value={editValue}
                onChange={(e) => {
                  const next = e.target.value;
                  setEditValue(next);
                  if (otherOption && next !== otherOption) {
                    setEditOther('');
                  }
                }}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-[#C84B31] focus:border-transparent"
              >
                <option value="">Not set</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {showOtherInput ? (
                <Input
                  type="text"
                  value={editOther}
                  onChange={(e) => setEditOther(e.target.value)}
                  placeholder="Please specify"
                  className="h-8 text-sm mt-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                    if (e.key === 'Escape') handleCancel();
                  }}
                />
              ) : null}
            </>
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
          <p className="font-medium text-gray-900 mt-0.5">{displayValue || 'Not set'}</p>
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
        onClick={() => {
          setEditValue(toInputValue(value));
          setEditOther(otherValue || '');
          setEditing(true);
        }}
        className="h-6 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#C84B31]"
      >
        <Pencil className="w-3 h-3" />
      </Button>
    </div>
  );
}
