# Manual técnico de AutoInfra

## 1. Propósito y alcance

Este manual describe la arquitectura, las dependencias y los componentes principales
para desarrollar y mantener AutoInfra. El sistema es una aplicación web cliente-
servidor que analiza archivos `.infra` e interpreta su AST para simular operaciones
de infraestructura.

El análisis implementado es léxico y sintáctico. El alcance acordado excluye un
analizador semántico estático. Durante la interpretación sí se informan errores de
ejecución necesarios para operaciones inválidas, y el despliegue verifica las
dependencias `dependsOn`.

## 2. Lenguajes, herramientas y librerías

| Componente | Tecnología |
| --- | --- |
| Lenguaje del backend | JavaScript, módulos ES |
| Runtime del backend | Node.js 20.19 o superior |
| API HTTP | Express 5 |
| CORS | `cors` |
| Lenguaje del frontend | JavaScript con JSX |
| UI | React 19 y React DOM |
| Servidor de desarrollo y empaquetado | Vite 8 |
| Linter del frontend | Oxlint |
| Pruebas del backend | `node:test` y `node:assert/strict` |
| Lexer y parser | Implementación manual propia; no requiere generador externo |
| AST e intérprete | Nodos JavaScript propios e interpretación directa del AST |

El programa AutoInfra no se traduce a JavaScript para ejecutar con `eval()`,
`Function()` ni `vm`. El frontend no tokeniza ni analiza el lenguaje; envía el código
al backend.

## 3. Estructura del repositorio

```text
backend/
  src/
    api/
      routes.js                 Rutas HTTP
      server.js                 Inicio del servidor
    controllers/
      api-controller.js         Validación de solicitudes y respuestas JSON
    services/
      analysis-service.js       Flujo lexer → parser → intérprete
    lexer/
      lexer.js                  Escáner de tokens
      source-cursor.js          Lectura de caracteres y posiciones
      token.js                  Modelo serializable de token
      token-types.js            Tokens, operadores y palabras reservadas
    parser/
      parser.js                 Parser descendente recursivo y AST
    ast/
      nodes.js                  Catálogo y creación de nodos
    environment/
      environment.js            Variables, ámbitos, recursos y símbolos
    infrastructure/
      resource.js               Modelo de recurso y serialización
    interpreter/
      interpreter.js            Evaluador del AST y acciones simuladas
    models/
      analysis-result.js        Resultado serializable del análisis
    app.js                      Express, CORS, JSON y manejo HTTP de errores
frontend/
  src/
    controllers/
      useWorkspaceController.js Estado y acciones del espacio de trabajo
    services/
      api-client.js             Cliente HTTP hacia /api
    views/
      WorkspaceView.jsx         Editor y reportes
    App.jsx                     Composición principal de la vista
    App.css                     Estilos de la interfaz
    index.css                   Estilos globales
  vite.config.js                Puerto y proxy /api
docs/
  MANUAL_USUARIO.md
  MANUAL_TECNICO.md
  GRAMATICA_AUTOINFRA.md
  CONTRATO_API.md
  capturas/                     Imágenes usadas por el manual de usuario
examples/                       Ejemplos AutoInfra
```

## 4. Inicio, validación y pruebas

Instala dependencias en cada aplicación una vez:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

Inicia cada servidor en una terminal independiente:

```powershell
cd backend
npm run dev
```

```powershell
cd frontend
npm run dev
```

Direcciones locales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`

El servidor backend también se inicia con `npm start`. El servidor Vite fija el
puerto 5173 y usa `strictPort`; no elige silenciosamente otro puerto. El backend
acepta el puerto `8080` por defecto y puede configurarse con la variable `PORT`.

Comandos de calidad:

```powershell
cd backend
npm test

cd ..\frontend
npm run lint
npm run build
```

## 5. Flujo de una solicitud

### Análisis

1. El frontend captura el contenido del editor.
2. `api-client.js` envía `POST /api/analyze` o `POST /api/execute` como JSON.
3. Express entrega la solicitud a `apiRouter`.
4. `api-controller.js` valida que `source` sea una cadena.
5. `analysis-service.js` ejecuta el lexer y, si no hay errores léxicos, el parser.
6. El parser produce el AST serializable.
7. Para `/api/execute`, el servicio pasa el AST al intérprete.
8. El controlador responde con un único documento JSON. La vista actualiza sus
   paneles de resultados.

### Interpretación

Antes de ejecutar `main`, el intérprete registra funciones, tareas y recursos, y
evalúa declaraciones globales. Después ejecuta las sentencias de `main` en orden.
Las funciones y tareas crean ámbitos locales enlazados al entorno global; el registro
de recursos simulado se comparte entre ámbitos.

El intérprete evalúa los nodos del AST directamente. Los nodos de control de flujo
`return`, `break` y `continue` se propagan mediante señales internas. Los operadores
`&&` y `||` utilizan cortocircuito. El estado de infraestructura sólo existe en
memoria.

## 6. Componentes principales

### Lexer

Archivos: [lexer.js](../backend/src/lexer/lexer.js),
[source-cursor.js](../backend/src/lexer/source-cursor.js),
[token.js](../backend/src/lexer/token.js) y
[token-types.js](../backend/src/lexer/token-types.js).

- `Lexer(source)` crea el escáner con un cursor, una lista de tokens y una lista de
  errores.
- `scan()` recorre la fuente, ignora whitespace/comentarios, emite tokens y añade el
  token sintético `EOF`.
- `scanToken()` decide entre identificador, número, cadena, operador o puntuación.
- `scanIdentifier()` identifica palabras reservadas exactas; las demás palabras son
  `IDENTIFIER`.
- `scanNumber()` reconoce enteros y decimales.
- `scanString()` delega escapes y posiciones al cursor.
- `SourceCursor.advance()` devuelve la ubicación original del carácter y actualiza
  línea/columna, incluyendo CRLF.
- `SourceCursor.skipComment()` omite comentarios de línea y multilínea.
- `SourceCursor.readStringLiteral()` valida y decodifica `\"`, `\\`, `\n` y `\t`.

Los tokens incluyen `type`, `lexeme`, `line` y `column`. Los errores léxicos se
serializan con esos datos de ubicación y `lexeme`.

### Parser y AST

Archivos: [parser.js](../backend/src/parser/parser.js) y
[nodes.js](../backend/src/ast/nodes.js).

`Parser(tokens)` recibe tokens terminados en `EOF`. `parse()` encapsula el resultado
como `{ ast, errors }`; ante un error sintáctico devuelve el primer error localizado
y un AST nulo.

El parser implementa descenso recursivo. `parseProgram()` exige declaraciones antes
de un único `main` final; los métodos `parseDeclaration()`, `parseStatement()` y
`parseBlock()` construyen declaraciones y sentencias. Las funciones `parseLogicalOr`,
`parseLogicalAnd`, `parseEquality`, `parseComparison`, `parseTerm`,
`parseFactor`, `parseUnary` y `parsePostfix` implementan la precedencia. `parsePrimary`
reconoce literales, identificadores, agrupación y arreglos. Los sufijos de postfix
permiten llamadas, propiedades e índices encadenados.

`createAstNode(type, token, properties)` verifica el tipo de nodo y la ubicación de
origen. Cada nodo conserva `line` y `column`. El catálogo `AST_NODE_TYPES` define las
construcciones permitidas, incluidas expresiones, declaraciones, bloques, ciclos,
condicionales, retornos y señales de control.

### Entorno y recursos

Archivos: [environment.js](../backend/src/environment/environment.js) y
[resource.js](../backend/src/infrastructure/resource.js).

- `Environment.createChild(scopeName)` crea un ámbito hijo compartiendo el estado
  simulado.
- `defineVariable()`, `getVariable()` y `assignVariable()` administran variables y
  resuelven valores por la cadena de ámbitos.
- `defineResource()` y `getResource()` registran y localizan recursos.
- `listResources()` y `listSymbols()` preparan estructuras serializables para la API.
- `InfrastructureResource` representa `server`, `service` o `database`, conserva
  propiedades de configuración y estado mutable simulado.
- `toJSON()` devuelve copias serializables sin exponer las estructuras internas.

### Intérprete

Archivo: [interpreter.js](../backend/src/interpreter/interpreter.js).

- `Interpreter.interpret(program)` valida el nodo raíz `Program`, registra
  declaraciones, ejecuta inicialización global y `main`, y devuelve consola,
  bitácora, errores, recursos y símbolos.
- `registerCallableDeclarations()` registra funciones y tareas.
- `registerResources()` registra todos los recursos; `initializeResource()` evalúa
  sus propiedades.
- `executeStatement()` despacha sentencias por su tipo de AST.
- `executeBlock()` crea ámbito de bloque; `executeFor()` y `executeWhile()` controlan
  ciclos y señales `break`/`continue`.
- `executeRun()` ejecuta el cuerpo de una tarea sin parámetros.
- `evaluateExpression()` despacha la evaluación de literales, identificadores,
  arreglos, expresiones unarias/binarias, propiedades, índices y llamadas.
- `evaluateBinary()` aplica operadores y cortocircuito; división por cero genera un
  error de ejecución localizado.
- `evaluateCall()` invoca funciones del usuario o funciones nativas.
- `evaluateNativeCall()` simula `start`, `stop`, `restart`, `install`, `uninstall`,
  `deploy`, `scale`, `connect`, `disconnect`, `print`, `length` y `status`.
- `recordNativeAction()` añade eventos a la bitácora del resultado.

El intérprete no traduce la fuente a JavaScript. Las acciones nativas sólo alteran
estructuras en memoria. El despliegue comprueba que las dependencias declaradas
mediante `dependsOn` estén activas; si no, informa `INFRA-004` antes de modificar el
servicio.

### API y modelos

Archivos: [app.js](../backend/src/app.js),
[routes.js](../backend/src/api/routes.js),
[server.js](../backend/src/api/server.js),
[api-controller.js](../backend/src/controllers/api-controller.js),
[analysis-service.js](../backend/src/services/analysis-service.js) y
[analysis-result.js](../backend/src/models/analysis-result.js).

- `app.js` configura Express, JSON, CORS y el manejador de errores HTTP.
- `routes.js` conecta `GET /health`, `POST /connection-test`, `POST /analyze` y
  `POST /execute` bajo el prefijo `/api`.
- `server.js` escucha en el puerto `PORT` o `8080`.
- `getHealth()`, `testConnection()`, `analyze()` y `execute()` responden a las rutas
  y validan el cuerpo JSON.
- `analyzeSource(source)` devuelve tokens, errores y AST.
- `executeSource(source)` evita ejecutar si el análisis falla; si pasa, devuelve
  resultados de ejecución e infraestructura agrupada.
- `AnalysisResult.toJSON()` serializa `success`, `tokens`, `errors` y `ast`.

La definición detallada de solicitud y respuesta está en
[CONTRATO_API.md](./CONTRATO_API.md).

### Frontend

Archivos: [App.jsx](../frontend/src/App.jsx),
[WorkspaceView.jsx](../frontend/src/views/WorkspaceView.jsx),
[useWorkspaceController.js](../frontend/src/controllers/useWorkspaceController.js),
[api-client.js](../frontend/src/services/api-client.js) y
[vite.config.js](../frontend/vite.config.js).

- `App` conecta el hook controlador con la vista.
- `useWorkspaceController()` mantiene el código fuente, nombre de archivo, respuesta
  de API, estado de carga y mensajes; implementa crear, abrir, guardar, ejecutar,
  validar conexión y limpiar resultados.
- `WorkspaceView` presenta el editor y los paneles de consola, bitácora, recursos,
  errores, tokens, símbolos y AST.
- `checkBackendHealth()` consulta el endpoint health; `executeProgram(source)` envía
  el archivo a `/api/execute`.
- `vite.config.js` fija `localhost:5173` y proxy `/api` a `localhost:8080`.

## 7. API y reportes

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/health` | Estado de disponibilidad del backend |
| POST | `/api/connection-test` | Comprueba recepción HTTP del texto |
| POST | `/api/analyze` | Lexer, parser, tokens, errores y AST, sin ejecutar |
| POST | `/api/execute` | Analiza e interpreta, y devuelve reportes |

La respuesta de ejecución agrupa `console`, `log`, `symbols`, `errors` e
`infrastructure` (`servers`, `services`, `databases`). Los errores del lenguaje se
devuelven en JSON; los errores léxicos/sintácticos están en `analysis.errors`, y los
errores de interpretación están en `execution.errors`.

## 8. Pruebas y mantenimiento

Las pruebas unitarias viven junto a cada módulo con sufijo `.test.js`; las pruebas
HTTP están en `backend/src/api/app.test.js`. Al modificar el lexer, parser, entorno,
serialización o intérprete, añade casos al archivo de pruebas del módulo. Para cambios
que afecten el contrato, cubre la respuesta por HTTP y actualiza
[CONTRATO_API.md](./CONTRATO_API.md). Para cambios de sintaxis, actualiza
[GRAMATICA_AUTOINFRA.md](./GRAMATICA_AUTOINFRA.md).

Verifica antes de integrar:

1. `cd backend; npm test`
2. `cd frontend; npm run lint`
3. `cd frontend; npm run build`
4. `git diff --check`

## 9. Límites conocidos

- No hay análisis semántico estático ni recuperación del parser para acumular varios
  errores sintácticos; el parser informa el primero.
- No se generan reportes persistentes ni se utiliza base de datos.
- No hay autenticación ni despliegue en la nube.
- No se configura un límite de instrucciones o profundidad de llamadas.
- Los recursos y acciones son una simulación en memoria, no operaciones sobre
  infraestructura real.
