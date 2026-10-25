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
