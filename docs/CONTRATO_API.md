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

### `POST /api/analyze`

Realiza análisis léxico y sintáctico, y devuelve los tokens, el AST y los errores
encontrados. No ejecuta el programa.

Respuesta:

```json
{
  "success": true,
  "tokens": [
    {
      "type": "SERVER",
      "lexeme": "server",
      "line": 1,
      "column": 1
    }
  ],
  "ast": {
    "type": "Program",
    "body": []
  },
  "errors": []
}
```

Si hay errores léxicos o sintácticos, `success` es `false`, los errores aparecen en
`errors` y `ast` es `null` si no se pudo construir un AST completo. Los tokens
reconocidos se devuelven aunque el análisis no tenga éxito.

### `POST /api/execute`

Realiza análisis léxico y sintáctico y, si estos finalizan correctamente, interpreta
el AST en el entorno simulado.

Respuesta:

```json
{
  "success": true,
  "tokens": [],
  "ast": {
    "type": "Program",
    "body": []
  },
  "errors": [],
  "console": [],
  "log": [],
  "infrastructure": {
    "servers": [],
    "services": [],
    "databases": []
  }
}
```

Si el análisis léxico o sintáctico falla, la ejecución no comienza; `console`, `log`
y las colecciones de infraestructura se devuelven vacíos. Los errores ocurridos
durante la interpretación se informan con `type: "runtime"`.

## Formato de errores

Cada error de análisis incluye fase, descripción y posición:

```json
{
  "type": "lexical",
  "message": "Carácter no reconocido '@'.",
  "line": 1,
  "column": 12
}
```

`type` puede ser `lexical`, `syntactic` o `runtime`. Los errores léxicos y sintácticos
incluyen línea y columna del código fuente. Los errores de ejecución incluyen esa
ubicación cuando el nodo del AST la proporciona.

Los errores propios del lenguaje se devuelven en el arreglo `errors`; no se usan
excepciones HTTP para representar errores de análisis o interpretación. Los errores
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
errores semánticos o una tabla semántica de símbolos.

## Reglas de compatibilidad

- Todas las solicitudes y respuestas usan JSON en UTF-8.
- Las posiciones de línea y columna empiezan en `1`.
- El AST se serializa como JSON plano, sin referencias circulares ni métodos.
- `success` es `true` cuando la operación solicitada finaliza sin errores; si hay
  errores léxicos, sintácticos o de ejecución, es `false`.
- La respuesta de análisis nunca ejecuta acciones del programa.
