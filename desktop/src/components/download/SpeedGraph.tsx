import React from 'react';

type SpeedGraphProps = {
  points: number[];
};

export function SpeedGraph({ points }: SpeedGraphProps) {
  const safePoints = points.length > 1 ? points : [0, 0];
  const averageValue = safePoints.reduce((sum, point) => sum + point, 0) / safePoints.length;
  const sortedPoints = [...safePoints].sort((left, right) => left - right);
  const upperBand = sortedPoints[Math.floor((sortedPoints.length - 1) * 0.85)] ?? 0;
  const referenceValue = Math.max(averageValue * 1.35, upperBand, 1);
  const coordinates = safePoints
    .map((point, index) => {
      const x = (index / (safePoints.length - 1 || 1)) * 100;
      const y = 24 - (Math.min(point, referenceValue) / referenceValue) * 24;
      return `${x},${y}`;
    })
    .join(' ');
  const areaPath = `M0,24 L${coordinates.split(' ').join(' L')} L100,24 Z`;

  return (
    <svg
      viewBox="0 0 100 24"
      className="h-4 w-16"
      preserveAspectRatio="none"
    >
      <path
        d={areaPath}
        fill="rgba(214, 156, 58, 0.12)"
      />
      <polyline
        fill="none"
        stroke="#d69c3a"
        strokeWidth="1.5"
        points={coordinates}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
