var cp = require('child_process');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var dir = path.join(__dirname, '..');
var token = crypto.randomBytes(8).toString('hex');
var cf = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
var pidDir = dir;

console.log('');
console.log('==============================================');
console.log(' AI-CG-Studio Gateway  --  One Click Start');
console.log('==============================================');
console.log('');

// 1. Check SD WebUI
console.log('[1/4] Checking SD WebUI...');
try {
    cp.execSync('curl -s -o nul -w "%{http_code}" http://127.0.0.1:7860/sdapi/v1/sd-models', {stdio:'pipe'});
    console.log('      SD WebUI is online [OK]');
} catch(e) {
    console.log('      SD WebUI not detected - make sure ReForge is running with --api');
}
console.log('');

// 2. Start gateway server
console.log('[2/4] Starting gateway on port 3000...');
var server = cp.spawn('node', ['server.js'], {
    cwd: dir,
    env: Object.assign({}, process.env, {TOKEN: token, PORT: '3000', SD_HOST: 'http://127.0.0.1:7860'}),
    stdio: 'ignore',
    detached: true
});
server.unref();

// Save token and server PID (AFTER spawn)
fs.writeFileSync(path.join(pidDir, '.gateway_token'), token);
fs.writeFileSync(path.join(pidDir, '.gateway_pid'), String(server.pid));

console.log('      Token : ' + token);
console.log('      Local : http://localhost:3000/?token=' + token);
console.log('');

// 3. Start tunnel (after 2s delay for server to bind port)
setTimeout(function() {
    console.log('[3/4] Starting Cloudflare Tunnel...');
    var tunnelLog = path.join(pidDir, 'tunnel.log');
    var logFd = fs.openSync(tunnelLog, 'w');
    var tunnel = cp.spawn(cf, ['tunnel', '--url', 'http://localhost:3000'], {
        stdio: ['ignore', logFd, logFd],
        detached: true
    });
    tunnel.unref();
    fs.closeSync(logFd);

    // Save tunnel PID (AFTER spawn)
    fs.writeFileSync(path.join(pidDir, '.tunnel_pid'), String(tunnel.pid));

    console.log('      Waiting for tunnel domain (~12s)...');

    // 4. Wait for tunnel to produce URL, then show it
    setTimeout(function() {
        var domain = '';
        try {
            var log = fs.readFileSync(tunnelLog, 'utf8');
            var m = log.match(/https:\/\/\S+trycloudflare\.com/);
            if (m) domain = m[0];
        } catch(e) {}

        console.log('');
        console.log('[4/4] Done!');
        console.log('');
        console.log('==============================================');
        if (domain) {
            console.log(' Share link:');
            console.log('');
            console.log('   ' + domain + '?token=' + token);
            console.log('');
        } else {
            console.log(' (Tunnel URL not ready - run show-url.bat)');
        }
        console.log(' To stop: run stop.bat');
        console.log('==============================================');
        console.log('');
        process.exit(0);
    }, 12000);
}, 2000);
