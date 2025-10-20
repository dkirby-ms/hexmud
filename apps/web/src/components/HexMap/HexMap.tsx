import type { FC, MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useGameConnection } from '../../hooks/useGameConnection.js';
import {
  observePresenceLatency,
  type PresenceLatencySample
} from '../../services/latency/presenceLatencyTracker.js';

import { HexLegend } from './HexLegend.js';
import { HexTooltip } from './HexTooltip.js';
import { computeCanvasLayout, type CanvasCellLayout } from './hexUtils.js';
import {
  usePresenceSnapshot,
  type PresenceCell
} from './usePresenceSnapshot.js';
import { usePresenceUpdates } from './usePresenceUpdates.js';
import './HexMap.css';

const BACKGROUND_COLOR = '#f8fafc';
const STROKE_COLOR = 'rgba(15, 23, 42, 0.18)';
const TEXT_COLOR = '#0f172a';
const HIGHLIGHT_DURATION_MS = 420;
const DECAY_FADE_DURATION_MS = 1_200;
const TOOLTIP_OFFSET_X = 18;
const TOOLTIP_OFFSET_Y = -18;
const HEX_SKELETON_COUNT = 12;

interface DrawOptions {
  highlightStrength?: number;
  decayFade?: boolean;
}

const DEFAULT_TIER_DEFINITIONS = [
  { tierId: 1, label: 'Faint foothold', color: '#e0f2fe' },
  { tierId: 2, label: 'Established', color: '#bae6fd' },
  { tierId: 3, label: 'Stable presence', color: '#7dd3fc' },
  { tierId: 4, label: 'Dominant hold', color: '#38bdf8' },
  { tierId: 5, label: 'Sovereign', color: '#0ea5e9' }
] as const;

const HIGH_CONTRAST_TIER_DEFINITIONS = [
  { tierId: 1, label: 'Faint foothold', color: '#fde68a' },
  { tierId: 2, label: 'Established', color: '#f97316' },
  { tierId: 3, label: 'Stable presence', color: '#ef4444' },
  { tierId: 4, label: 'Dominant hold', color: '#7c3aed' },
  { tierId: 5, label: 'Sovereign', color: '#111827' }
] as const;

const formatTimestamp = (timestamp?: number): string | undefined => {
  if (!timestamp) {
    return undefined;
  }
  try {
    return new Date(timestamp).toISOString();
  } catch (error) {
    return undefined;
  }
};

const clearHexCell = (ctx: CanvasRenderingContext2D, layoutCell: CanvasCellLayout): void => {
  ctx.save();
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.strokeStyle = BACKGROUND_COLOR;
  ctx.lineWidth = 1;
  ctx.fill(layoutCell.path);
  ctx.stroke(layoutCell.path);
  ctx.restore();
};

const drawHexCell = (
  ctx: CanvasRenderingContext2D,
  layoutCell: CanvasCellLayout,
  presence: PresenceCell,
  tierColors: Map<number, string>,
  options: DrawOptions = {}
): void => {
  const tierColor = tierColors.get(presence.tierId) ?? '#cbd5f5';
  const clampedHighlight = Math.max(0, Math.min(1, options.highlightStrength ?? 0));
  const applyDecayFade = Boolean(options.decayFade);

  ctx.save();
  ctx.fillStyle = tierColor;
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineWidth = 1;
  if (clampedHighlight > 0) {
    ctx.shadowBlur = 18 * clampedHighlight;
    ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
  }
  let fillAlpha = 0.94 + clampedHighlight * 0.06;
  if (applyDecayFade) {
    fillAlpha = Math.min(fillAlpha, 0.78);
  }
  ctx.globalAlpha = Math.max(0.6, Math.min(1, fillAlpha));
  ctx.fill(layoutCell.path);
  ctx.stroke(layoutCell.path);
  ctx.restore();

  ctx.save();
  const baseTextColor = presence.tierId >= 5 ? '#f8fafc' : TEXT_COLOR;
  ctx.fillStyle = applyDecayFade && presence.tierId < 5 ? 'rgba(15, 23, 42, 0.7)' : baseTextColor;
  ctx.font = '600 15px "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(presence.value), layoutCell.centerX, layoutCell.centerY - 6);

  ctx.font = '500 11px "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
  ctx.fillStyle = applyDecayFade ? 'rgba(15, 23, 42, 0.55)' : 'rgba(15, 23, 42, 0.7)';
  ctx.fillText(`Tier ${presence.tierId}`, layoutCell.centerX, layoutCell.centerY + 12);
  ctx.restore();
};

export const HexMap: FC = () => {
  const connection = useGameConnection();
  const {
    cells,
    loading,
    error: snapshotError,
    lastSnapshotTs,
    lastUpdateTs,
    requestSnapshot,
    applyUpdate
  } = usePresenceSnapshot(connection.room);

  const updateInfo = usePresenceUpdates(connection.room, {
    applyUpdate
  });

  const [contrastMode, setContrastMode] = useState<'default' | 'high-contrast'>('default');

  const tierDefinitions = useMemo(() => (
    contrastMode === 'high-contrast'
      ? HIGH_CONTRAST_TIER_DEFINITIONS
      : DEFAULT_TIER_DEFINITIONS
  ), [contrastMode]);

  const tierColorMap = useMemo(
    () =>
      new Map<number, string>(
        tierDefinitions.map((entry) => [entry.tierId, entry.color])
      ),
    [tierDefinitions]
  );

  const tierLabelMap = useMemo(
    () =>
      new Map<number, string>(
        tierDefinitions.map((entry) => [entry.tierId, entry.label])
      ),
    [tierDefinitions]
  );

  const tierColorMapRef = useRef(tierColorMap);
  useEffect(() => {
    tierColorMapRef.current = tierColorMap;
  }, [tierColorMap]);

  const [latencySample, setLatencySample] = useState<PresenceLatencySample | undefined>(undefined);
  useEffect(() => {
    const stop = observePresenceLatency((sample) => {
      setLatencySample(sample);
    });
    return () => {
      stop();
    };
  }, []);

  const canvasLayout = useMemo(() => computeCanvasLayout(cells), [cells]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawnCellsRef = useRef(new Map<string, { value: number; tierId: number }>());
  const layoutRef = useRef(new Map<string, CanvasCellLayout>());
  const highlightTimeoutsRef = useRef(new Map<string, number>());
  const decayFadeTimeoutsRef = useRef(new Map<string, number>());
  const hoveredHexRef = useRef<string | null>(null);
  const cellsRef = useRef(cells);

  useEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let context = contextRef.current;
    if (!context) {
      context = canvas.getContext('2d');
      if (!context) {
        return;
      }
      contextRef.current = context;
    }

    const requiresResize =
      canvas.width !== Math.ceil(canvasLayout.width) ||
      canvas.height !== Math.ceil(canvasLayout.height);

    if (requiresResize) {
      canvas.width = Math.max(1, Math.ceil(canvasLayout.width));
      canvas.height = Math.max(1, Math.ceil(canvasLayout.height));
      canvas.style.width = `${canvasLayout.width}px`;
      canvas.style.height = `${canvasLayout.height}px`;
      context.fillStyle = BACKGROUND_COLOR;
      context.fillRect(0, 0, canvasLayout.width, canvasLayout.height);
      drawnCellsRef.current.clear();
    }

    const drawnCells = drawnCellsRef.current;
    const previousLayout = layoutRef.current;
    layoutRef.current = new Map(canvasLayout.cells);

    for (const [hexId] of Array.from(drawnCells.entries())) {
      if (!cells.has(hexId)) {
        const priorLayoutCell = previousLayout.get(hexId);
        if (priorLayoutCell) {
          clearHexCell(context, priorLayoutCell);
        }
        drawnCells.delete(hexId);
        const timeoutId = highlightTimeoutsRef.current.get(hexId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          highlightTimeoutsRef.current.delete(hexId);
        }
        const decayTimeoutId = decayFadeTimeoutsRef.current.get(hexId);
        if (decayTimeoutId) {
          clearTimeout(decayTimeoutId);
          decayFadeTimeoutsRef.current.delete(hexId);
        }
        if (hoveredHexRef.current === hexId) {
          hoveredHexRef.current = null;
        }
      }
    }

    for (const [hexId, presence] of cells.entries()) {
      const layoutCell = canvasLayout.cells.get(hexId);
      if (!layoutCell) {
        continue;
      }

      const previous = drawnCells.get(hexId);
      const hasChanged =
        !previous ||
        previous.value !== presence.value ||
        previous.tierId !== presence.tierId;

      if (!hasChanged) {
        continue;
      }

      clearHexCell(context, layoutCell);

      const tierChanged = Boolean(previous && previous.tierId !== presence.tierId);
      const decayTimeouts = decayFadeTimeoutsRef.current;
      const decayActive = decayTimeouts.has(hexId);
      const isDecayUpdate = presence.lastReason === 'decay';

      if (!isDecayUpdate && decayActive) {
        const existing = decayTimeouts.get(hexId);
        if (existing) {
          clearTimeout(existing);
        }
        decayTimeouts.delete(hexId);
      }

      if (isDecayUpdate && decayActive) {
        const existing = decayTimeouts.get(hexId);
        if (existing) {
          clearTimeout(existing);
        }
        decayTimeouts.delete(hexId);
      }

      const applyDecayFade = isDecayUpdate || decayTimeouts.has(hexId);

      drawHexCell(context, layoutCell, presence, tierColorMap, {
        highlightStrength: tierChanged ? 1 : 0,
        decayFade: applyDecayFade
      });
      drawnCells.set(hexId, { value: presence.value, tierId: presence.tierId });

      if (tierChanged) {
        const existing = highlightTimeoutsRef.current.get(hexId);
        if (existing) {
          clearTimeout(existing);
        }
        const timeoutId = window.setTimeout(() => {
          highlightTimeoutsRef.current.delete(hexId);
          const latestPresence = cellsRef.current.get(hexId);
          const latestLayout = layoutRef.current.get(hexId);
          const latestContext = contextRef.current;
          if (!latestPresence || !latestLayout || !latestContext) {
            return;
          }
          clearHexCell(latestContext, latestLayout);
          const decayStillActive = decayFadeTimeoutsRef.current.has(hexId);
          drawHexCell(latestContext, latestLayout, latestPresence, tierColorMapRef.current, {
            highlightStrength: 0,
            decayFade: decayStillActive
          });
          drawnCellsRef.current.set(hexId, {
            value: latestPresence.value,
            tierId: latestPresence.tierId
          });
        }, HIGHLIGHT_DURATION_MS);
        highlightTimeoutsRef.current.set(hexId, timeoutId);
      }

      if (isDecayUpdate) {
        const existing = decayTimeouts.get(hexId);
        if (existing) {
          clearTimeout(existing);
        }
        const timeoutId = window.setTimeout(() => {
          decayTimeouts.delete(hexId);
          const latestPresence = cellsRef.current.get(hexId);
          const latestLayout = layoutRef.current.get(hexId);
          const latestContext = contextRef.current;
          if (!latestPresence || !latestLayout || !latestContext) {
            return;
          }
          clearHexCell(latestContext, latestLayout);
          drawHexCell(latestContext, latestLayout, latestPresence, tierColorMapRef.current, {
            highlightStrength: 0,
            decayFade: false
          });
          drawnCellsRef.current.set(hexId, {
            value: latestPresence.value,
            tierId: latestPresence.tierId
          });
        }, DECAY_FADE_DURATION_MS);
        decayTimeouts.set(hexId, timeoutId);
      }
    }
  }, [cells, canvasLayout]);

  useEffect(() => () => {
    for (const timeoutId of highlightTimeoutsRef.current.values()) {
      clearTimeout(timeoutId);
    }
    highlightTimeoutsRef.current.clear();
    for (const timeoutId of decayFadeTimeoutsRef.current.values()) {
      clearTimeout(timeoutId);
    }
    decayFadeTimeoutsRef.current.clear();
  }, []);

  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0
  });

  const handlePointerMove = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      let targetHex: string | null = null;
      for (const [hexId, layoutCell] of layoutRef.current.entries()) {
        if (context.isPointInPath(layoutCell.path, pointerX, pointerY)) {
          targetHex = hexId;
          break;
        }
      }

      if (targetHex !== hoveredHexRef.current) {
        hoveredHexRef.current = targetHex;
        setHoveredHexId(targetHex);
      }

      if (targetHex) {
        setTooltipPosition({
          x: pointerX + TOOLTIP_OFFSET_X,
          y: pointerY + TOOLTIP_OFFSET_Y
        });
      }
    },
    []
  );

  const handlePointerLeave = useCallback(() => {
    hoveredHexRef.current = null;
    setHoveredHexId(null);
  }, []);

  const cellEntries = useMemo(() => Array.from(cells.values()), [cells]);
  const populatedCells = useMemo(
    () => cellEntries.filter((entry) => entry.value > 0),
    [cellEntries]
  );

  const hoveredCell = hoveredHexId ? cells.get(hoveredHexId) : undefined;
  const latestUpdate = updateInfo.lastUpdateTs ?? lastUpdateTs;
  const isConnected = connection.status === 'connected' && connection.room;
  const isBusy = !isConnected || loading;

  const statusMessage = (() => {
    if (connection.status === 'error') {
      return connection.error ?? 'Connection error';
    }
    if (!connection.room) {
      return 'Connecting to the world server...';
    }
    if (snapshotError) {
      return snapshotError;
    }
    if (loading && cellEntries.length === 0) {
      return 'Loading presence snapshot...';
    }
    if (!cellEntries.length) {
      return 'No presence data available yet.';
    }
    return 'Presence snapshot ready.';
  })();

  const skeletonCells = useMemo(
    () => Array.from({ length: HEX_SKELETON_COUNT }),
    []
  );

  return (
    <section className="hexMap" aria-live="polite" aria-busy={isBusy}>
      <header className="hexMap__header">
        <p className="hexMap__status">{statusMessage}</p>
        {connection.latencyMs !== undefined && (
          <span className="hexMap__latency">Latency: {Math.round(connection.latencyMs)} ms</span>
        )}
      </header>

      <section className="hexMap__content">
        {loading && cellEntries.length === 0 ? (
          <div className="hexMap__skeleton" aria-hidden="true">
            {skeletonCells.map((_, index) => (
              <div key={index} className="hexMap__skeletonCell" />
            ))}
          </div>
        ) : (
          <div className="hexMap__canvasPanel">
            <div
              className="hexMap__canvasWrapper"
              data-state={cellEntries.length ? 'ready' : 'empty'}
            >
              {cellEntries.length ? (
                <canvas
                  ref={canvasRef}
                  width={Math.max(1, Math.ceil(canvasLayout.width))}
                  height={Math.max(1, Math.ceil(canvasLayout.height))}
                  onMouseMove={handlePointerMove}
                  onMouseLeave={handlePointerLeave}
                  role="img"
                  aria-label="Explored hex presence map"
                />
              ) : (
                <p className="hexMap__emptyMessage">Presence data not available yet.</p>
              )}

              <HexTooltip
                visible={Boolean(hoveredHexId)}
                x={tooltipPosition.x}
                y={tooltipPosition.y}
                hexId={hoveredHexId ?? undefined}
                value={hoveredCell?.value}
                tierId={hoveredCell?.tierId}
                tierLabel={hoveredCell ? tierLabelMap.get(hoveredCell.tierId) : undefined}
                updatedAt={hoveredCell?.updatedAt}
              />
            </div>
            <HexLegend
              items={tierDefinitions}
              contrastMode={contrastMode}
              onContrastModeChange={setContrastMode}
            />
          </div>
        )}
      </section>

      <section className="hexMap__meta" aria-live="off">
        <dl className="hexMap__stats">
          <div>
            <dt>Total cells tracked</dt>
            <dd>{cellEntries.length}</dd>
          </div>
          <div>
            <dt>Active cells</dt>
            <dd>{populatedCells.length}</dd>
          </div>
          {lastSnapshotTs && (
            <div>
              <dt>Snapshot timestamp</dt>
              <dd>{formatTimestamp(lastSnapshotTs)}</dd>
            </div>
          )}
          {latestUpdate && (
            <div>
              <dt>Last update timestamp</dt>
              <dd>{formatTimestamp(latestUpdate)}</dd>
            </div>
          )}
          {latencySample && (
            <div>
              <dt>Latest update latency</dt>
              <dd>
                {Math.round(latencySample.maxLatencyMs)} ms (batch {latencySample.batchSize})
              </dd>
            </div>
          )}
        </dl>
      </section>

      <footer className="hexMap__footer">
        <button type="button" onClick={requestSnapshot} disabled={loading || !connection.room}>
          Refresh snapshot
        </button>
      </footer>
    </section>
  );
};

export default HexMap;
