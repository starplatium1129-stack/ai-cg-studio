interface ControlOperation {
    id: string;
    kind: string;
    label: string;
    status: 'running' | 'completed' | 'failed';
    stageIndex: number;
    stages: string[];
    message: string;
    startedAt: number;
    finishedAt: number;
    error: string;
}
interface ControlState {
    operation: ControlOperation | null;
    [key: string]: unknown;
}
interface ConflictResponse {
    status(code: number): ConflictResponse;
    json(body: {
        ok: false;
        error: string;
        operation: ControlOperation;
    }): unknown;
}
declare function createOperationManager(state: ControlState): {
    begin: (kind: string, label: string, stages?: string[]) => ControlOperation | null;
    update: (operation: ControlOperation, stageIndex: number, message?: string) => boolean;
    finish: (operation: ControlOperation, error?: unknown, message?: string) => boolean;
    rejectConflict: (res: ConflictResponse) => boolean;
};
declare const _default: {
    createOperationManager: typeof createOperationManager;
};
export = _default;
