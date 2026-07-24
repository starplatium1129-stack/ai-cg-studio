(function () {
  'use strict';
  window.__live2dBootstrapErrors = [];
  window.addEventListener('error', function (event) {
    var message = event && (event.message || event.error && event.error.message);
    if (message) window.__live2dBootstrapErrors.push(String(message));
  });
})();
