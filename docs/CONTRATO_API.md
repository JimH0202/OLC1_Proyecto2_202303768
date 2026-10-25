# Contrato de comunicación Frontend–Backend

Este documento define el intercambio entre la interfaz web y la API AutoInfra. El
frontend envía el código fuente completo como texto dentro de una solicitud JSON. El
backend procesa el código y responde siempre con JSON.

## Direcciones locales de desarrollo

- Frontend Vite: `http://localhost:5173`
- Backend Node.js: `http://localhost:8080`
- Base URL de la API: `http://localhost:8080/api`

El backend permitirá solicitudes CORS desde el origen del frontend.

## Formato de solicitud

Los endpoints que procesan código reciben:

```http
Content-Type: application/json
```

```json
{
  "source": "server backend { cpu = 4; } main { start(backend); }"
}
```

`source` contiene el archivo `.infra` completo como una cadena. El backend es
responsable de analizarlo; el frontend no tokeniza ni interpreta el lenguaje.

Si `source` no es una cadena, la API responde con HTTP `400`:

```json
{
  "success": false,
  "message": "El campo 'source' debe ser una cadena."
}
```

## Endpoints

### `GET /api/health`

Comprueba que la API esté disponible.

Respuesta HTTP `200`:

```json
{
  "status": "ok"
}
```

### `POST /api/connection-test`

Endpoint temporal de integración. Comprueba que el frontend puede enviar el código
fuente como texto al backend y recibir JSON. No ejecuta lexer, parser ni intérprete.

Solicitud:

```json
{
  "source": "main { print(\"hola\"); }"
}
```

Respuesta HTTP `200`:

```json
{
  "success": true,
  "received": true,
  "sourceLength": 23,
  "message": "El backend recibió el código fuente."
}
```

Cuando `source` no es una cadena, devuelve HTTP `400` con el formato de error de
solicitud inválida definido arriba.

### `POST /api/analyze`

Realiza análisis léxico y sintáctico, y devuelve el resultado del análisis, los
tokens, los errores y el AST. No ejecuta el programa. La respuesta utiliza el
envoltorio común definido abajo; `execution` siempre será `null`.

Respuesta cuando el análisis es exitoso:

```json
{
  "success": true,
  "analysis": {
    "success": true,
    "tokens": [
      {
        "type": "SERVER",
        "lexeme": "server",
        "line": 1,
        "column": 1
      }
    ],
    "errors": [],
    "ast": {
      "type": "Program",
      "body": []
    }
  },
  "execution": null
}
```

Si hay errores léxicos o sintácticos, tanto `success` como `analysis.success` son
`false`; se devuelven los tokens reconocidos y los errores encontrados. `ast` será
`null` si el parser no pudo construir un árbol completo.

### `POST /api/execute`

Realiza análisis léxico y sintáctico y, si estos finalizan correctamente, interpreta
el AST en el entorno simulado. Usa la misma estructura de respuesta; `execution`
contiene el resultado de la ejecución.

Respuesta cuando el análisis y la ejecución son exitosos:

```json
{
  "success": true,
  "analysis": {
    "success": true,
    "tokens": [],
    "errors": [],
    "ast": {
      "type": "Program",
      "body": []
    }
  },
  "execution": {
    "status": "completed",
    "success": true,
    "console": [],
    "log": [],
    "symbols": [],
    "errors": [],
    "infrastructure": {
      "servers": [],
      "services": [],
      "databases": []
    }
  }
}
```

`console` contiene las líneas producidas por `print`. `log` es una lista de acciones
simuladas, cada una con `action`, `resource` y, cuando aplica, `value`. El registro
inicial de cada recurso usa `action: "register"`. Para una acción `scale`,
`previousValue` aparece cuando el recurso ya tenía una cantidad de réplicas; la
interfaz usa ese dato para mostrar el cambio, por ejemplo, de `2` a `3`.
`infrastructure` agrupa los recursos por `servers`, `services` y `databases`, e
incluye sus propiedades y estado simulado actual.
`symbols` presenta las declaraciones observadas durante la ejecución con los campos
`identifier`, `category`, `type`, `scope` y `value`. Es un reporte; no realiza
validaciones semánticas.

Si el análisis léxico o sintáctico falla, la ejecución no comienza. En ese caso
`execution.status` es `"not_run"`, `execution.success` es `false` y sus colecciones
de salida e infraestructura están vacías. `analysis.errors` conserva los errores que
impidieron ejecutar.

Si ocurre un error de ejecución o infraestructura después de generar salida o
modificar recursos, la respuesta conserva la consola, bitácora y estado simulado
alcanzados antes del error; `execution.status` será `"failed"` y
`execution.errors` contendrá el error. Los errores de dependencias de despliegue se
identifican con `type: "infrastructure"` y `code: "INFRA-004"`.

## Formato de errores

Los errores se devuelven en el arreglo correspondiente a su fase. Cada elemento tiene
la siguiente forma:

```json
{
  "type": "lexical",
  "message": "Carácter no reconocido '@'.",
  "line": 1,
  "column": 12,
  "lexeme": "@"
}
```

- `analysis.errors` solo contiene errores `lexical` o `syntactic`.
- `execution.errors` contiene errores `runtime` o `infrastructure`.
- `line`, `column` y `lexeme` son opcionales cuando no existe una ubicación o lexema
  asociado; cuando se informan, línea y columna empiezan en `1`.

Los errores propios del lenguaje no cambian el código HTTP de éxito del endpoint: se
representan en JSON y hacen que el `success` superior sea `false`. Los errores
inesperados del servidor usan HTTP `500` y una respuesta JSON genérica, sin exponer
detalles internos:

```json
{
  "success": false,
  "message": "Error interno del servidor."
}
```

## Alcance del análisis

La API realiza análisis léxico y sintáctico, construcción del AST e interpretación
simulada si se solicita `/api/execute`. No implementa análisis semántico ni devuelve
errores semánticos; la tabla de símbolos es únicamente un inventario de declaraciones
y valores que se observaron al ejecutar.

## Reglas de compatibilidad

- Todas las solicitudes y respuestas usan JSON en UTF-8.
- Las posiciones de línea y columna empiezan en `1`.
- El AST se serializa como JSON plano, sin referencias circulares ni métodos.
- Cada respuesta de análisis o ejecución incluye `success`, `analysis` y `execution`.
- `analysis` contiene `success`, `tokens`, `errors` y `ast`.
- `execution` es `null` en `/api/analyze`; en `/api/execute` contiene `status`,
  `success`, `console`, `log`, `symbols`, `errors` e `infrastructure`.
- El `success` superior es `true` solo si las fases aplicables a ese endpoint
  finalizaron sin errores.
- `execution.status` puede ser `completed`, `failed` o `not_run`.
- La respuesta de análisis nunca ejecuta acciones del programa.
