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
```

## Componentes

- `backend/`: API y núcleo del lenguaje en JavaScript sobre Node.js.
- `frontend/`: interfaz web para editar archivos `.infra` y consultar resultados.
- `examples/`: programas AutoInfra de ejemplo y pruebas manuales.

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

La interfaz React se inicia con:

```bash
cd frontend
npm run dev
```

El backend ya tiene sus dependencias de Express y CORS instaladas. Su servidor y
comandos de ejecución se agregarán junto con la API en una etapa posterior.
