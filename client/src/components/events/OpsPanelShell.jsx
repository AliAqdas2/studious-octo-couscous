import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

/**
 * Shared collapsible chrome for Event Detail ops panels.
 * Complete panels default collapsed; incomplete default open.
 */
export default function OpsPanelShell({
  title,
  icon: Icon,
  milestoneLabel = null,
  complete = false,
  forceOpen = false,
  doneBadge = false,
  children,
}) {
  const shouldOpen = forceOpen || !complete;
  const [value, setValue] = useState(shouldOpen ? ['body'] : []);

  useEffect(() => {
    setValue(shouldOpen ? ['body'] : []);
  }, [shouldOpen, complete, forceOpen]);

  return (
    <Card className={complete && !forceOpen ? 'border-green-200' : undefined}>
      <Accordion type="multiple" value={value} onValueChange={setValue}>
        <AccordionItem value="body" className="border-0">
          <AccordionTrigger className="px-6 py-4 hover:no-underline [&[data-state=open]]:pb-2">
            <span className="flex flex-wrap items-center gap-2 text-left pr-2">
              {Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
              <span className="font-semibold text-base">{title}</span>
              {doneBadge || complete ? (
                <Badge className="bg-green-600 text-white text-[10px]">
                  Done
                </Badge>
              ) : null}
              {milestoneLabel ? (
                <Badge
                  variant="outline"
                  className="text-[10px] border-amber-300 text-amber-900 bg-amber-50 font-medium"
                >
                  {milestoneLabel}
                </Badge>
              ) : null}
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">{children}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
