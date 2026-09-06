/** Pobranie pliku przez tymczasowy link — jedyna droga bez backendu. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export const downloadText = (text: string, filename: string, type = 'application/json') =>
  downloadBlob(new Blob([text], { type }), filename)
