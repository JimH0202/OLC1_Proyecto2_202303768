export async function checkBackendHealth() {
  const response = await fetch('/api/health')
  const data = await response.json()

  if (!response.ok || data.status !== 'ok') {
    throw new Error(data.message ?? `El backend respondió con HTTP ${response.status}.`)
  }

  return data
}

export async function executeProgram(source) {
  const response = await fetch('/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
  const data = await response.json()

  return {
    httpStatus: response.status,
    ...data,
  }
}
