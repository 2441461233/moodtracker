import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { MoodEntry } from '../types';
import { addDays, dayKey } from '../lib/dates';
import { averageMood, groupByDay } from '../lib/insights';
import { useTheme } from '../theme';
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
  let path = '';
  let previousWasSet = false;
  for (const point of points) {
    if (point.score === null) {
      previousWasSet = false;
      continue;
    }
    path += `${previousWasSet ? 'L' : 'M'} ${point.x} ${y(point.score)} `;
    previousWasSet = true;
  }
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
        {[1, 2, 3, 4, 5].map((value) => (
          <React.Fragment key={value}>
            <Line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              stroke={theme.border}
              strokeDasharray="3 5"
            />
            <SvgText x={3} y={y(value) + 4} fill={theme.muted} fontSize={10}>
              {value}
            </SvgText>
          </React.Fragment>
        ))}
        <Path
          d={path}
          fill="none"
          stroke={theme.accent}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points
          .filter((point) => point.score !== null)
          .map((point) => (
            <Circle
              key={dayKey(point.day)}
              cx={point.x}
              cy={y(point.score!)}
              r={days.length > 40 ? 2.8 : 4}
              fill={theme.accent}
              stroke={theme.surface}
              strokeWidth={1.7}
            />
          ))}
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
