import { useRef, useState } from 'react'
import '../App.css'

function AstTreeNode({ label, value, depth = 0, expanded }) {
  if (Array.isArray(value)) {
    return (
      <li className="ast-tree-item">
        <details open={expanded}>
          <summary>
            <span className="ast-field-name">{label}</span>
            <span className="ast-node-count">{value.length} elemento(s)</span>
          </summary>
          <ul className="ast-tree-children">
            {value.map((item, index) => (
              <AstTreeNode
                key={`${label}-${index}`}
                label={`[${index}]`}
                value={item}
                depth={depth + 1}
                expanded={expanded}
              />
            ))}
          </ul>
        </details>
      </li>
    )
  }

  if (value !== null && typeof value === 'object') {
    const childEntries = getAstTreeEntries(value)
    const hasChildren = childEntries.length > 0

    return (
      <li className="ast-tree-item">
        <details open={expanded}>
          <summary>
            {value.type
              ? <span className="ast-node-type">{getAstNodeTitle(value)}</span>
              : <span className="ast-field-name">{label}</span>}
            {value.type && label !== 'root' && (
              <span className="ast-field-name">{label}</span>
            )}
            {Number.isInteger(value.line) && Number.isInteger(value.column) && (
              <span className="ast-node-location">{value.line}:{value.column}</span>
            )}
          </summary>
          {hasChildren ? (
            <ul className="ast-tree-children">
              {childEntries.map(([key, child]) => (
                <AstTreeNode
                  key={key}
                  label={key}
                  value={child}
                  depth={depth + 1}
                  expanded={expanded}
                />
              ))}
            </ul>
          ) : (
            null
          )}
        </details>
      </li>
    )
  }

  return (
    <li className="ast-tree-value">
      <span className="ast-field-name">{label}</span>
      <code>{typeof value === 'string' ? value : JSON.stringify(value)}</code>
    </li>
  )
}

function getAstTreeEntries(node) {
  if (node.type === 'VariableDeclaration') {
    return [
      ['Type', node.dataType.name],
      ['Name', node.name],
      ...(node.initializer ? [['Value', node.initializer]] : []),
    ]
  }

  if (node.type === 'BinaryExpression') {
    return [
      ['Left', node.left],
      ['Right', node.right],
    ]
  }

  if (node.type === 'Identifier' || node.type === 'Literal') {
    return []
  }

  return Object.entries(node)
    .filter(([key]) => key !== 'type' && key !== 'line' && key !== 'column')
}

function getAstNodeTitle(node) {
  if (node.type === 'BinaryExpression') {
    return `Binary(${node.operator})`
  }
  if (node.type === 'Identifier') {
    return `Identifier(${node.name})`
  }
  if (node.type === 'Literal') {
    return `Literal(${JSON.stringify(node.value)})`
  }
  return node.type
}

function formatActionEntry(entry) {
  switch (entry.action) {
    case 'register':
      return `[OK] Resource '${entry.resource}' registered`
    case 'start':
      return `[OK] ${entry.resource} -> running`
    case 'stop':
      return `[OK] ${entry.resource} -> stopped`
    case 'restart':
      return `[OK] ${entry.resource} restarted`
    case 'install':
      return `[OK] ${entry.value} installed on ${entry.resource}`
    case 'uninstall':
      return `[OK] ${entry.value} removed from ${entry.resource}`
    case 'deploy':
      return `[OK] ${entry.resource} deployed on ${entry.value}`
    case 'connect':
      return `[OK] ${entry.resource} connected to ${entry.value}`
    case 'disconnect':
      return `[OK] ${entry.resource} disconnected from ${entry.value}`
    case 'scale':
      return entry.previousValue === undefined
        ? `[OK] ${entry.resource} scaled to ${entry.value} replicas`
        : `[OK] ${entry.resource} scaled from ${entry.previousValue} to ${entry.value} replicas`
    default:
      return `[OK] ${entry.action} ${entry.resource}`
  }
}

export function WorkspaceView({
  source,
  fileName,
  result,
  loading,
  connectionChecking,
  connectionStatus,
  message,
  onSourceChange,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onClearExecution,
  onValidateConnection,
  onRunProgram,
}) {
  const fileInput = useRef(null)
  const lineNumbersRef = useRef(null)
  const [astView, setAstView] = useState('tree')
  const [astExpanded, setAstExpanded] = useState(false)
  const analysis = result?.analysis
  const execution = result?.execution
  const analysisErrors = analysis?.errors ?? []
  const runtimeErrors = execution?.errors ?? []
  const errors = [...analysisErrors, ...runtimeErrors]

  async function handleFileChange(event) {
    await onOpen(event.target.files?.[0])
    event.target.value = ''
  }

  function handleEditorScroll(event) {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop
    }
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
        <span className={`api-address connection-${connectionStatus}`}>
          <span className="online-indicator" />
          {connectionStatus === 'connected'
            ? 'Backend conectado'
            : connectionStatus === 'disconnected'
              ? 'Backend sin conexión'
              : connectionStatus === 'checking' ? 'Validando backend' : 'Backend local'}
        </span>
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
              <button type="button" className="button-secondary" onClick={onSaveAs}>Guardar como</button>
              <input
                ref={fileInput}
                className="visually-hidden"
                type="file"
                accept=".infra"
                aria-label="Seleccionar archivo AutoInfra"
                onChange={handleFileChange}
              />
            </div>
            <div className="primary-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={onClearExecution}
                disabled={!result}
              >
                Limpiar ejecución
              </button>
              <button
                type="button"
                className="button-secondary connection-button"
                onClick={onValidateConnection}
                disabled={connectionChecking}
              >
                {connectionChecking ? 'Validando…' : 'Validar conexión'}
              </button>
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
          </div>

          <div className="editor-titlebar">
            <span className="file-dot" />
            <span>{fileName}</span>
            <span className="language-label">AUTOINFRA</span>
          </div>

          <div className="code-editor">
            <div ref={lineNumbersRef} className="line-numbers" aria-hidden="true">
              {source.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}
            </div>
            <textarea
              aria-label="Editor de código AutoInfra"
              spellCheck="false"
              autoCapitalize="off"
              autoComplete="off"
              value={source}
              onScroll={handleEditorScroll}
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
            <div className="result-statuses" aria-live="polite">
              {result.analysis && (
                <span className={`status ${result.analysis.success ? 'status-ok' : 'status-error'}`}>
                  {result.analysis.success ? 'Análisis exitoso' : 'Análisis con errores'}
                </span>
              )}
              {execution && (
                <span className={`status ${execution.success ? 'status-ok' : 'status-error'}`}>
                  {execution.status === 'not_run'
                    ? 'Ejecución no iniciada'
                    : execution.success ? 'Ejecución exitosa' : 'Ejecución con errores'}
                </span>
              )}
            </div>
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
            {execution && (
              <div className="action-log">
                <h4>Bitácora de acciones</h4>
                {execution.log.length > 0 ? (
                  <ol>
                    {execution.log.map((entry, index) => (
                      <li key={`${entry.action}-${entry.resource}-${index}`}>
                        <code>{formatActionEntry(entry)}</code>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="result-empty">No se registraron acciones.</p>
                )}
              </div>
            )}
            {execution && (
              <div className="simulated-state">
                <h4>Estado final de los recursos</h4>
                <div className="resource-list">
                  {Object.entries(execution.infrastructure).flatMap(([kind, resources]) => (
                    resources.map((resource) => (
                      <div className="resource-card" key={`${kind}-${resource.name}`}>
                        <span className="resource-kind">{resource.kind}</span>
                        <strong>{resource.name}</strong>
                        <div className="resource-details">
                          <span>Propiedades</span>
                          <pre>{JSON.stringify(resource.properties, null, 2)}</pre>
                          <span>Estado</span>
                          <pre>{JSON.stringify(resource.state, null, 2)}</pre>
                        </div>
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
            aria-label="Errores léxicos, sintácticos, de infraestructura y de ejecución"
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
                    <dl className="error-details">
                      <div>
                        <dt>Tipo</dt>
                        <dd><span className="error-type">{error.type ?? 'desconocido'}</span></dd>
                      </div>
                      <div>
                        <dt>Código</dt>
                        <dd>{error.code ?? '—'}</dd>
                      </div>
                      <div className="error-description">
                        <dt>Descripción</dt>
                        <dd>{error.message}</dd>
                      </div>
                      <div>
                        <dt>Línea</dt>
                        <dd>{error.line ?? 'No disponible'}</dd>
                      </div>
                      <div>
                        <dt>Columna</dt>
                        <dd>{error.column ?? 'No disponible'}</dd>
                      </div>
                    </dl>
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

          <section className="result-panel symbols-panel" aria-label="Tabla de símbolos">
            <div className="result-panel-heading">
              <h3>Tabla de símbolos</h3>
              <span>{execution?.symbols?.length ?? '—'}</span>
            </div>
            {execution?.symbols?.length > 0 ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Identificador</th>
                      <th>Categoría</th>
                      <th>Tipo</th>
                      <th>Ámbito</th>
                      <th>Valor / estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execution.symbols.map((symbol, index) => (
                      <tr key={`${symbol.scope}-${symbol.identifier}-${index}`}>
                        <td><code>{symbol.identifier}</code></td>
                        <td>{symbol.category}</td>
                        <td>{symbol.type ?? '—'}</td>
                        <td>{symbol.scope}</td>
                        <td>
                          <code>
                            {symbol.value === undefined ? '' : JSON.stringify(symbol.value)}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="result-empty">
                {execution ? 'No se registraron símbolos durante la ejecución.' : 'La tabla se mostrará después de ejecutar.'}
              </p>
            )}
          </section>

          <section className="result-panel ast-panel" aria-label="Árbol de sintaxis abstracta">
            <div className="result-panel-heading">
              <div className="ast-heading-title">
                <h3>Árbol de sintaxis (AST)</h3>
                {analysis?.ast && astView === 'tree' && (
                  <button
                    type="button"
                    className="ast-expand-toggle"
                    onClick={() => setAstExpanded(!astExpanded)}
                  >
                    {astExpanded ? 'Contraer todo' : 'Expandir todo'}
                  </button>
                )}
              </div>
              {analysis?.ast && (
                <div className="ast-view-switch" aria-label="Vista del AST">
                  <button
                    type="button"
                    className={astView === 'tree' ? 'active' : ''}
                    aria-pressed={astView === 'tree'}
                    onClick={() => setAstView('tree')}
                  >
                    Árbol
                  </button>
                  <button
                    type="button"
                    className={astView === 'json' ? 'active' : ''}
                    aria-pressed={astView === 'json'}
                    onClick={() => setAstView('json')}
                  >
                    JSON
                  </button>
                </div>
              )}
            </div>
            {analysis?.ast ? (
              astView === 'tree' ? (
                <ul className="ast-tree" aria-label="Estructura gráfica del AST">
                  <AstTreeNode label="root" value={analysis.ast} expanded={astExpanded} />
                </ul>
              ) : (
                <pre className="ast-output">{JSON.stringify(analysis.ast, null, 2)}</pre>
              )
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
