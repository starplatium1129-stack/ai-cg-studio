var fs = require('fs');
var path = require('path');

var dir = path.join(__dirname, '..');
var tokenFile = path.join(dir, '.gateway_token');
var logFile = path.join(dir, 'tunnel.log');

var token = '';
try { token = fs.readFileSync(tokenFile, 'utf8').replace(/[\r\n\s]/g, ''); } catch(e) {}

var domain = '';
try {
    var log = fs.readFileSync(logFile, 'utf8');
    var m = log.match(/https:\/\/\S+trycloudflare\.com/);
    if (m) domain = m[0];
} catch(e) {}

if (!token) {
    console.log('ERROR: Token not found. Run start.bat first.');
    process.exit(1);
}
if (!domain) {
    console.log('ERROR: Tunnel URL not found. Run start.bat first.');
    process.exit(1);
}

console.log(domain + '?token=' + token);
