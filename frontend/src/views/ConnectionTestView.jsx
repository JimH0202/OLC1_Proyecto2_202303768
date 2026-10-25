import '../App.css'

export function ConnectionTestView({
  source,
  onSourceChange,
  result,
  loading,
  onTestConnection,
  onRunProgram,
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
          <div className="editor-actions">
            <button type="button" onClick={onTestConnection} disabled={loading}>
              Probar conexión
            </button>
            <button type="button" onClick={onRunProgram} disabled={loading}>
              {loading ? 'Procesando…' : 'Ejecutar programa'}
            </button>
          </div>
        </div>

        <section className="response-panel" aria-live="polite">
          <div className="panel-heading">
            <h2>Respuesta JSON</h2>
            {result && (
              <span className={result.success ? 'status status-ok' : 'status status-error'}>
                {result.execution
                  ? result.success ? 'Ejecución completada' : 'Ejecución fallida'
                  : result.success ? 'Conectado' : 'Error'}
              </span>
            )}
          </div>
          {result ? (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          ) : (
            <p className="empty-state">
              Prueba la conexión o ejecuta el programa para ver la respuesta del backend.
            </p>
          )}
        </section>
      </section>

      {result?.execution && (
        <section className="execution-results" aria-live="polite">
          <div className="execution-heading">
            <h2>Resultado de la ejecución simulada</h2>
            <span className={`status ${result.execution.success ? 'status-ok' : 'status-error'}`}>
              {result.execution.status}
            </span>
          </div>

          {result.execution.errors.length > 0 && (
            <section className="execution-panel" aria-label="Errores de ejecución">
              <h3>Errores</h3>
              <ul>
                {result.execution.errors.map((error, index) => (
                  <li key={`${error.type}-${error.line}-${index}`}>
                    {error.message}
                    {error.line && ` (línea ${error.line}, columna ${error.column})`}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="execution-grid">
            <section className="execution-panel" aria-label="Salida de consola">
              <h3>Salida</h3>
              {result.execution.console.length > 0 ? (
                <pre>{result.execution.console.join('\n')}</pre>
              ) : (
                <p className="execution-empty">El programa no produjo salida en consola.</p>
              )}
            </section>

            <section className="execution-panel" aria-label="Bitácora de acciones">
              <h3>Bitácora</h3>
              {result.execution.log.length > 0 ? (
                <ol>
                  {result.execution.log.map((entry, index) => (
                    <li key={`${entry.action}-${entry.resource}-${index}`}>
                      <code>{entry.action}</code> · {entry.resource}
                      {entry.value !== undefined && ` · ${entry.value}`}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="execution-empty">No se registraron acciones.</p>
              )}
            </section>
          </div>

          <section className="execution-panel infrastructure-panel" aria-label="Infraestructura simulada">
            <h3>Estado simulado</h3>
            <div className="infrastructure-grid">
              {Object.entries(result.execution.infrastructure).map(([kind, resources]) => (
                <section key={kind} aria-label={kind}>
                  <h4>{kind}</h4>
                  {resources.length > 0 ? (
                    <ul>
                      {resources.map((resource) => (
                        <li key={`${resource.kind}-${resource.name}`}>
                          <strong>{resource.name}</strong>
                          <pre>{JSON.stringify(resource.state, null, 2)}</pre>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="execution-empty">Sin recursos.</p>
                  )}
                </section>
              ))}
            </div>
          </section>
          <p className="simulation-note">
            Los cambios son únicamente simulados en memoria; no se contactan servidores ni proveedores cloud.
          </p>
        </section>
      )}
    </main>
  )
}
