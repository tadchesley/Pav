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
}> = ({ data, width, height, color, predictedPrice, bgColor, timestamps, predictionLabel }) => {
  if (!data || data.length < 2) return <View style={{ width, height, backgroundColor: bgColor }} />;
  const allData = predictedPrice ? [...data, predictedPrice] : data;
  const min = Math.min(...allData);
  const max = Math.max(...allData);
  const range = max - min || 1;
  const forecastSteps = predictedPrice ? 15 : 0;
  const step = width / (data.length - 1 + forecastSteps);
  const points = data.map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`).join(' ');

  let predictionLine = null;
  if (predictedPrice !== undefined) {
    const lastX = (data.length - 1) * step;
    const lastY = height - ((data[data.length - 1] - min) / range) * height;
    const predX = (data.length - 1 + forecastSteps) * step;
    const predY = height - ((predictedPrice - min) / range) * height;
    predictionLine = <Line x1={lastX} y1={lastY} x2={predX} y2={predY} stroke={color} strokeWidth={2} strokeDasharray="4 4" />;
  }
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {predictionLine}
    </Svg>
  );
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
};

/**
 * Renders a date axis below a PriceChart of the same width. Shows ~4-5 history
 * labels plus a final dated "target" label for the AI forecast horizon.
 */
export const ChartDateAxis: React.FC<{
  timestamps: number[];
  width: number;
  color: string;
  targetColor: string;
  horizonDays?: number;
  hasForecast?: boolean;
}> = ({ timestamps, width, color, targetColor, horizonDays = 30, hasForecast = true }) => {
  if (!timestamps || timestamps.length < 2) return null;
  const forecastSteps = hasForecast ? 15 : 0;
  const totalSlots = timestamps.length - 1 + forecastSteps;
  const step = width / totalSlots;

  // Pick ~4 evenly-spaced history label indices.
  const labelCount = 4;
  const indices: number[] = [];
  for (let i = 0; i < labelCount; i++) {
    indices.push(Math.round((i * (timestamps.length - 1)) / (labelCount - 1)));
  }

  const lastTs = timestamps[timestamps.length - 1];
  const targetDate = new Date((lastTs + horizonDays * 86400) * 1000);
  const targetLabel = `${MONTHS_SHORT[targetDate.getMonth()]} ${targetDate.getDate()}`;
  const targetX = (timestamps.length - 1 + forecastSteps) * step;

  return (
    <View style={{ width, height: 18, marginTop: 6, position: 'relative' }}>
      {indices.map((idx) => (
        <Text
          key={idx}
          style={{
            position: 'absolute',
            left: Math.max(0, Math.min(width - 40, idx * step - 18)),
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
            left: Math.max(0, Math.min(width - 40, targetX - 18)),
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
