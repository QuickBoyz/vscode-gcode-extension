import React from 'react';

interface SegmentStatsProps {
  readonly count: number;
}

export const SegmentStats: React.FC<SegmentStatsProps> = ({ count }) => (
  <div id="stats">{count > 0 ? `${count} segments` : ''}</div>
);
