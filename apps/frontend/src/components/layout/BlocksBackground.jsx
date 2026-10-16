import React from 'react';

// Fixed coordinates keep the same blocks in place across route changes.
const activeBlocks = {
  0: [2, 4, 6], 1: [0, 8], 2: [1, 3, 5], 4: [0, 5, 8],
  5: [2, 4], 7: [2, 6, 9], 8: [0, 4], 9: [5], 10: [3, 6],
  11: [1, 5], 12: [7], 13: [2, 4], 14: [5], 15: [1, 6],
};

export default function BlocksBackground() {
  return (
    <div className="blocks-background" aria-hidden="true">
      <svg width="100%" height="100%" focusable="false">
        <defs>
          <pattern id="pastel-blocks" width="1024" height="640" patternUnits="userSpaceOnUse">
            <path d="M 64 0 H 0 V 64" fill="none" stroke="#c5d7bf" strokeOpacity=".35" />
            {Array.from({ length: 16 }, (_, column) => Array.from({ length: 10 }, (_, row) => (
              <rect key={`${column}-${row}`} x={column * 64} y={row * 64} width="64" height="64"
                fill={activeBlocks[column]?.includes(row) ? ['#dcebd4', '#e0eee6', '#edf0d9'][(column + row) % 3] : 'none'}
                fillOpacity=".5" stroke="#d4dfce" strokeOpacity=".3" strokeWidth=".6" />
            )))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pastel-blocks)" />
      </svg>
    </div>
  );
}
