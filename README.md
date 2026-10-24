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

La configuración de los proyectos Node.js y las dependencias se agregarán en la
siguiente etapa del trabajo.
