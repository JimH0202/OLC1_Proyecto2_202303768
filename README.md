# AutoInfra

Intérprete de un lenguaje para describir y simular infraestructura. El alcance acordado
incluye análisis léxico y sintáctico, construcción de AST e interpretación simulada;
no incluye análisis semántico.

## Estructura

```text
backend/
  src/
    api/          # Servidor HTTP y rutas
    controllers/  # Controladores de solicitudes
    models/       # Modelos de resultados
    services/     # Casos de uso y análisis del lenguaje
    environment/  # Variables y recursos simulados en memoria
    ast/          # Fábrica y tipos de nodos del AST
    lexer/
    parser/
    interpreter/  # Recorrido e interpretación del AST
frontend/
  src/
    controllers/  # Estado y acciones de pantalla
    models/       # Modelos de respuesta
    services/     # Comunicación HTTP
    views/        # Componentes de interfaz
examples/
docs/
```

## Componentes

- `backend/`: API y núcleo del lenguaje en JavaScript sobre Node.js.
- `frontend/`: interfaz web para editar archivos `.infra` y consultar resultados.
- `examples/`: programas AutoInfra de ejemplo y pruebas manuales.
- `docs/`: documentación técnica del proyecto y contrato HTTP/JSON.

## Organización MVC

El backend separa el manejo HTTP de la lógica del lenguaje: las rutas de
`backend/src/api/routes.js` delegan en controladores, los controladores usan el
servicio de análisis y este combina lexer y parser para producir el modelo
`AnalysisResult`. La configuración de Express está en `backend/src/app.js`; el
arranque del servidor está aislado en `backend/src/api/server.js`.

En el frontend se aplica una separación MVC adaptada a React: el hook controlador
mantiene el estado y las acciones del espacio de trabajo, el servicio realiza las
solicitudes HTTP y la vista presenta la interfaz sin acceder directamente a la API.
La pantalla principal permite crear, abrir y guardar archivos `.infra`, ejecutar el
programa y consultar salida, errores, tokens, AST y estado simulado.

El inventario de tokens para implementar el lexer está en
[docs/ESPECIFICACION_LEXICA.md](./docs/ESPECIFICACION_LEXICA.md).
El parser está implementado en `backend/src/parser/parser.js`; la gramática del
subconjunto que reconoce está en
[docs/GRAMATICA_AUTOINFRA.md](./docs/GRAMATICA_AUTOINFRA.md).
El parser construye nodos JSON mediante la fábrica y catálogo de
`backend/src/ast/nodes.js`; cada nodo conserva su línea y columna de origen.
El entorno de ejecución en memoria está en `backend/src/environment/environment.js`.
Mantiene valores de variables por ámbito y un registro de recursos simulado compartido
entre ámbitos; no se conecta ni modifica servicios externos.
Los recursos `server`, `service` y `database` se representan en
`backend/src/infrastructure/resource.js`, con sus propiedades configuradas y estado
simulado inicial `stopped`.
El recorrido e interpretación del AST está en
`backend/src/interpreter/interpreter.js`; las acciones nativas de infraestructura
se simulan en memoria. Las firmas incluidas son `start(recurso)`, `stop(recurso)`,
`install(servidor, software)`, `deploy(servicio, servidor)`, `scale(recurso, cantidad)`,
`print(...)` y `length(cadena_o_arreglo)`. `print` escribe en la consola simulada y
las acciones sobre recursos actualizan su estado e historial. No se aplican las
restricciones excluidas de despliegue/instalación según estado ni un mínimo de
réplicas; las acciones repetidas no se deduplican ni generan advertencias al iniciar
un recurso ya activo. `POST /api/execute` devuelve la consola, la bitácora, errores de
ejecución y el estado de la infraestructura simulada; la interfaz permite ejecutar
el ejemplo y consultar la respuesta JSON. El intérprete no configura máximos propios
de instrucciones ejecutadas ni de profundidad de llamadas.

## Requisitos

- Node.js 20.19 o superior.
- npm.

## Instalación

```bash
cd backend
npm install
```

En otra terminal:

```bash
cd frontend
npm install
```

## Desarrollo

Inicia el backend en una terminal:

```bash
cd backend
npm run dev
```

Inicia el frontend en otra terminal:

```bash
cd frontend
npm run dev
```

El contrato acordado para el intercambio de código y resultados se encuentra en
[docs/CONTRATO_API.md](./docs/CONTRATO_API.md). El backend usará JSON y define los
endpoints `GET /api/health`, `POST /api/analyze` y `POST /api/execute`. La pantalla
inicial permite verificar el envío del código al endpoint temporal
`POST /api/connection-test`; este prueba la comunicación HTTP y no analiza ni ejecuta
el lenguaje.
