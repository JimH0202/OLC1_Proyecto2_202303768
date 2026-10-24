# AutoInfra

Intérprete de un lenguaje para describir y simular infraestructura. El alcance acordado
incluye análisis léxico y sintáctico, construcción de AST e interpretación simulada;
no incluye análisis semántico.

## Estructura

```text
backend/
  src/
    api/
    ast/
    environment/
    infrastructure/
    interpreter/
    lexer/
    parser/
    reports/
frontend/
  src/
examples/
docs/
```

## Componentes

- `backend/`: API y núcleo del lenguaje en JavaScript sobre Node.js.
- `frontend/`: interfaz web para editar archivos `.infra` y consultar resultados.
- `examples/`: programas AutoInfra de ejemplo y pruebas manuales.
- `docs/`: documentación técnica del proyecto y contrato HTTP/JSON.

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
