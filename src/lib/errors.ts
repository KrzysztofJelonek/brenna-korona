/** Krótki opis błędu do komunikatu — z nazwą wyjątku, bo na telefonie to jedyny ślad przyczyny. */
export const describeError = (e: unknown): string =>
  e instanceof Error
    ? e.name && e.name !== 'Error'
      ? `${e.name}: ${e.message}`
      : e.message
    : String(e)
