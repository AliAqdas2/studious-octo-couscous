import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { onboardingStrings } from './strings';

export default function CandidateNotes({ candidate }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(candidate?.notes || '');

  useEffect(() => {
    setNotes(candidate?.notes || '');
  }, [candidate?.id, candidate?.notes]);

  const dirty = notes !== (candidate?.notes || '');

  const mutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Candidate.update(candidate.id, {
        notes: notes.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      toast.success(onboardingStrings.notesSaved);
    },
    onError: (e) => toast.error(e.message || 'Failed to save notes'),
  });

  return (
    <Card className="border-orange-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[#C84B31]">
          {onboardingStrings.notesTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={onboardingStrings.notesPlaceholder}
          rows={5}
          className="resize-y min-h-[120px]"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="bg-gradient-to-r from-[#C84B31] to-[#E8B55F] hover:opacity-90 text-white shadow-md disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : onboardingStrings.notesSave}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
