import React, { useState, useEffect } from 'react';
import { ClockAppearance } from '../../services/storage/types';

interface ClockProps {
  appearance: ClockAppearance;
  isCollapsed: boolean;
  textColor?: string;
  onToggleCollapse: () => void;
}

export const Clock: React.FC<ClockProps> = ({
  appearance,
  textColor = '#141c20',
  onToggleCollapse,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');

  const timeString = appearance.showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;

  // Date formatting (Chinese locale with fallback)
  const dateString = time.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const fontClass =
    appearance.font === 'mono'
      ? 'font-mono'
      : appearance.font === 'serif'
      ? 'font-serif'
      : 'font-modern';

  const alignClass =
    appearance.align === 'left'
      ? 'items-start text-left'
      : appearance.align === 'right'
      ? 'items-end text-right'
      : 'items-center text-center';

  const textShadowStyle =
    appearance.shadow === 'soft'
      ? '0 4px 16px rgba(0, 0, 0, 0.25)'
      : 'none';

  return (
    <div
      className={`flex flex-col select-none cursor-pointer group transition-all duration-300 ${alignClass}`}
      style={{
        paddingTop: `${appearance.top}px`,
        color: textColor,
      }}
      onClick={onToggleCollapse}
      title="点击切换极简/工作台模式"
    >
      {/* Time Display */}
      <h1
        className={`tracking-tight transition-transform duration-200 group-hover:scale-[1.01] ${fontClass}`}
        style={{
          fontSize: `${appearance.size}px`,
          fontWeight: appearance.weight,
          lineHeight: 1,
          textShadow: textShadowStyle,
        }}
      >
        {timeString}
      </h1>

      {/* Date Display */}
      {appearance.showDate && (
        <p
          className={`mt-2 text-sm md:text-base opacity-90 transition-opacity ${fontClass}`}
          style={{ textShadow: textShadowStyle }}
        >
          {dateString}
        </p>
      )}
    </div>
  );
};
