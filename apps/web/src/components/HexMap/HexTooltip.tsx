import type { FC } from 'react';

interface HexTooltipProps {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly hexId?: string;
  readonly value?: number;
  readonly tierId?: number;
  readonly tierLabel?: string;
  readonly updatedAt?: number;
}

const formatRelativeTime = (timestamp?: number): string | undefined => {
  if (!timestamp) {
    return undefined;
  }
  const deltaMs = Date.now() - timestamp;
  if (!Number.isFinite(deltaMs)) {
    return undefined;
  }
  if (deltaMs < 1_000) {
    return 'just now';
  }
  if (deltaMs < 60_000) {
    return `${Math.round(deltaMs / 1_000)}s ago`;
  }
  if (deltaMs < 3_600_000) {
    return `${Math.round(deltaMs / 60_000)}m ago`;
  }
  return `${Math.round(deltaMs / 3_600_000)}h ago`;
};

export const HexTooltip: FC<HexTooltipProps> = ({
  visible,
  x,
  y,
  hexId,
  value,
  tierId,
  tierLabel,
  updatedAt
}) => {
  if (!visible || !hexId) {
    return null;
  }

  const relative = formatRelativeTime(updatedAt);

  return (
    <div
      className="hexTooltip"
      style={{ left: x, top: y }}
      role="status"
      aria-live="polite"
    >
      <p className="hexTooltip__title">{hexId}</p>
      <dl className="hexTooltip__metrics">
        <div>
          <dt>Presence</dt>
          <dd>{value ?? '—'}</dd>
        </div>
        <div>
          <dt>Tier</dt>
          <dd>{tierId ?? '—'}</dd>
        </div>
        {tierLabel && (
          <div>
            <dt>Label</dt>
            <dd>{tierLabel}</dd>
          </div>
        )}
        {relative && (
          <div>
            <dt>Updated</dt>
            <dd>{relative}</dd>
          </div>
        )}
      </dl>
    </div>
  );
};

export default HexTooltip;
