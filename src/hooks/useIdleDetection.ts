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
 * 闲置感知与防抖唤醒 Hook (T19 & MOT-14 & LAY-13)
 * 支持交互输入/抽屉打开避让守卫。
 *
 * 唤醒事件只含键盘：鼠标移动、滚轮与滚动一律不计为活动，否则闲置态会被
 * 无意的指针微动立刻打断，"只显示搜索框"永远维持不住。鼠标侧的高亮与
 * 唤醒由 CSS :hover 与搜索框上的显式指针处理器分别承担（见 App.tsx）。
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

    const handleActivity = (event: Event) => {
      if (isGuardedRef.current) {
        wakeUp();
        return;
      }
      // 闲置态只认 `（反引号）与 Escape 两个退出键：其余按键不打断聚焦态，
      // 避免随手一个字母就把时钟与图标栏唤回来（快捷键层在闲置态同样挂起，
      // 见 useKeyboardShortcuts 的 suspended）。
      if (isIdleRef.current) {
        const key = event instanceof KeyboardEvent ? event.key : '';
        if (key !== '`' && key !== '~' && key !== 'Escape') return;
      }
      resetTimer();
    };

    // 仅键盘视为"显式活动"：` 聚焦搜索、任意按键都意味着用户回到工作台
    const events = ['keydown'];
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
