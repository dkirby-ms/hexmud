import type { FC } from 'react';

export interface HexLegendItem {
  readonly tierId: number;
  readonly label: string;
  readonly color: string;
}

export type HexLegendContrastMode = 'default' | 'high-contrast';

interface HexLegendProps {
  readonly items: readonly HexLegendItem[];
  readonly contrastMode: HexLegendContrastMode;
  readonly onContrastModeChange: (mode: HexLegendContrastMode) => void;
}

export const HexLegend: FC<HexLegendProps> = ({ items, contrastMode, onContrastModeChange }) => {
  const isHighContrast = contrastMode === 'high-contrast';

  const handleToggle = () => {
    onContrastModeChange(isHighContrast ? 'default' : 'high-contrast');
  };

  return (
    <aside className="hexLegend" aria-label="Presence tier legend">
      <div className="hexLegend__header">
        <h3 className="hexLegend__title">Presence tiers</h3>
        <button
          type="button"
          className="hexLegend__toggle"
          onClick={handleToggle}
          aria-pressed={isHighContrast}
        >
          {isHighContrast ? 'Disable high contrast' : 'Enable high contrast'}
        </button>
      </div>
      <ul className="hexLegend__list">
        {items.map((item) => (
          <li key={item.tierId} className="hexLegend__item">
            <span
              className="hexLegend__swatch"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="hexLegend__label">
              <strong>Tier {item.tierId}</strong>
              <span>{item.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default HexLegend;
