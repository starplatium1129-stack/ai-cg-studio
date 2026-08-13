'use strict';

const assert = require('assert');
const { test } = require('node:test');

test("Bundle budget tests passed: lazy route discovery, CSS aggregation, and limit failures", () => {
const {
  DEFAULT_BUDGETS,
  evaluateManifest,
  routeEntries,
} = require('../maintenance/check-bundle-budget.js');

const manifest = {
  'src/main.ts': {
    file: '_app/index.js',
    isEntry: true,
    src: 'src/main.ts',
  },
  'src/views/HomeView.vue': {
    file: '_app/HomeView.js',
    css: ['_app/HomeView.css'],
    isDynamicEntry: true,
    src: 'src/views/HomeView.vue',
  },
  'src/views/ChatView.vue': {
    file: '_app/ChatView.js',
    css: ['_app/shared.css', '_app/ChatView.css'],
    isDynamicEntry: true,
    src: 'src/views/ChatView.vue',
  },
  '_PromptBuilderView.js': {
    file: '_app/PromptBuilderView.js',
    name: 'PromptBuilderView',
    css: ['_app/PromptBuilderView.css'],
    isDynamicEntry: true,
  },
};
const sizes = new Map([
  ['_app/HomeView.js', 40 * 1024],
  ['_app/HomeView.css', 20 * 1024],
  ['_app/ChatView.js', 80 * 1024],
  ['_app/shared.css', 4 * 1024],
  ['_app/ChatView.css', 30 * 1024],
  ['_app/PromptBuilderView.js', 120 * 1024],
  ['_app/PromptBuilderView.css', 50 * 1024],
]);

assert.strictEqual(routeEntries(manifest).length, 3, 'named facade-free view chunks must still belong to route budgets');
const passing = evaluateManifest(manifest, file => sizes.get(file));
assert.deepStrictEqual(passing.violations, []);
assert.strictEqual(passing.routes.find(route => route.route === 'ChatView').css, 34 * 1024);
assert.strictEqual(passing.routes.find(route => route.route === 'PromptBuilderView').javascript, 120 * 1024);

const failing = evaluateManifest(
  manifest,
  file => file === '_app/HomeView.js' ? DEFAULT_BUDGETS.routeJavaScript + 1 : sizes.get(file),
);
assert(failing.violations.some(message => message.includes('HomeView JavaScript')));

});
