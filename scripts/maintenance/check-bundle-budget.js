'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_BUDGETS = Object.freeze({
  // PromptBuilder carries the three server-backed engines and their history
  // controls. Heavy expert controls (including artist tags) stay async. Its route
  // chunk is about 130 KiB; 132 KiB leaves modest room for
  // feature maintenance without turning this into a blanket route increase.
  routeJavaScript: 132 * 1024,
  routeCss: 100 * 1024,
  // wl-live2d 懒加载块：pixi.js + pixi-live2d-display + cubism4 core 全内联，
  // 大小由依赖决定，这里监控防止未来升级/引入新依赖把它撑得更大。
  lazyChunk: 1000 * 1024,
});

function routeEntries(manifest) {
  return Object.entries(manifest)
    .map(([key, entry]) => ({ key, ...entry }))
    .filter(entry => entry.isDynamicEntry === true && (
      /^src\/views\/.+\.vue$/.test(entry.src || entry.key)
      || (!entry.src && /View$/.test(entry.name || ''))
    ));
}

function lazyChunks(manifest) {
  return Object.entries(manifest)
    .map(([key, entry]) => ({ key, ...entry }))
    .filter(entry => entry.isDynamicEntry === true && !/^src\/views\/.+\.vue$/.test(entry.src || entry.key));
}

function evaluateManifest(manifest, sizeOf, budgets = DEFAULT_BUDGETS) {
  const routes = routeEntries(manifest).map(entry => {
    const cssFiles = [...new Set(entry.css || [])];
    return {
      route: entry.name || path.basename(entry.src || entry.key, '.vue'),
      file: entry.file,
      javascript: sizeOf(entry.file),
      css: cssFiles.reduce((total, file) => total + sizeOf(file), 0),
    };
  });

  const violations = [];
  for (const route of routes) {
    if (route.javascript > budgets.routeJavaScript) {
      violations.push(`${route.route} JavaScript ${route.javascript} > ${budgets.routeJavaScript}`);
    }
    if (route.css > budgets.routeCss) {
      violations.push(`${route.route} CSS ${route.css} > ${budgets.routeCss}`);
    }
  }
  return { routes, violations };
}

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function run(distDir = path.resolve(__dirname, '../../dist')) {
  const manifestPath = path.join(distDir, '.vite', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Vite manifest missing: ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const result = evaluateManifest(manifest, file => fs.statSync(path.join(distDir, file)).size);
  if (result.routes.length < 12) {
    throw new Error(`Expected at least 12 lazy route chunks, found ${result.routes.length}`);
  }
  if (result.violations.length) {
    throw new Error(`Route bundle budget exceeded:\n${result.violations.join('\n')}`);
  }

  // 非路由动态块（wl-live2d 等）只监控大小上限，不设路由级预算
  const lazy = lazyChunks(manifest).map(entry => ({
    key: entry.key,
    file: entry.file,
    javascript: fs.statSync(path.join(distDir, entry.file)).size,
  }));
  const lazyViolations = lazy
    .filter(entry => entry.javascript > DEFAULT_BUDGETS.lazyChunk)
    .map(entry => `${entry.key} JavaScript ${entry.javascript} > ${DEFAULT_BUDGETS.lazyChunk}`);
  if (lazyViolations.length) {
    throw new Error(`Lazy chunk budget exceeded:\n${lazyViolations.join('\n')}`);
  }

  const largestJs = [...result.routes].sort((a, b) => b.javascript - a.javascript)[0];
  const largestCss = [...result.routes].sort((a, b) => b.css - a.css)[0];
  const largestLazy = lazy.sort((a, b) => b.javascript - a.javascript)[0];
  console.log(
    `Route bundle budget passed: ${result.routes.length} routes; `
    + `largest JS ${largestJs.route} ${kib(largestJs.javascript)} / ${kib(DEFAULT_BUDGETS.routeJavaScript)}; `
    + `largest CSS ${largestCss.route} ${kib(largestCss.css)} / ${kib(DEFAULT_BUDGETS.routeCss)}; `
    + `largest lazy ${path.basename(largestLazy.key)} ${kib(largestLazy.javascript)} / ${kib(DEFAULT_BUDGETS.lazyChunk)}`,
  );
  return result;
}

if (require.main === module) {
  try {
    run(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { DEFAULT_BUDGETS, evaluateManifest, routeEntries, lazyChunks, run };
