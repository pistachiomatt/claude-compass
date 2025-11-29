/**
 * Adds a timeout to a promise
 * @param promise The promise to add a timeout to
 * @param ms Timeout in milliseconds
 * @returns A promise that rejects if the timeout is reached before the original promise resolves
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout])
}
