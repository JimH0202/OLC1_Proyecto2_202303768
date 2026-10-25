import { useRef } from 'react'
import '../App.css'

export function WorkspaceView({
  source,
  fileName,
  result,
  loading,
  message,
  onSourceChange,
  onNew,
  onOpen,
  onSave,
  onRunProgram,
}) {
  const fileInput = useRef(null)
  const analysis = result?.analysis
  const execution = result?.execution
  const analysisErrors = analysis?.errors ?? []
  const runtimeErrors = execution?.errors ?? []
  const errors = [...analysisErrors, ...runtimeErrors]

  async function handleFileChange(event) {
    await onOpen(event.target.files?.[0])
    event.target.value = ''
  }

  return (
    <main className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div>
            <p className="eyebrow">Entorno de desarrollo</p>
            <h1>AutoInfra</h1>
            <p className="subtitle">Escribe, analiza y simula infraestructura como código.</p>
          </div>
        </div>
        <span className="api-address"><span className="online-indicator" /> Backend local</span>
      </header>

      <section className="workspace" aria-label="Editor AutoInfra">
        <div className="editor-panel">
          <div className="toolbar" aria-label="Acciones de archivo y ejecución">
            <div className="file-actions">
              <button type="button" className="button-secondary" onClick={onNew}>Nuevo</button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => fileInput.current?.click()}
              >
                Abrir
              </button>
              <button type="button" className="button-secondary" onClick={onSave}>Guardar</button>
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept=".infra,text/plain"
                aria-label="Seleccionar archivo AutoInfra"
                onChange={handleFileChange}
              />
            </div>
            <button
              type="button"
              className="run-button"
              onClick={onRunProgram}
              disabled={loading}
            >
              <span aria-hidden="true">{loading ? '…' : '▶'}</span>
              {loading ? 'Ejecutando' : 'Ejecutar'}
            </button>
          </div>

          <div className="editor-titlebar">
            <span className="file-dot" />
            <span>{fileName}</span>
            <span className="language-label">AUTOINFRA</span>
          </div>

          <div className="code-editor">
            <div className="line-numbers" aria-hidden="true">
              {source.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}
            </div>
            <textarea
              aria-label="Editor de código AutoInfra"
              spellCheck="false"
              autoCapitalize="off"
              autoComplete="off"
              value={source}
              onChange={(event) => onSourceChange(event.target.value)}
            />
          </div>
          <div className="editor-footer">
            <span>AutoInfra · UTF-8</span>
            <span>{source.split('\n').length} líneas</span>
          </div>
          {message && <p className="workspace-message" role="status">{message}</p>}
        </div>
      </section>

      <section className="results-section" aria-label="Resultados del análisis y ejecución">
        <div className="results-heading">
          <div>
            <p className="eyebrow">Inspección del programa</p>
            <h2>Resultados</h2>
          </div>
          {result && (
            <span className={`status ${result.success ? 'status-ok' : 'status-error'}`}>
              {result.success ? 'Sin errores' : 'Revisar resultados'}
            </span>
          )}
        </div>

        <div className="results-grid">
          <section className="result-panel output-panel" aria-label="Panel de salida">
            <div className="result-panel-heading">
              <h3>Salida</h3>
              {execution && <span>{execution.status}</span>}
            </div>
            {execution?.console?.length ? (
              <pre className="console-output">{execution.console.join('\n')}</pre>
            ) : (
              <p className="result-empty">
                {execution ? 'El programa no generó salida.' : 'Ejecuta el programa para ver la salida.'}
              </p>
            )}
            {execution?.log?.length > 0 && (
              <div className="action-log">
                <h4>Bitácora de acciones</h4>
                <ol>
                  {execution.log.map((entry, index) => (
                    <li key={`${entry.action}-${entry.resource}-${index}`}>
                      <code>{entry.action}</code>
                      <span>{entry.resource}</span>
                      {entry.value !== undefined && <span className="log-value">{String(entry.value)}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {execution?.infrastructure && (
              <div className="simulated-state">
                <h4>Estado simulado</h4>
                <div className="resource-list">
                  {Object.entries(execution.infrastructure).flatMap(([kind, resources]) => (
                    resources.map((resource) => (
                      <div className="resource-card" key={`${kind}-${resource.name}`}>
                        <span className="resource-kind">{kind.slice(0, -1)}</span>
                        <strong>{resource.name}</strong>
                        <code>{resource.state.status}</code>
                      </div>
                    ))
                  ))}
                  {Object.values(execution.infrastructure).every((resources) => resources.length === 0)
                    && <p className="result-empty">No hay recursos simulados.</p>}
                </div>
                <p className="simulation-note">
                  Los cambios son simulados en memoria; no se conectan sistemas reales.
                </p>
              </div>
            )}
          </section>

          <section
            className="result-panel errors-panel"
            aria-label="Errores léxicos, sintácticos y de ejecución"
          >
            <div className="result-panel-heading">
              <h3>Errores</h3>
              <span className={errors.length ? 'error-count has-errors' : 'error-count'}>
                {errors.length}
              </span>
            </div>
            {errors.length > 0 ? (
              <ul className="error-list">
                {errors.map((error, index) => (
                  <li key={`${error.type}-${error.line}-${error.column}-${index}`}>
                    <span className="error-type">{error.type}</span>
                    <div>
                      <p>{error.message}</p>
                      {error.line && (
                        <span className="error-location">
                          Línea {error.line}, columna {error.column}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="result-empty">
                {result ? 'No se encontraron errores.' : 'Los errores aparecerán aquí después del análisis.'}
              </p>
            )}
          </section>

          <section className="result-panel tokens-panel" aria-label="Tokens del programa">
            <div className="result-panel-heading">
              <h3>Tokens</h3>
              <span>{analysis ? analysis.tokens.length : '—'}</span>
            </div>
            {analysis?.tokens?.length > 0 ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr><th>Tipo</th><th>Lexema</th><th>Ubicación</th></tr>
                  </thead>
                  <tbody>
                    {analysis.tokens.map((token, index) => (
                      <tr key={`${token.line}-${token.column}-${index}`}>
                        <td><code>{token.type}</code></td>
                        <td><code>{token.lexeme || 'EOF'}</code></td>
                        <td>{token.line}:{token.column}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="result-empty">
                {analysis ? 'No hay tokens reconocidos.' : 'Los tokens aparecerán aquí después del análisis.'}
              </p>
            )}
          </section>

          <section className="result-panel ast-panel" aria-label="Árbol de sintaxis abstracta">
            <div className="result-panel-heading">
              <h3>Árbol de sintaxis (AST)</h3>
              {analysis?.ast && <span>JSON</span>}
            </div>
            {analysis?.ast ? (
              <pre className="ast-output">{JSON.stringify(analysis.ast, null, 2)}</pre>
            ) : (
              <p className="result-empty">
                {analysis ? 'No se pudo construir el AST por errores de análisis.' : 'El AST aparecerá aquí después del análisis.'}
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
