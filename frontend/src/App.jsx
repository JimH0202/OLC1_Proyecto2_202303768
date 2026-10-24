import { useState } from 'react'
import './App.css'

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

function App() {
  const [source, setSource] = useState(initialSource)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  async function testConnection() {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/connection-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
      const data = await response.json()
      setResult({ httpStatus: response.status, ...data })
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'No se pudo contactar el backend.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Prueba de conexión</p>
          <h1>AutoInfra</h1>
          <p className="subtitle">Frontend React conectado a la API Node.js</p>
        </div>
        <span className="api-address">Backend · localhost:8080</span>
      </header>

      <section className="workspace" aria-label="Prueba de comunicación con la API">
        <div className="editor-panel">
          <div className="panel-heading">
            <h2>Código de prueba</h2>
            <span>AutoInfra</span>
          </div>
          <textarea
            aria-label="Código fuente de prueba"
            spellCheck="false"
            value={source}
            onChange={(event) => setSource(event.target.value)}
          />
          <button type="button" onClick={testConnection} disabled={loading}>
            {loading ? 'Enviando…' : 'Enviar código al backend'}
          </button>
        </div>

        <section className="response-panel" aria-live="polite">
          <div className="panel-heading">
            <h2>Respuesta JSON</h2>
            {result && (
              <span className={result.success ? 'status status-ok' : 'status status-error'}>
                {result.success ? 'Conectado' : 'Error'}
              </span>
            )}
          </div>
          {result ? (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          ) : (
            <p className="empty-state">
              Envía el código para verificar la comunicación entre frontend y backend.
            </p>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
