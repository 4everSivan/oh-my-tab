import React, { useState, useEffect } from 'react';
import { ClockAppearance } from '../../services/storage/types';

interface ClockProps {
  appearance: ClockAppearance;
  isCollapsed: boolean;
  textColor?: string;
  shadowProtection?: string;
  onToggleCollapse: () => void;
}

export const Clock: React.FC<ClockProps> = ({
  appearance,
  textColor = '#141c20',
  shadowProtection = 'none',
  onToggleCollapse,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const targetTimezone =
    appearance.timezone && appearance.timezone !== 'auto'
      ? appearance.timezone
      : undefined;

  let hours: string;
  let minutes: string;
  let seconds: string;
  let dateString: string;

  try {
    const timeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: targetTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(time);

    hours = timeParts.find((p) => p.type === 'hour')?.value.padStart(2, '0') || '00';
    minutes = timeParts.find((p) => p.type === 'minute')?.value.padStart(2, '0') || '00';
    seconds = timeParts.find((p) => p.type === 'second')?.value.padStart(2, '0') || '00';

    dateString = new Intl.DateTimeFormat('zh-CN', {
      timeZone: targetTimezone,
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(time);
  } catch {
    hours = String(time.getHours()).padStart(2, '0');
    minutes = String(time.getMinutes()).padStart(2, '0');
    seconds = String(time.getSeconds()).padStart(2, '0');
    dateString = time.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }

  const timeString = appearance.showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;

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
      ? '0 4px 16px rgba(0, 0, 0, 0.35)'
      : shadowProtection && shadowProtection !== 'none'
      ? shadowProtection
      : 'none';

  return (
    <div
      className={`flex flex-col select-none cursor-pointer group transition-colors duration-300 ${alignClass}`}
      style={{
        paddingTop: `${appearance.top}px`,
        color: textColor,
      }}
      onClick={onToggleCollapse}
      title="点击切换极简/工作台模式"
    >
      {/* Time Display：逐位渲染，key 含字符值——仅数值变化的位重挂载并重放 t-digit 弹入 */}
      <h1
        className={`tracking-tight tabular-nums transition-transform duration-200 group-hover:scale-[1.01] ${fontClass}`}
        style={{
          fontSize: `${appearance.size}px`,
          fontWeight: appearance.weight,
          lineHeight: 1,
          textShadow: textShadowStyle,
        }}
      >
        <span className="t-digit-group tabular-nums">
          {Array.from(timeString).map((char, index) => (
            <span key={`${index}-${char}`} className="t-digit">
              {char}
            </span>
          ))}
        </span>
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
