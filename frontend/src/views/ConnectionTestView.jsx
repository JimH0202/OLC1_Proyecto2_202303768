import '../App.css'

export function ConnectionTestView({
  source,
  onSourceChange,
  result,
  loading,
  onTestConnection,
}) {
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
            onChange={(event) => onSourceChange(event.target.value)}
          />
          <button type="button" onClick={onTestConnection} disabled={loading}>
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
