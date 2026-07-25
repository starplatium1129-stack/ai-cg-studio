export type ControlOperationStatus = 'running' | 'completed' | 'failed';

export interface ControlOperation {
  id: string;
  kind: string;
  label: string;
  status: ControlOperationStatus;
  stageIndex: number;
  stages: string[];
  message: string;
  startedAt: number;
  finishedAt: number;
  error: string;
}

export interface ControlState {
  operation: ControlOperation | null;
  [key: string]: unknown;
}

export interface ConflictResponse {
  status(code: number): ConflictResponse;
  json(body: {
    ok: false;
    error: string;
    operation: ControlOperation;
  }): unknown;
}

export interface OperationManager {
  begin(kind: string, label: string, stages?: string[]): ControlOperation | null;
  update(operation: ControlOperation, stageIndex: number, message?: string): boolean;
  finish(operation: ControlOperation, error?: unknown, message?: string): boolean;
  rejectConflict(res: ConflictResponse): boolean;
}

export type CreateOperationManager = (state: ControlState) => OperationManager;
