import { useEffect, useState } from 'react';

/**
 * 退出动画支撑（@topic: MotionSystem）：
 * - mounted：isOpen 关闭后延迟 closeDurationMs 再置 false，期间组件保持挂载
 *   并携带 data-open="false" 播放退出过渡；
 * - open：挂载后强制同步回流（读取 offsetHeight）确保关闭态样式已参与布局，
 *   再翻转 data-open="true" 触发进入过渡。不依赖 requestAnimationFrame，
 *   在被遮挡/不绘制的标签页同样可靠——与参考库 transitions.dev 文档的
 *   "force a reflow, then re-add the class" 重放机制一致。
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
    // 强制同步回流：把 data-open="false" 的关闭态样式提交进布局后再翻转，
    // 浏览器才能将状态变化识别为过渡起点而非同帧跳变
    void document.documentElement.offsetHeight;
    setEntered(true);
  }, [isOpen, mounted]);

  return { mounted, open: isOpen && entered };
}
