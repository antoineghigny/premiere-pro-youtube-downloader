// Shared progress overlay utility (can be used by buttons if needed)
export function createProgressRing(size = 24, strokeWidth = 2): { svg: SVGSVGElement; setProgress: (pct: number) => void } {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('yt2pp-progress-ring');

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', String(size / 2));
  bgCircle.setAttribute('cy', String(size / 2));
  bgCircle.setAttribute('r', String(radius));
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', 'rgba(255,255,255,0.2)');
  bgCircle.setAttribute('stroke-width', String(strokeWidth));

  const fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fgCircle.setAttribute('cx', String(size / 2));
  fgCircle.setAttribute('cy', String(size / 2));
  fgCircle.setAttribute('r', String(radius));
  fgCircle.setAttribute('fill', 'none');
  fgCircle.setAttribute('stroke', '#fff');
  fgCircle.setAttribute('stroke-width', String(strokeWidth));
  fgCircle.setAttribute('stroke-dasharray', String(circumference));
  fgCircle.setAttribute('stroke-dashoffset', String(circumference));
  fgCircle.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);

  svg.appendChild(bgCircle);
  svg.appendChild(fgCircle);

  return {
    svg,
    setProgress: (pct: number) => {
      const offset = circumference - (pct / 100) * circumference;
      fgCircle.setAttribute('stroke-dashoffset', String(offset));
    },
  };
}
