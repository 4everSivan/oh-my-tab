import React, { useState, useEffect, useRef } from 'react';
import { WidgetComponentProps, WidgetManifest } from '../../contract/types';
import { Play, Pause, RotateCcw } from 'lucide-react';

export interface FocusState {
  durationMinutes: number;
  targetEndTime: number | null;
  remainingSeconds: number;
  isRunning: boolean;
}

export const focusManifest: WidgetManifest = {
  typeId: 'core.focus',
  contractVersion: 1,
  contentVersion: 1,
  displayName: '专注计时',
  icon: 'Timer',
  defaultSpan: 6,
  supportedSpans: [4, 6, 8, 12],
  minContentHeight: 180,
  capabilities: {
    tick: 'second',
    notify: true,
    storage: true,
  },
  syncPolicy: 'never',
};

const PRESETS = [15, 25, 45];

export const FocusTimerWidget: React.FC<WidgetComponentProps> = ({ host }) => {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [targetEndTime, setTargetEndTime] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const isFirstLoad = useRef(true);

  // Load state on mount (cross-refresh state recovery)
  useEffect(() => {
    let active = true;
    host.storage
      .getContent<FocusState>({
        durationMinutes: 25,
        targetEndTime: null,
        remainingSeconds: 25 * 60,
        isRunning: false,
      })
      .then((saved) => {
        if (!active) return;
        const dur = PRESETS.includes(saved.durationMinutes) ? saved.durationMinutes : 25;
        setDurationMinutes(dur);

        if (saved.isRunning && saved.targetEndTime) {
          const now = Date.now();
          const rem = Math.max(0, Math.round((saved.targetEndTime - now) / 1000));
          if (rem > 0) {
            setRemainingSeconds(rem);
            setTargetEndTime(saved.targetEndTime);
            setIsRunning(true);
          } else {
            // Timer expired while page was away
            setRemainingSeconds(dur * 60);
            setIsRunning(false);
            setTargetEndTime(null);
            host.notify?.send('专注结束', `恭喜完成 ${dur} 分钟专注！`);
          }
        } else {
          setRemainingSeconds(typeof saved.remainingSeconds === 'number' ? saved.remainingSeconds : dur * 60);
          setIsRunning(false);
          setTargetEndTime(null);
        }
        setLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [host.instanceId]);

  // Persist state when running or paused
  useEffect(() => {
    if (!loaded) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }

    host.storage.setContent<FocusState>({
      durationMinutes,
      targetEndTime,
      remainingSeconds,
      isRunning,
    });
  }, [durationMinutes, targetEndTime, remainingSeconds, isRunning, loaded, host.instanceId]);

  // Ticking logic
  useEffect(() => {
    if (!isRunning || !targetEndTime) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const rem = Math.max(0, Math.round((targetEndTime - now) / 1000));

      if (rem <= 0) {
        clearInterval(timer);
        setIsRunning(false);
        setTargetEndTime(null);
        setRemainingSeconds(durationMinutes * 60);
        host.notify?.send('专注结束', `恭喜完成 ${durationMinutes} 分钟专注！`);
      } else {
        setRemainingSeconds(rem);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, targetEndTime, durationMinutes, host.notify]);

  const handleStart = () => {
    const end = Date.now() + remainingSeconds * 1000;
    setTargetEndTime(end);
    setIsRunning(true);
  };

  const handlePause = () => {
    if (targetEndTime) {
      const now = Date.now();
      const rem = Math.max(0, Math.round((targetEndTime - now) / 1000));
      setRemainingSeconds(rem);
    }
    setTargetEndTime(null);
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTargetEndTime(null);
    setRemainingSeconds(durationMinutes * 60);
  };

  const handleSelectPreset = (minutes: number) => {
    if (isRunning) return;
    setDurationMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setTargetEndTime(null);
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalDurationSeconds = durationMinutes * 60;
  const progressPercent =
    totalDurationSeconds > 0
      ? Math.max(0, Math.min(100, Math.round(((totalDurationSeconds - remainingSeconds) / totalDurationSeconds) * 100)))
      : 0;

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 py-2 select-none">
      {/* Preset buttons with sliding pill */}
      <div className="relative flex items-center p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 select-none">
        <div
          className="t-tabs-sliding absolute top-1 bottom-1 rounded-lg bg-stone-900 dark:bg-white shadow-xs"
          style={{
            width: '64px',
            left: `${4 + Math.max(0, PRESETS.indexOf(durationMinutes)) * 68}px`,
          }}
        />
        {PRESETS.map((m) => (
          <button
            key={m}
            disabled={isRunning}
            onClick={() => handleSelectPreset(m)}
            className={`relative z-10 w-[64px] py-1 text-center rounded-lg text-xs font-medium transition-colors ${
              durationMinutes === m
                ? 'text-white dark:text-stone-900 font-semibold'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {m} 分钟
          </button>
        ))}
      </div>

      {/* Main Countdown Display */}
      <div className="flex flex-col items-center space-y-1 my-1">
        <div className="text-4xl font-bold tracking-tight font-mono text-stone-800 dark:text-stone-100 tabular-nums">
          {timeDisplay}
        </div>
        <div className="w-48 h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-3 pt-1">
        {isRunning ? (
          <button
            onClick={handlePause}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>暂停</span>
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>开始专注</span>
          </button>
        )}

        <button
          onClick={handleReset}
          disabled={remainingSeconds === durationMinutes * 60 && !isRunning}
          className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-stone-600 dark:text-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          title="重置"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
