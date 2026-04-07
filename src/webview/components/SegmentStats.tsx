import React from 'react';

interface SegmentStatsProps {
  readonly count: number;
}

export function SegmentStats({ count }: SegmentStatsProps) {
  return <div id="stats">{count > 0 ? `${count} segments` : ''}</div>;
}
