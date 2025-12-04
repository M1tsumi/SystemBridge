export type SystemBridgeErrorCode =
  | 'UNSUPPORTED_OPERATION'
  | 'PERMISSION_DENIED'
  | 'OPERATION_FAILED'
  | 'INVALID_ARGUMENT'
  | 'TIMEOUT'
  | 'NOT_INITIALIZED';

export class SystemBridgeError extends Error {
  readonly code: SystemBridgeErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: SystemBridgeErrorCode = 'OPERATION_FAILED', cause?: unknown) {
    super(message);
    this.code = code;
    this.cause = cause;
    this.name = 'SystemBridgeError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code
    };
  }
}

export class UnsupportedOperationError extends SystemBridgeError {
  constructor(message: string) {
    super(message, 'UNSUPPORTED_OPERATION');
    this.name = 'UnsupportedOperationError';
  }
}

export class PermissionDeniedError extends SystemBridgeError {
  constructor(message: string) {
    super(message, 'PERMISSION_DENIED');
    this.name = 'PermissionDeniedError';
  }
}

export class InvalidArgumentError extends SystemBridgeError {
  constructor(message: string) {
    super(message, 'INVALID_ARGUMENT');
    this.name = 'InvalidArgumentError';
  }
}

export class OperationTimeoutError extends SystemBridgeError {
  constructor(message: string) {
    super(message, 'TIMEOUT');
    this.name = 'OperationTimeoutError';
  }
}
