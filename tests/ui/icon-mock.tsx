import React from 'react';

/** Glyphs only: real business components, sizing and layout are not replaced. */
export default function FixtureIcon({
  name,
  size = 22,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const glyph = name.includes('heart')
    ? '♡'
    : name.includes('chevron-left')
      ? '‹'
      : name.includes('chevron-right') || name.includes('arrow')
        ? '›'
        : name.includes('chevron-up')
          ? '⌃'
          : name.includes('emoticon-excited')
            ? '☺'
            : name.includes('emoticon-happy')
              ? '◡'
              : name.includes('emoticon-neutral')
                ? '○'
                : name.includes('emoticon')
                  ? '☹'
                  : name.includes('check')
                    ? '✓'
                    : name.includes('close')
                      ? '×'
                      : name.includes('plus')
                        ? '+'
                        : name.includes('calendar')
                          ? '▦'
                          : name.includes('search')
                            ? '⌕'
                            : '◇';
  return (
    <span
      aria-hidden="true"
      data-fixture-icon={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        fontSize: size,
        lineHeight: 1,
        color,
        userSelect: 'none',
      }}
    >
      {glyph}
    </span>
  );
}
