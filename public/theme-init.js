/*
 * 主题首屏防闪烁（阶段3 / H8）。
 * 以独立文件形式在 <head> 同步执行，避免与 CSP 的 script-src 'self' 冲突——
 * 内联脚本会被 CSP 拦截，导致首屏主题闪烁。
 * 逻辑须与 src/hooks/useTheme.tsx 保持一致（存储键 mw-appearance）。
 */
(function () {
  try {
    var mode = localStorage.getItem('mw-appearance') || 'system';
    var dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {
    // localStorage / matchMedia 不可用时按系统偏好，由 useTheme 兜底
  }
})();
