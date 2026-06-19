import { useEffect, useRef, useState } from 'react';

interface StatsCounterProps {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  icon?: string;
}

export default function StatsCounter({
  value,
  label,
  prefix = '',
  suffix = '',
  icon,
}: StatsCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(Math.round(increment * step), value);
      setDisplayValue(current);
      if (step >= steps) {
        clearInterval(timer);
        setDisplayValue(value);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [isVisible, value]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div ref={ref} className="flex flex-col items-center gap-2 p-4">
      {icon && <span className="text-2xl">{icon}</span>}
      <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
        {prefix}
        {formatNumber(displayValue)}
        {suffix}
      </div>
      <div className="text-sm text-white/40">{label}</div>
    </div>
  );
}
