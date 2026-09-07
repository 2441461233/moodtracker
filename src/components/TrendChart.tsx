import React, { useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { MoodEntry } from '../types';
import { addDays, dayKey } from '../lib/dates';
import { averageMood, emotionForScore, groupByDay } from '../lib/insights';
import { MOOD_APPEARANCE, useTheme } from '../theme';
import { Label } from './ui';

export function TrendChart({
  entries,
  start,
  end,
}: {
  entries: MoodEntry[];
  start: Date;
  end: Date;
}) {
  const theme = useTheme();
  const { width: viewportWidth } = useWindowDimensions();
  const [width, setWidth] = useState(500);
  const fillId = useRef(`trend-fill-${Math.random().toString(36).slice(2, 8)}`).current;
  const groups = groupByDay(entries);
  const days: Date[] = [];
  for (let date = new Date(start); date < end; date = addDays(date, 1)) days.push(date);
  const height = viewportWidth >= 1024 ? 260 : 184;
  const left = 23;
  const right = 15;
  const top = 17;
  const bottom = 30;
  const chartHeight = height - top - bottom;
  const points = days.map((day, index) => ({
    day,
    score: averageMood(groups.get(dayKey(day)) ?? []),
    x: left + (index / Math.max(days.length - 1, 1)) * (width - left - right),
  }));
  const y = (value: number) => top + ((5 - value) / 4) * chartHeight;
  // 连续有记录的日子分段；每段用经过中点的二次贝塞尔平滑。
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point.score === null) {
      if (current.length) segments.push(current);
      current = [];
      continue;
    }
    current.push({ x: point.x, y: y(point.score) });
  }
  if (current.length) segments.push(current);
  const smooth = (segment: { x: number; y: number }[]) => {
    let d = `M ${segment[0].x} ${segment[0].y}`;
    for (let i = 1; i < segment.length; i++) {
      if (i === segment.length - 1) {
        d += ` L ${segment[i].x} ${segment[i].y}`;
      } else {
        const midX = (segment[i].x + segment[i + 1].x) / 2;
        const midY = (segment[i].y + segment[i + 1].y) / 2;
        d += ` Q ${segment[i].x} ${segment[i].y} ${midX} ${midY}`;
      }
    }
    return d;
  };
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));
  return (
    <View onLayout={(event) => setWidth(Math.max(event.nativeEvent.layout.width, 160))}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`心情趋势，${groups.size} 个有记录的日子，满分 5 分，空缺代表当天没有记录。`}
      >
        <Defs>
          <LinearGradient id={fillId} x1={0} y1={0} x2={0} y2={1}>
            <Stop offset={0} stopColor={theme.accent} stopOpacity={theme.dark ? 0.34 : 0.22} />
            <Stop offset={1} stopColor={theme.accent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[1, 2, 3, 4, 5].map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke={theme.border}
              strokeOpacity={0.7}
              strokeDasharray="3 5"
            />
            <SvgText x={3} y={y(value) + 4} fill={theme.muted} fontSize={10}>
              {value}
            </SvgText>
          </React.Fragment>
        ))}
        {segments
          .filter((segment) => segment.length > 1)
          .map((segment, index) => (
            <Path
              key={`area-${index}`}
              d={`${smooth(segment)} L ${segment[segment.length - 1].x} ${height - bottom} L ${segment[0].x} ${height - bottom} Z`}
              fill={`url(#${fillId})`}
              stroke="none"
            />
          ))}
        {segments
          .filter((segment) => segment.length > 1)
          .map((segment, index) => (
            <Path
              key={`line-${index}`}
              d={smooth(segment)}
              fill="none"
              stroke={theme.accent}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        {points
          .filter((point) => point.score !== null)
          .map((point) => {
            const emotion = emotionForScore(point.score!);
            const mood = emotion ? MOOD_APPEARANCE[emotion] : null;
            const radius = days.length > 40 ? 2.8 : 4.5;
            return (
              <React.Fragment key={dayKey(point.day)}>
                {mood && days.length <= 40 && (
                  <Circle cx={point.x} cy={y(point.score!)} r={radius + 4} fill={mood.glow} />
                )}
                <Circle
                  cx={point.x}
                  cy={y(point.score!)}
                  r={radius}
                  fill={theme.surface}
                  stroke={mood?.color ?? theme.accent}
                  strokeWidth={2.2}
                />
              </React.Fragment>
            );
          })}
        {points
          .filter((_, index) => index % labelEvery === 0 || index === days.length - 1)
          .map((point, index, all) => (
            <SvgText
              key={dayKey(point.day)}
              x={point.x}
              y={height - 5}
              fill={theme.muted}
              fontSize={9}
              textAnchor={index === 0 ? 'start' : index === all.length - 1 ? 'end' : 'middle'}
            >
              {point.day.getMonth() + 1}/{point.day.getDate()}
            </SvgText>
          ))}
      </Svg>
      <Label muted style={{ fontSize: 10, marginTop: 10 }}>
        按日平均 · 缺失日期不连线、不计为零分
      </Label>
    </View>
  );
}
