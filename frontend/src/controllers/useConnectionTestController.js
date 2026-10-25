import { useState } from 'react'
import { ConnectionTestResponse } from '../models/connection-test-response.js'
import { sendConnectionTest } from '../services/api-client.js'

const initialSource = `server web {
    cpu = 2;
    memory = 4;
    disk = 50;
    os = "ubuntu";
}

main {
    start(web);
    print("AutoInfra listo");
}`

export function useConnectionTestController() {
  const [source, setSource] = useState(initialSource)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function testConnection() {
    setLoading(true)
    setResult(null)

    try {
      setResult(await sendConnectionTest(source))
    } catch (error) {
      setResult(ConnectionTestResponse.fromError(error))
    } finally {
      setLoading(false)
    }
  }

  return {
    source,
    setSource,
    result,
    loading,
    testConnection,
  }
}
