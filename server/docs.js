'use strict';
const redirects = require('../docs/redirects.json');

/** Keep previously shared manual URLs usable after documentation moves. */
function redirectLegacyDocs(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const key = '/docs' + req.path;
  if (!Object.hasOwn(redirects, key)) return next();
  const queryAt = req.url.indexOf('?');
  const query = queryAt < 0 ? '' : req.url.slice(queryAt);
  return res.redirect(308, redirects[key] + query);
}
module.exports = { redirectLegacyDocs };
