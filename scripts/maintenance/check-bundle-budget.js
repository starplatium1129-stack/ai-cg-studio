'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_BUDGETS = Object.freeze({
  routeJavaScript: 128 * 1024,
  routeCss: 100 * 1024,
});

function routeEntries(manifest) {
  return Object.entries(manifest)
    .map(([key, entry]) => ({ key, ...entry }))
    .filter(entry => entry.isDynamicEntry === true && /^src\/views\/.+\.vue$/.test(entry.src || entry.key));
}

function evaluateManifest(manifest, sizeOf, budgets = DEFAULT_BUDGETS) {
  const routes = routeEntries(manifest).map(entry => {
    const cssFiles = [...new Set(entry.css || [])];
    return {
      route: path.basename(entry.src || entry.key, '.vue'),
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

  const largestJs = [...result.routes].sort((a, b) => b.javascript - a.javascript)[0];
  const largestCss = [...result.routes].sort((a, b) => b.css - a.css)[0];
  console.log(
    `Route bundle budget passed: ${result.routes.length} routes; `
    + `largest JS ${largestJs.route} ${kib(largestJs.javascript)} / ${kib(DEFAULT_BUDGETS.routeJavaScript)}; `
    + `largest CSS ${largestCss.route} ${kib(largestCss.css)} / ${kib(DEFAULT_BUDGETS.routeCss)}`,
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

module.exports = { DEFAULT_BUDGETS, evaluateManifest, routeEntries, run };
