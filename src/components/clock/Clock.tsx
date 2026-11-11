import React, { useState, useEffect } from 'react';

interface ClockLineProps {
  textColor?: string;
  shadowProtection?: string;
}

/**
 * 搜索框左上方小钟 (T20)
 * 固定显示时:分与「月日 周几」，无钟表图标、无点击收起、无外观设置；
 * 时间跟随本地系统时区，数字保留逐位弹入动效。
 */
export const ClockLine: React.FC<ClockLineProps> = ({
  textColor = '#141c20',
  shadowProtection = 'none',
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  let timeString: string;
  let dateString: string;

  try {
    timeString = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).format(time);

    const monthDay = new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
    }).format(time);
    const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(time);
    dateString = `${monthDay} ${weekday}`;
  } catch {
    timeString = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    dateString = time.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
  }

  const textShadowStyle =
    shadowProtection && shadowProtection !== 'none' ? shadowProtection : 'none';

  return (
    <div
      className="flex items-baseline gap-[7px] ml-1.5 mb-[10px] select-none whitespace-nowrap"
      style={{ color: textColor }}
      aria-label="当前时间"
    >
      <span
        className="t-digit-group text-[13px] font-semibold leading-none tracking-tight tabular-nums"
        style={{ textShadow: textShadowStyle }}
      >
        {Array.from(timeString).map((char, index) => (
          <span key={`${index}-${char}`} className="t-digit">
            {char}
          </span>
        ))}
      </span>
      <span
        className="text-xs leading-none opacity-80"
        style={{ textShadow: textShadowStyle }}
      >
        {dateString}
      </span>
    </div>
  );
};

/** @deprecated 旧大时钟已由 ClockLine 取代 (T20) */
export const Clock = ClockLine;
