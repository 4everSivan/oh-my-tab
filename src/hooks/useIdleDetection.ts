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

/** 指针累计位移阈值：小于它视为静止或抖动，不重置倒计时 (C038) */
const POINTER_ACTIVITY_DISTANCE_PX = 4;

/**
 * useIdleDetection
 * 闲置感知与防抖唤醒 Hook (T19 & MOT-14 & LAY-13)
 * 支持交互输入/抽屉打开避让守卫。
 *
 * 活动判定分两段 (C038)：还没进入闲置时，键盘与指针（移动/按下/滚轮）都算活动，
 * 否则用户只是在用鼠标划动页面、一次都没点，也会被 3 秒倒计时判定为"无操作"而淡出。
 * 已进入闲置后仍是显式入口制：指针事件一律不算唤醒，只有点击搜索框与 ` / Escape
 * 退出，避免指针微动把"只显示搜索框"立刻打断。指针位移用累计 4px 阈值过滤静止抖动。
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
  // 上一次被认定为活动的指针位置：用它累计位移，慢速滑动也不会被单帧阈值漏掉
  const lastPointerAnchorRef = useRef<{ x: number; y: number } | null>(null);

  const wakeUp = useCallback(() => {
    lastActiveTimeRef.current = Date.now();
    // 同值 setState 会被 React 跳过，指针高频活动时不会造成连续重渲染
    setRemainingSeconds((prev) => (prev === timeoutSeconds ? prev : timeoutSeconds));

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
      // 闲置态只认 `（反引号）与 Escape 两个退出键：其余按键与全部指针事件都不打断
      // 聚焦态，避免随手一个字母或指针微动就把时钟与图标栏唤回来（快捷键层在闲置态
      // 同样挂起，见 useKeyboardShortcuts 的 suspended）。
      if (isIdleRef.current) {
        const key = event instanceof KeyboardEvent ? event.key : '';
        if (key !== '`' && key !== '~' && key !== 'Escape') return;
        resetTimer();
        return;
      }

      // 未闲置时指针移动按累计位移判定：静止指针 1~2px 的抖动不重置倒计时，
      // 而慢速滑动会持续累计，不会被单帧阈值漏掉 (C038)
      if (event.type === 'pointermove' && event instanceof PointerEvent) {
        const anchor = lastPointerAnchorRef.current;
        const moved = anchor ? Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y) : Infinity;
        if (moved < POINTER_ACTIVITY_DISTANCE_PX) return;
        lastPointerAnchorRef.current = { x: event.clientX, y: event.clientY };
      } else if (event instanceof PointerEvent) {
        lastPointerAnchorRef.current = { x: event.clientX, y: event.clientY };
      } else {
        // 键盘与滚轮活动后清空锚点，让下一次指针移动重新作为活动起点
        lastPointerAnchorRef.current = null;
      }

      resetTimer();
    };

    // 键盘与指针都是"显式活动"：闲置前任意输入都重置倒计时，闲置后由上面的白名单收窄
    const events = ['keydown', 'pointermove', 'pointerdown', 'wheel'];
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
