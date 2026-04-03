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
      className="h-6 w-20"
      preserveAspectRatio="none"
    >
      <path
        d={areaPath}
        fill="rgba(29, 209, 161, 0.14)"
      />
      <polyline
        fill="none"
        stroke="rgba(32, 201, 151, 0.9)"
        strokeWidth="2.5"
        points={coordinates}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
