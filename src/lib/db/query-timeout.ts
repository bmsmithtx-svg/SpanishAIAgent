const DEFAULT_DATABASE_QUERY_TIMEOUT_MS = 2500;

export function getDatabaseQueryTimeoutMs() {
  const parsed = Number.parseInt(process.env.DATABASE_QUERY_TIMEOUT_MS ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DATABASE_QUERY_TIMEOUT_MS;
  }

  return Math.floor(parsed);
}

export async function withDatabaseQueryTimeout<T>(
  operation: () => Promise<T>,
  fallback: T,
  timeoutMs = getDatabaseQueryTimeoutMs()
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const operationPromise = Promise.resolve().then(operation);
  operationPromise.catch(() => undefined);

  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => resolve(fallback), timeoutMs);
  });

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } catch {
    return fallback;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
