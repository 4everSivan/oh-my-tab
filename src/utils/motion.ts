/**
 * 动效支撑纯函数（@topic: MotionSystem）。
 * 令牌单一来源见 src/styles/motion.css；本函数仅计算交错延迟数值。
 */

/**
 * 栅格卡片交错入场延迟：index 从 0 起，按 stepMs 步进，封顶 capMs。
 * 超出封顶后同批余量卡片同时入场，防止长列表尾部逐个等待。
 * 默认值须与 motion.css 的 --card-enter-dur/--stagger-step 量级匹配。
 */
export function computeCardStagger(index: number, stepMs = 40, capMs = 360): number {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`computeCardStagger: index 须为非负整数，收到 ${index}`);
  }
  if (stepMs < 0 || capMs < 0) {
    throw new RangeError(`computeCardStagger: stepMs/capMs 须为非负数，收到 ${stepMs}/${capMs}`);
  }
  return Math.min(index * stepMs, capMs);
}
