import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseIdleDetectionOptions {
  enabled?: boolean;
  timeoutSeconds?: number;
  isGuarded?: boolean;
  onIdle?: () => void;
  onActive?: () => void;
}

export interface UseIdleDetectionReturn {
  isIdle: boolean;
  remainingSeconds: number;
  resetTimer: () => void;
  forceIdle: () => void;
}

/**
 * useIdleDetection
 * 全域闲置感知与防抖唤醒 Hook (T19 & MOT-14 & LAY-13)
 * 监听全域用户交互事件，支持交互输入/抽屉打开避让守卫
 */
export function useIdleDetection({
  enabled = true,
  timeoutSeconds = 3,
  isGuarded = false,
  onIdle,
  onActive,
}: UseIdleDetectionOptions = {}): UseIdleDetectionReturn {
  const [isIdle, setIsIdle] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(timeoutSeconds);

  const timeoutMs = Math.max(1, timeoutSeconds) * 1000;
  const isIdleRef = useRef(false);
  const isGuardedRef = useRef(isGuarded);
  isGuardedRef.current = isGuarded;
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActiveTimeRef = useRef<number>(Date.now());

  const wakeUp = useCallback(() => {
    lastActiveTimeRef.current = Date.now();
    setRemainingSeconds(timeoutSeconds);

    if (isIdleRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
      onActiveRef.current?.();
    }
  }, [timeoutSeconds]);

  const resetTimer = useCallback(() => {
    wakeUp();

    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (!enabled || isGuardedRef.current) {
      return;
    }

    lastActiveTimeRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      if (isGuardedRef.current) return;
      isIdleRef.current = true;
      setIsIdle(true);
      setRemainingSeconds(0);
      onIdleRef.current?.();
    }, timeoutMs);

    countdownIntervalRef.current = setInterval(() => {
      if (isGuardedRef.current) return;
      const elapsed = Date.now() - lastActiveTimeRef.current;
      const left = Math.max(0, timeoutMs - elapsed);
      setRemainingSeconds(Math.ceil(left / 1000));
      if (left <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    }, 200);
  }, [enabled, timeoutMs, wakeUp]);

  const forceIdle = useCallback(() => {
    if (!enabled || isGuardedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    isIdleRef.current = true;
    setIsIdle(true);
    setRemainingSeconds(0);
    onIdleRef.current?.();
  }, [enabled]);

  // 当 isGuarded 变化（如聚焦搜索框或展开侧栏）时，立即唤醒并停止计时
  useEffect(() => {
    if (isGuarded) {
      wakeUp();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    } else {
      resetTimer();
    }
  }, [isGuarded, resetTimer, wakeUp]);

  // 全域事件监听与防抖重置
  useEffect(() => {
    if (!enabled) {
      wakeUp();
      return;
    }

    const handleActivity = () => {
      if (isGuardedRef.current) {
        wakeUp();
        return;
      }
      resetTimer();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleActivity, { passive: true });
    });

    resetTimer();

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleActivity);
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [enabled, resetTimer, wakeUp]);

  return {
    isIdle: enabled ? isIdle : false,
    remainingSeconds: enabled ? remainingSeconds : timeoutSeconds,
    resetTimer,
    forceIdle,
  };
}
