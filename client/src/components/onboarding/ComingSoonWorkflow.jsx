import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import { onboardingStrings } from './strings';

export default function ComingSoonWorkflow({ jobRole }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {onboardingStrings.comingSoonTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">{jobRole}</span> —{' '}
          {onboardingStrings.comingSoonBody}
        </p>
        <p>{onboardingStrings.credentialsNote}</p>
      </CardContent>
    </Card>
  );
}
