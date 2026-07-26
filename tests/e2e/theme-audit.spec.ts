import { test, expect, type Page } from '@playwright/test';

// 双主题美术巡检 —— 全局美术校准后的回归网。
// 检查三类会真实破相的问题:
//   1. 控制台运行时错误
//   2. 横向溢出(布局在窄屏被挤破)
//   3. 文字/背景对比度不足(浅色主题下白字压白底的那类缺陷)
// 前两类是硬失败;对比度做保守判定,只抓"几乎不可读"的极端值。

const PAGES = [
  '/index.html',
  '/tools/scene-explorer.html',
  '/tools/showcase.html',
  '/tools/gallery.html',
  '/tools/character.html',
  '/tools/lora.html',
  '/tools/control.html',
  '/tools/scenario.html',
  '/tools/color-script.html',
  '/tools/style.html',
  '/tools/scene-manager.html',
  '/tools/prompt-builder.html',
  '/tools/chat.html',
  '/docs/index.html',
  '/docs/philosophy.html',
  '/docs/roadmap.html',
  '/docs/quality-standard.html',
  '/docs/art-direction.html',
  '/docs/scene-spec.html',
  '/docs/prompt-spec.html',
  '/docs/tag-standard.html',
  '/docs/worldview.html',
  '/docs/getting-started.html'
];

const THEMES = ['dark', 'light'] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // 本地 SD / Ollama 未启动时的连接失败属环境噪音,不是页面缺陷
    if (/ECONNREFUSED|Failed to load resource|net::ERR|favicon/i.test(text)) return;
    errors.push('console: ' + text);
  });
  return errors;
}

async function applyTheme(page: Page, theme: string) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute('data-theme', value);
  }, theme);
  // 等一帧,让 CSS 变量翻转后的样式生效
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
}

for (const theme of THEMES) {
  for (const target of PAGES) {
    test(`[${theme}] ${target} renders without errors, overflow or unreadable text`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(target);
      await applyTheme(page, theme);
      await page.waitForTimeout(350);

      // ---- 1. 运行时错误 ----
      expect(errors, `${target} @ ${theme} 有运行时错误`).toEqual([]);

      // ---- 2. 横向溢出 ----
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${target} @ ${theme} 横向溢出 ${overflow}px`).toBeLessThanOrEqual(1);

      // ---- 3. 对比度:抓"几乎不可读"的文字 ----
      const unreadable = await page.evaluate(() => {
        function parse(color: string): [number, number, number, number] | null {
          const match = color.match(/rgba?\(([^)]+)\)/);
          if (!match) return null;
          const parts = match[1].split(',').map((value) => parseFloat(value.trim()));
          return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
        }
        function luminance(rgb: [number, number, number]) {
          const [r, g, b] = rgb.map((channel) => {
            const c = channel / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        function blend(fg: [number, number, number, number], bg: [number, number, number]): [number, number, number] {
          const a = fg[3];
          return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
        }
        // 逐级向上找第一个不透明的背景。
        // 返回 null 表示"底是图片或渐变" —— computed style 读不到它的实际像素,
        // 强算出来的比率是假的。这类文字压在画作/渐变之上,应走 --on-art-* /
        // --on-mood-text,由 check-contrast.js 与人工审核把关,不在此判定。
        function effectiveBg(element: Element): [number, number, number] | null {
          let node: Element | null = element;
          const stack: [number, number, number, number][] = [];
          while (node) {
            const style = getComputedStyle(node);
            if (style.backgroundImage && style.backgroundImage !== 'none') return null;
            const bg = parse(style.backgroundColor);
            if (bg && bg[3] > 0) {
              stack.push(bg);
              if (bg[3] >= 0.999) break;
            }
            node = node.parentElement;
          }
          let base: [number, number, number] = [255, 255, 255];
          for (let i = stack.length - 1; i >= 0; i -= 1) base = blend(stack[i], base);
          return base;
        }
        // 文字是否浮在同层的 <img> 之上(画廊说明条、样张标题这类)
        function sitsOnImage(element: Element): boolean {
          let node: Element | null = element;
          for (let depth = 0; node && depth < 5; depth += 1) {
            if (node.querySelector(':scope > img, :scope > picture, :scope > video, :scope > canvas')) return true;
            node = node.parentElement;
          }
          return false;
        }

        const findings: string[] = [];
        const nodes = [...document.querySelectorAll('body *')].filter((element) => {
          if (!(element instanceof HTMLElement)) return false;
          const style = getComputedStyle(element);
          if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) < 0.15) return false;
          // 只看直接承载文字的元素
          const text = [...element.childNodes]
            .filter((child) => child.nodeType === Node.TEXT_NODE)
            .map((child) => child.textContent || '')
            .join('')
            .trim();
          if (text.length < 2) return false;
          // 渐变裁切文字的 fill 是 transparent,对比度无意义
          if (style.webkitTextFillColor === 'rgba(0, 0, 0, 0)') return false;
          const rect = element.getBoundingClientRect();
          return rect.width > 8 && rect.height > 6;
        });

        for (const element of nodes.slice(0, 320)) {
          const style = getComputedStyle(element);
          const fg = parse(style.color);
          if (!fg) continue;
          if (sitsOnImage(element)) continue;
          const bg = effectiveBg(element);
          if (!bg) continue;
          const front = blend(fg, bg);
          const l1 = luminance(front);
          const l2 = luminance(bg);
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          // 1.8:1 以下属于"几乎看不见",这是本次要抓的白字压白底一类缺陷。
          // 不用 4.5:1 全量门禁,避免把装饰性弱化文字全部判失败。
          if (ratio < 1.8) {
            const label = element.tagName.toLowerCase() +
              (element.className && typeof element.className === 'string' ? '.' + element.className.trim().split(/\s+/).join('.') : '');
            findings.push(`${label} ratio=${ratio.toFixed(2)} color=${style.color}`);
          }
        }
        return [...new Set(findings)];
      });

      expect(unreadable, `${target} @ ${theme} 存在几乎不可读的文字`).toEqual([]);
    });
  }
}
