'use strict';
function createServiceWatchdog(options) {
    const intervalMs = Math.max(50, Number(options.intervalMs) || 5000);
    const maxBackoffMs = Math.max(intervalMs, Number(options.maxBackoffMs) || 30000);
    const services = Array.isArray(options.services) ? options.services : [];
    const entries = new Map();
    let timer = null;
    let running = false;
    let checking = false;
    function entry(service) {
        let current = entries.get(service.name);
        if (!current) {
            current = {
                healthy: false,
                wasHealthy: false,
                managed: false,
                restarting: false,
                attempt: 0,
                lastError: '',
                lastRestartAt: 0,
                timer: null
            };
            entries.set(service.name, current);
        }
        return current;
    }
    function clearRestartTimer(current) {
        if (current.timer) {
            clearTimeout(current.timer);
            current.timer = null;
        }
        current.restarting = false;
    }
    function scheduleRestart(service, current) {
        if (!running || current.restarting)
            return;
        const delay = Math.min(maxBackoffMs, intervalMs * Math.pow(2, current.attempt));
        current.restarting = true;
        current.timer = setTimeout(function () {
            current.timer = null;
            void (async function () {
                if (!running)
                    return;
                let result;
                try {
                    result = await service.restart();
                }
                catch (error) {
                    result = { ok: false, error: error instanceof Error ? error.message : String(error) };
                }
                current.restarting = false;
                if (result && result.ok) {
                    current.attempt = 0;
                    current.lastError = '';
                    current.lastRestartAt = Date.now();
                    if (options.onEvent)
                        options.onEvent({ service: service.name, kind: 'restarted' });
                }
                else {
                    current.attempt += 1;
                    current.lastError = (result && result.error) || '重启失败';
                    if (options.onEvent) {
                        options.onEvent({
                            service: service.name,
                            kind: 'restart-failed',
                            attempt: current.attempt,
                            error: current.lastError
                        });
                    }
                    scheduleRestart(service, current);
                }
            })();
        }, delay);
        if (typeof current.timer.unref === 'function')
            current.timer.unref();
    }
    async function check() {
        if (checking || !running)
            return;
        checking = true;
        try {
            for (const service of services) {
                const current = entry(service);
                let healthy = false;
                try {
                    healthy = await service.probe();
                }
                catch {
                    healthy = false;
                }
                current.healthy = healthy;
                current.managed = service.shouldManage();
                if (!current.managed) {
                    current.wasHealthy = healthy;
                    clearRestartTimer(current);
                    continue;
                }
                if (healthy) {
                    if (!current.wasHealthy && current.attempt > 0 && options.onEvent) {
                        options.onEvent({ service: service.name, kind: 'restarted' });
                    }
                    current.wasHealthy = true;
                    current.attempt = 0;
                    current.lastError = '';
                    clearRestartTimer(current);
                    continue;
                }
                // 曾经健康 → 现在掉线：触发自愈；从未健康则不动（等待手动启动）。
                if (current.wasHealthy && !current.restarting) {
                    if (options.onEvent)
                        options.onEvent({ service: service.name, kind: 'down' });
                    scheduleRestart(service, current);
                }
            }
        }
        finally {
            checking = false;
        }
    }
    function start() {
        if (running)
            return;
        running = true;
        timer = setInterval(function () { void check(); }, intervalMs);
        if (typeof timer.unref === 'function')
            timer.unref();
        void check();
    }
    function stop() {
        running = false;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        for (const current of entries.values())
            clearRestartTimer(current);
    }
    function status() {
        const servicesView = {};
        for (const service of services) {
            const current = entry(service);
            servicesView[service.name] = {
                healthy: current.healthy,
                managed: current.managed,
                restarting: current.restarting,
                attempt: current.attempt,
                lastError: current.lastError,
                lastRestartAt: current.lastRestartAt
            };
        }
        return { running: running, services: servicesView };
    }
    return { start: start, stop: stop, check: check, status: status };
}
module.exports = { createServiceWatchdog: createServiceWatchdog };
