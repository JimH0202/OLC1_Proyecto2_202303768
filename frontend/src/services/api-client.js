import { ConnectionTestResponse } from '../models/connection-test-response.js'

export async function sendConnectionTest(source) {
  const response = await fetch('/api/connection-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
  const data = await response.json()

  return new ConnectionTestResponse({
    httpStatus: response.status,
    ...data,
  })
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
