var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var dir = path.join(__dirname, '..');

console.log('');
console.log('==============================================');
console.log(' AI-CG-Studio Gateway  --  Stop');
console.log('==============================================');
console.log('');

// Kill gateway
var gFile = path.join(dir, '.gateway_pid');
if (fs.existsSync(gFile)) {
    var gpid = fs.readFileSync(gFile, 'utf8').trim();
    if (gpid) {
        try {
            cp.execSync('taskkill /pid ' + gpid + ' /f', {stdio:'pipe'});
            console.log('  Gateway stopped (PID ' + gpid + ')');
        } catch(e) {
            console.log('  Gateway PID ' + gpid + ' not found or already stopped');
        }
    }
    fs.unlinkSync(gFile);
} else {
    console.log('  .gateway_pid not found, skipping');
}

// Kill tunnel
var tFile = path.join(dir, '.tunnel_pid');
if (fs.existsSync(tFile)) {
    var tpid = fs.readFileSync(tFile, 'utf8').trim();
    if (tpid) {
        try {
            cp.execSync('taskkill /pid ' + tpid + ' /f', {stdio:'pipe'});
            console.log('  Tunnel stopped (PID ' + tpid + ')');
        } catch(e) {
            console.log('  Tunnel PID ' + tpid + ' not found or already stopped');
        }
    }
    fs.unlinkSync(tFile);
} else {
    console.log('  .tunnel_pid not found, skipping');
}

console.log('');
console.log('==============================================');
console.log('');
