import { Badge } from '@/components/ui/badge';

const KIND_STYLES = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200',
  sent: 'bg-green-100 text-green-800 border-green-200',
  received: 'bg-blue-100 text-blue-800 border-blue-200',
};

const KIND_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  received: 'Received',
};

export default function EmailKindBadge({ kind }) {
  const key = KIND_LABELS[kind] ? kind : 'received';
  return (
    <Badge variant="outline" className={KIND_STYLES[key]}>
      {KIND_LABELS[key]}
    </Badge>
  );
}
