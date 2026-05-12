// src/core/ui/EmptyState.tsx
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: string;
}

export function EmptyState({ title, description, action, icon = "📭" }: EmptyStateProps) {
  return (
    <div className="text-center py-12 text-text-secondary">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="text-lg font-medium text-foreground mb-2">{title}</p>
      {description && <p className="text-sm mb-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}