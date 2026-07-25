'use strict';
function createOperationManager(state) {
    if (!state || typeof state !== 'object')
        throw new TypeError('control state is required');
    let sequence = 0;
    function begin(kind, label, stages) {
        if (state.operation && state.operation.status === 'running')
            return null;
        state.operation = {
            id: String(Date.now()) + '-' + (++sequence),
            kind: kind,
            label: label,
            status: 'running',
            stageIndex: 0,
            stages: Array.isArray(stages) ? stages.slice() : [],
            message: Array.isArray(stages) && stages.length ? stages[0] : label,
            startedAt: Date.now(),
            finishedAt: 0,
            error: ''
        };
        return state.operation;
    }
    function update(operation, stageIndex, message) {
        if (!operation || !state.operation || state.operation.id !== operation.id)
            return false;
        operation.stageIndex = Math.max(0, Number(stageIndex) || 0);
        operation.message = message || operation.stages[operation.stageIndex] || operation.label;
        return true;
    }
    function finish(operation, error, message) {
        if (!operation || !state.operation || state.operation.id !== operation.id)
            return false;
        operation.status = error ? 'failed' : 'completed';
        operation.error = error ? String(error) : '';
        operation.message = message || (error ? '操作失败' : '操作完成');
        operation.finishedAt = Date.now();
        return true;
    }
    function rejectConflict(res) {
        if (!state.operation || state.operation.status !== 'running')
            return false;
        res.status(409).json({
            ok: false,
            error: '“' + state.operation.label + '”仍在进行，请等待当前操作完成',
            operation: state.operation
        });
        return true;
    }
    return { begin: begin, update: update, finish: finish, rejectConflict: rejectConflict };
}
module.exports = { createOperationManager: createOperationManager };
