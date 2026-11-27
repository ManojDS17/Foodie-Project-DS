import React, { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { StatusBadge, type BadgeStatus } from '../common/StatusBadge';
import type {
  AttentionMachine,
  EnergyHistoryPoint,
  UpcomingMaintenanceItem,
} from '../../types';

export type DailyEnergyPoint = EnergyHistoryPoint;

export const FleetEnergyChart: React.FC<{ data?: EnergyHistoryPoint[] }> = ({
  data = [],
}) => {
  const [timeRange, setTimeRange] = useState<'Last 14 days' | 'Last 7 days'>('Last 14 days');
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);

  const visibleData =
    timeRange === 'Last 7 days' && data.length > 7 ? data.slice(-7) : data;

  // Safe hovered index
  const defaultIdx = visibleData.length > 0 ? Math.min(visibleData.length - 1, 10) : 0;
  const [hoveredIndex, setHoveredIndex] = useState<number>(defaultIdx);

  if (!visibleData || visibleData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border-subtle p-5 shadow-xs flex flex-col justify-center items-center h-[260px]">
        <p className="text-xs text-foreground-dim">live telemetry energy data...</p>
      </div>
    );
  }

  // Dynamic Chart Geometry & Limits based on actual data
  const values = visibleData.map((d) => d.kwh);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const minY = Math.max(0, Math.floor((rawMin - 50) / 50) * 50);
  const maxY = Math.max(minY + 100, Math.ceil((rawMax + 50) / 50) * 50);
  const step = (maxY - minY) / 5;
  const yTicks = [
    maxY,
    Math.round(maxY - step),
    Math.round(maxY - step * 2),
    Math.round(maxY - step * 3),
    Math.round(maxY - step * 4),
    minY,
  ];

  const svgWidth = 700;
  const svgHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const plotWidth = svgWidth - paddingLeft - paddingRight;
  const plotHeight = svgHeight - paddingTop - paddingBottom;

  // Coordinate mapping
  const getX = (index: number) =>
    paddingLeft + (visibleData.length > 1 ? (index / (visibleData.length - 1)) * plotWidth : plotWidth / 2);
  const getY = (val: number) =>
    paddingTop + plotHeight * (1 - (val - minY) / Math.max(maxY - minY, 1));

  // Build smooth bezier path
  const points = visibleData.map((d, i) => ({ x: getX(i), y: getY(d.kwh) }));

  // Catmull-Rom or Bezier curve generator
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  // Area path closing to bottom
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    paddingTop + plotHeight
  } L ${points[0].x} ${paddingTop + plotHeight} Z`;

  const safeHoverIdx = hoveredIndex >= 0 && hoveredIndex < points.length ? hoveredIndex : points.length - 1;
  const activePoint = points[safeHoverIdx] || points[0];
  const activeData = visibleData[safeHoverIdx] || visibleData[0];


  return (
    <div className="bg-white rounded-xl border border-border-subtle p-3.5 sm:p-5 shadow-xs">
      {/* Header: Title + Subtitle + Time Dropdown */}
      <div className="flex items-center justify-between pb-3 gap-2">
        <div>
          <h2 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight">
            Energy usage
          </h2>
          <p className="text-[11px] sm:text-xs text-foreground-dim mt-0.5">
            kWh per day, all machines
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIsRangeMenuOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border-subtle text-xs font-semibold text-foreground bg-white hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <span>{timeRange}</span>
            <ChevronDown className="w-3.5 h-3.5 text-foreground-muted" />
          </button>

          {isRangeMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl bg-white border border-border-default shadow-lg py-1 z-20">
              {(['Last 14 days', 'Last 7 days'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setTimeRange(option);
                    setHoveredIndex(0);
                    setIsRangeMenuOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left text-xs font-medium cursor-pointer transition-colors ${
                    timeRange === option
                      ? 'bg-primary-light text-primary font-semibold'
                      : 'text-foreground-body hover:bg-surface-muted'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SVG Smooth Area Curve Chart */}
      <div className="relative w-full overflow-hidden mt-1 select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Smooth Blue Gradient */}
            <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#3B82F6" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Labels */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <text
                  x={paddingLeft - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-foreground-subtle text-[10px] font-medium"
                >
                  {tick}
                </text>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke="#F3F4F6"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Gradient Area Fill */}
          <path d={areaPath} fill="url(#energyGradient)" />

          {/* Smooth Blue Stroke Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Active Guide Dashed Vertical Line */}
          <line
            x1={activePoint.x}
            y1={paddingTop}
            x2={activePoint.x}
            y2={paddingTop + plotHeight}
            stroke="#3B82F6"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Active Circle Dot on Curve */}
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r="4.5"
            fill="#3B82F6"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            className="filter drop-shadow-xs"
          />

          {/* Tooltip Card over active point */}
          <g transform={`translate(${activePoint.x}, ${Math.max(activePoint.y - 48, paddingTop - 10)})`}>
            {/* Tooltip Bubble Box */}
            <rect
              x="-42"
              y="-10"
              width="84"
              height="40"
              rx="6"
              fill="#111827"
              className="filter drop-shadow-md"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              className="fill-foreground-subtle text-[9.5px] font-medium"
            >
              {activeData.fullDate}
            </text>
            <text
              x="0"
              y="22"
              textAnchor="middle"
              className="fill-white text-[12px] font-extrabold"
            >
              {activeData.kwh} kWh
            </text>
          </g>

          {/* X-Axis Date Labels */}
          {visibleData.map((d, i) => {
            const x = getX(i);
            const isSelected = i === safeHoverIdx;
            return (
              <text
                key={d.date}
                x={x}
                y={svgHeight - 8}
                textAnchor="middle"
                className={`text-[9.5px] transition-colors cursor-pointer ${
                  isSelected ? 'fill-foreground font-bold' : 'fill-foreground-subtle'
                }`}
                onClick={() => setHoveredIndex(i)}
              >
                {d.displayDate}
              </text>
            );
          })}

          {/* Invisible interactive hover rects */}
          {visibleData.map((_, i) => {
            const x = getX(i);
            const w = plotWidth / Math.max(visibleData.length - 1, 1);
            return (
              <rect
                key={i}
                x={x - w / 2}
                y={paddingTop}
                width={w}
                height={plotHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export interface DashboardSidePanelsProps {
  totalMachines: number;
  attentionMachines: AttentionMachine[];
  upcomingMaintenance: UpcomingMaintenanceItem[];
  showClientInSubtitle?: boolean;
  attentionActionLabel?: string;
  onAttentionAction: () => void;
  onNavigateMachine: (machineId?: string) => void;
  emptyMachinesMessage: string;
  healthyMachinesMessage: string;
}

const mapVariantToBadge = (variant?: string): BadgeStatus => {
  if (variant === 'offline') return 'offline';
  if (variant === 'high' || variant === 'danger') return 'danger';
  return 'warning';
};

export const DashboardSidePanels: React.FC<DashboardSidePanelsProps> = ({
  totalMachines,
  attentionMachines,
  upcomingMaintenance,
  showClientInSubtitle = true,
  attentionActionLabel = 'Alerts',
  onAttentionAction,
  onNavigateMachine,
  emptyMachinesMessage,
  healthyMachinesMessage,
}) => {
  return (
    <div className="lg:col-span-4 flex flex-col gap-5">
      {/* 1. Machines Needing Attention */}
      <div className="bg-white rounded-xl border border-border-subtle p-3.5 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-surface-hover">
          <h2 className="text-sm font-bold text-foreground">
            Machines needing attention
          </h2>
          <button
            type="button"
            onClick={onAttentionAction}
            className="group text-xs font-bold text-primary flex items-center gap-1 cursor-pointer"
          >
            <span className="group-hover:underline">{attentionActionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5 inline-block shrink-0 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {totalMachines === 0 ? (
          <div className="py-6 text-center text-xs text-foreground-muted bg-surface-muted rounded-xl border border-border-default my-2">
            {emptyMachinesMessage}
          </div>
        ) : attentionMachines.length === 0 ? (
          <div className="py-6 text-center text-xs text-status-running-text bg-emerald-50/50 rounded-xl border border-emerald-100 my-2">
            {healthyMachinesMessage}
          </div>
        ) : (
          <div className="divide-y divide-surface-hover mt-1">
            {attentionMachines.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <button
                    type="button"
                    onClick={() => onNavigateMachine(m.id)}
                    className="font-bold text-primary underline hover:text-primary-hover block text-left cursor-pointer"
                  >
                    {m.machine_code}
                  </button>
                  <div className="text-[11px] text-foreground-muted mt-0.5 truncate">
                    {showClientInSubtitle && m.client ? `${m.client} · ${m.issue}` : m.issue}
                  </div>
                </div>

                <StatusBadge
                  status={mapVariantToBadge(m.variant)}
                  label={m.status}
                  size="sm"
                  bordered
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Upcoming Maintenance */}
      <div className="bg-white rounded-xl border border-border-subtle p-3.5 sm:p-5 shadow-xs">
        <div className="pb-3 border-b border-surface-hover">
          <h2 className="text-sm font-bold text-foreground">
            Upcoming maintenance
          </h2>
        </div>

        {upcomingMaintenance.length === 0 ? (
          <div className="py-6 text-center text-xs text-foreground-dim bg-gray-50/50 rounded-xl border border-gray-100 my-2">
            No maintenance scheduled for the next 30 days.
          </div>
        ) : (
          <div className="divide-y divide-surface-hover mt-1">
            {upcomingMaintenance.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-2">
                  <button
                    type="button"
                    onClick={() => onNavigateMachine()}
                    className="font-bold text-primary underline hover:text-primary-hover block text-left cursor-pointer"
                  >
                    {item.machine_code}
                  </button>
                  <div className="text-[11px] text-foreground-muted mt-0.5 truncate">
                    {showClientInSubtitle && item.client ? `${item.client} · ${item.task}` : item.task}
                  </div>
                </div>

                <span className="text-[11px] font-bold text-foreground shrink-0">
                  {item.date}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
