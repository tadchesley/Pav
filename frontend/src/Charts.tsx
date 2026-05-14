import React from 'react';
import Svg, { Polyline, Path, Line } from 'react-native-svg';
import { View, Text } from 'react-native';

export const Sparkline: React.FC<{ data: number[]; width?: number; height?: number; color: string }> = ({ data, width = 80, height = 28, color }) => {
  if (!data || data.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`).join(' ');
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
};

export const PriceChart: React.FC<{
  data: number[];
  width: number;
  height: number;
  color: string;
  predictedPrice?: number;
  bgColor: string;
  timestamps?: number[]; // unix-seconds
  predictionLabel?: string; // e.g. "1D" / "1W" / "1M"
  yAxis?: boolean; // show price labels on the right
  yAxisColor?: string;
}> = ({ data, width, height, color, predictedPrice, bgColor, yAxis = false, yAxisColor = '#71717A' }) => {
  if (!data || data.length < 2) return <View style={{ width, height, backgroundColor: bgColor }} />;

  // Reserve space on the right for y-axis labels when enabled.
  const yLabelWidth = yAxis ? 56 : 0;
  const plotWidth = width - yLabelWidth;

  const allData = predictedPrice !== undefined ? [...data, predictedPrice] : data;
  let min = Math.min(...allData);
  let max = Math.max(...allData);
  // Add 4% padding so the line doesn't kiss the top/bottom.
  const pad = Math.max(0.01, (max - min) * 0.06);
  min -= pad;
  max += pad;
  const range = max - min || 1;

  const forecastSteps = predictedPrice !== undefined ? 15 : 0;
  const step = plotWidth / (data.length - 1 + forecastSteps);
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`).join(' ');

  let predictionLine = null;
  if (predictedPrice !== undefined) {
    const lastX = (data.length - 1) * step;
    const lastY = height - ((data[data.length - 1] - min) / range) * height;
    const predX = (data.length - 1 + forecastSteps) * step;
    const predY = height - ((predictedPrice - min) / range) * height;
    predictionLine = <Line x1={lastX} y1={lastY} x2={predX} y2={predY} stroke={color} strokeWidth={2.5} strokeDasharray="5 5" strokeLinecap="round" />;
  }

  // Y-axis ticks at min, mid, max (5 ticks)
  const ticks = yAxis ? [0, 0.25, 0.5, 0.75, 1].map(t => ({
    y: height - t * height,
    value: min + t * range,
  })) : [];

  return (
    <View style={{ width, height }}>
      <Svg width={plotWidth} height={height}>
        {/* Subtle horizontal grid lines when y-axis is on */}
        {yAxis && ticks.map((t, i) => (
          <Line
            key={`grid-${i}`}
            x1={0} y1={t.y} x2={plotWidth} y2={t.y}
            stroke={yAxisColor} strokeOpacity={0.12} strokeWidth={1}
          />
        ))}
        <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {predictionLine}
      </Svg>
      {/* Y-axis price labels on the right */}
      {yAxis && (
        <View style={{ position: 'absolute', right: 0, top: 0, width: yLabelWidth, height }}>
          {ticks.map((t, i) => (
            <Text
              key={`yt-${i}`}
              style={{
                position: 'absolute',
                right: 4,
                top: Math.max(0, Math.min(height - 12, t.y - 6)),
                fontSize: 10,
                color: yAxisColor,
                fontWeight: '500',
              }}>
              ${t.value.toFixed(t.value > 100 ? 0 : 2)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};

/**
 * Renders a date axis below a PriceChart of the same width. Shows 3 history
 * labels plus a final dated "target" label for the AI forecast horizon.
 * The `reservedRight` value should match the y-axis label width on the chart so labels stay aligned.
 */
export const ChartDateAxis: React.FC<{
  timestamps: number[];
  width: number;
  color: string;
  targetColor: string;
  horizonDays?: number;
  hasForecast?: boolean;
  reservedRight?: number;
}> = ({ timestamps, width, color, targetColor, horizonDays = 30, hasForecast = true, reservedRight = 0 }) => {
  if (!timestamps || timestamps.length < 2) return null;
  const plotWidth = width - reservedRight;
  const forecastSteps = hasForecast ? 15 : 0;
  const totalSlots = timestamps.length - 1 + forecastSteps;
  const step = plotWidth / totalSlots;

  // Pick 3 evenly-spaced history indices so labels aren't cramped.
  const indices = [
    0,
    Math.round((timestamps.length - 1) * 0.5),
    timestamps.length - 1,
  ];

  const lastTs = timestamps[timestamps.length - 1];
  const targetDate = new Date((lastTs + horizonDays * 86400) * 1000);
  const targetLabel = `${MONTHS_SHORT[targetDate.getMonth()]} ${targetDate.getDate()}`;
  const targetX = (timestamps.length - 1 + forecastSteps) * step;

  const labelHalfWidth = 24; // approx half-width of a "May 14"-ish label
  const clampX = (x: number) => Math.max(0, Math.min(plotWidth - labelHalfWidth * 2, x - labelHalfWidth));

  return (
    <View style={{ width, height: 16, marginTop: 8, position: 'relative' }}>
      {indices.map((idx, i) => (
        <Text
          key={`d-${i}`}
          style={{
            position: 'absolute',
            left: clampX(idx * step),
            width: labelHalfWidth * 2,
            textAlign: i === 0 ? 'left' : i === indices.length - 1 ? 'right' : 'center',
            fontSize: 10,
            color,
          }}>
          {fmtDate(timestamps[idx])}
        </Text>
      ))}
      {hasForecast && (
        <Text
          style={{
            position: 'absolute',
            left: clampX(targetX),
            width: labelHalfWidth * 2,
            textAlign: 'right',
            fontSize: 10,
            fontWeight: '700',
            color: targetColor,
          }}>
          {targetLabel}
        </Text>
      )}
    </View>
  );
};

export const Gauge: React.FC<{ value: number; theme: any; size?: number }> = ({ value, theme, size = 140 }) => {
  const radius = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 180;
  const endAngle = 0;
  const valAngle = 180 - (value / 100) * 180;

  const polar = (angle: number, r: number) => {
    const rad = (angle * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const [sx, sy] = polar(startAngle, radius);
  const [ex, ey] = polar(endAngle, radius);
  const [vx, vy] = polar(valAngle, radius);

  const color = value > 55 ? theme.bullish : value < 45 ? theme.bearish : theme.neutral;
  return (
    <Svg width={size} height={size / 2 + 10}>
      <Path d={`M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${ex} ${ey}`} fill="none" stroke={theme.border} strokeWidth={10} strokeLinecap="round" />
      <Path d={`M ${sx} ${sy} A ${radius} ${radius} 0 0 1 ${vx} ${vy}`} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
    </Svg>
  );
};
