import { useEffect, useState } from 'react';

/**
 * 退出动画支撑（@topic: MotionSystem）：
 * - mounted：isOpen 关闭后延迟 closeDurationMs 再置 false，期间组件保持挂载
 *   并携带 data-open="false" 播放退出过渡；
 * - open：挂载后跨两帧再置 true，确保浏览器先提交关闭态样式，
 *   随后的 data-open="true" 翻转才能触发进入过渡（避免同帧跳变吞掉动画）。
 */
export function useDelayedUnmount(isOpen: boolean, closeDurationMs: number) {
  const [mounted, setMounted] = useState(isOpen);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), closeDurationMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, closeDurationMs]);

  useEffect(() => {
    if (!isOpen || !mounted) {
      setEntered(false);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isOpen, mounted]);

  return { mounted, open: isOpen && entered };
}
