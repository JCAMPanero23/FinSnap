import React from 'react';

interface CircularProgressProps {
  percentage: number;        // 0-100
  size?: number;            // diameter in pixels (default: 56)
  strokeWidth?: number;     // ring thickness (default: 3)
  color: string;            // progress color (hex or tailwind class compatible)
  backgroundColor?: string; // track color (default: #f1f5f9 - slate-100)
  children?: React.ReactNode; // content to display inside circle (e.g., icon)
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  percentage,
  size = 56,
  strokeWidth = 4,
  color,
  backgroundColor = '#f1f5f9',
  children,
}) => {
  // Calculate circle dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate stroke-dashoffset for counter-clockwise progress
  // Starts from top (0°) and goes counter-clockwise (backwards)
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute"
        style={{ overflow: 'visible' }}
      >
        {/* Background circle (track) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle (counter-clockwise from top) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.5s ease-in-out',
            transform: 'rotate(-90deg)',
            transformOrigin: `${size / 2}px ${size / 2}px`,
          }}
        />

        {/* Black border ring for visibility */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#000000"
          strokeWidth={0.5}
          fill="none"
          opacity={0.15}
        />
      </svg>

      {/* Center content (icon) */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default React.memo(CircularProgress, (prev, next) =>
  prev.percentage === next.percentage &&
  prev.color === next.color &&
  prev.size === next.size &&
  prev.backgroundColor === next.backgroundColor
);
