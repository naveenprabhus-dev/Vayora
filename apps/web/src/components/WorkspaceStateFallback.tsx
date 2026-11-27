import { AlertBanner } from './AlertBanner.tsx';
import { Button } from './Button.tsx';
import { SurfaceCard } from './SurfaceCard.tsx';

export interface WorkspaceLoadingCardProps {
  readonly headingId: string;
  readonly title: string;
  readonly description: string;
}

export function WorkspaceLoadingCard({
  headingId,
  title,
  description,
}: WorkspaceLoadingCardProps) {
  return (
    <SurfaceCard as="section" aria-labelledby={headingId}>
      <output aria-live="polite" className="block space-y-2 text-sm text-slate-700">
        <p id={headingId} className="font-semibold text-slate-950">
          {title}
        </p>
        <p>{description}</p>
      </output>
    </SurfaceCard>
  );
}

export interface WorkspaceErrorRetryBannerProps {
  readonly title: string;
  readonly error: string;
  readonly retryLabel: string;
  readonly onRetry: () => void;
}

export function WorkspaceErrorRetryBanner({
  title,
  error,
  retryLabel,
  onRetry,
}: WorkspaceErrorRetryBannerProps) {
  return (
    <AlertBanner tone="error" title={title}>
      <p>{error}</p>
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </AlertBanner>
  );
}
