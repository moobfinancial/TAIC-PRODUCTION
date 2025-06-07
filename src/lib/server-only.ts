// This file helps prevent server-only code from being bundled for the browser

export function serverOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('This code should not run in the browser');
  }
}

// Mark a module as server-only
export function serverRequire<T>(module: string): T {
  if (typeof window !== 'undefined') {
    throw new Error(`Module ${module} should not be required in the browser`);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(module);
}

// Type helper for server-only modules
export type ServerOnly<T> = T & { __serverOnly?: true };
