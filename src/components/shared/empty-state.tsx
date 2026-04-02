import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-medium text-muted-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground/70">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
