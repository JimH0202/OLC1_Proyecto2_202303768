# Inventario léxico de AutoInfra

Este inventario fija las categorías de tokens que reconocerá el lexer. El lexer
produce tokens con `type`, `lexeme`, `line` y `column`; los nombres de `type` se
escriben en mayúsculas. Las posiciones comienzan en `1`.

Las definiciones de tipos y mapas de lexemas están en `backend/src/lexer/token-types.js`.
La estructura serializable de cada token se define en `backend/src/lexer/token.js`.
El recorrido carácter por carácter, el seguimiento de posición, la omisión de espacios
en blanco y el consumo de comentarios están en
`backend/src/lexer/source-cursor.js`.

## Palabras reservadas

Las palabras reservadas son sensibles a mayúsculas y minúsculas. Solo se reconocen
como palabras reservadas cuando el lexema completo coincide; por ejemplo, `server`
es `SERVER`, mientras que `serverNode` es un `IDENTIFIER`.

| Categoría | Lexemas | Tipos de token |
| --- | --- | --- |
| Tipos y recursos | `int`, `float`, `string`, `bool`, `server`, `service`, `database` | `INT`, `FLOAT`, `STRING`, `BOOL`, `SERVER`, `SERVICE`, `DATABASE` |
| Control de flujo | `if`, `else`, `while`, `for`, `break`, `continue`, `return` | `IF`, `ELSE`, `WHILE`, `FOR`, `BREAK`, `CONTINUE`, `RETURN` |
| Declaraciones y entrada | `function`, `task`, `main` | `FUNCTION`, `TASK`, `MAIN` |
| Ejecución de tareas | `run` | `RUN` |
| Literales booleanos | `true`, `false` | `TRUE`, `FALSE` |

La tabla de palabras reservadas del enunciado no enumera `void`; por lo tanto, no se
considera palabra reservada en este inventario. Si la gramática final admite funciones
de usuario con retorno `void`, se deberá acordar e incorporar explícitamente.

## Identificadores

Un identificador comienza con una letra ASCII (`A-Z` o `a-z`) o guion bajo (`_`).
Los caracteres posteriores pueden ser letras ASCII, dígitos (`0-9`) o guion bajo.
Se conserva el uso de mayúsculas y minúsculas.

```text
backend
_backend2
apiProduccion
Backend
```

Todos producen `IDENTIFIER`, salvo que el lexema coincida exactamente con una palabra
reservada. Nombres de recursos, variables, funciones, tareas, propiedades y funciones
nativas —por ejemplo `cpu`, `dependsOn`, `start` y `print`— son identificadores; el
lexer no les asigna categorías especiales.

## Literales

| Forma | Tipo de token | Regla |
| --- | --- | --- |
| Entero, por ejemplo `10` | `INTEGER_LITERAL` | Uno o más dígitos decimales. |
| Decimal, por ejemplo `2.5` | `FLOAT_LITERAL` | Dígitos, punto y uno o más dígitos. |
| Cadena, por ejemplo `"production"` | `STRING_LITERAL` | Delimitada por comillas dobles; procesa `\"`, `\\`, `\n` y `\t`. |
| `true` / `false` | `TRUE` / `FALSE` | Se reconocen como palabras reservadas booleanas. |

El signo menos no forma parte del token numérico: `-5` produce `MINUS` seguido de
`INTEGER_LITERAL`. El punto decimal se reconoce como parte de un decimal cuando está
entre dígitos; en otros contextos se reconoce como `DOT` para acceso a propiedades.

## Operadores

El lexer debe aplicar coincidencia más larga para operadores compuestos como `>=`,
`==` y `&&`, antes de reconocer sus prefijos.

| Grupo | Lexemas | Tipos de token |
| --- | --- | --- |
| Aritméticos | `+`, `-`, `*`, `/`, `%` | `PLUS`, `MINUS`, `STAR`, `SLASH`, `PERCENT` |
| Asignación | `=` | `ASSIGN` |
| Relacionales | `>`, `<`, `>=`, `<=` | `GREATER`, `LESS`, `GREATER_EQUAL`, `LESS_EQUAL` |
| Igualdad | `==`, `!=` | `EQUAL_EQUAL`, `BANG_EQUAL` |
| Lógicos | `&&`, `||`, `!` | `AND_AND`, `OR_OR`, `BANG` |

## Delimitadores y puntuación

| Lexema | Tipo de token | Uso |
| --- | --- | --- |
| `(`, `)` | `LEFT_PAREN`, `RIGHT_PAREN` | Agrupación y parámetros/argumentos. |
| `{`, `}` | `LEFT_BRACE`, `RIGHT_BRACE` | Bloques y declaraciones de recursos. |
| `[`, `]` | `LEFT_BRACKET`, `RIGHT_BRACKET` | Literales e índices de arreglos. |
| `,` | `COMMA` | Separación de parámetros y argumentos. |
| `;` | `SEMICOLON` | Terminación de declaraciones y sentencias. |
| `.` | `DOT` | Acceso a propiedades. |

## Elementos ignorados y fin de entrada

- Espacios, tabulaciones, retornos verticales, avances de página, retornos de carro y
  saltos de línea no producen tokens. El cursor omite estos caracteres sin perder la
  posición del siguiente lexema.
- Los comentarios `// ...` hasta el fin de línea y `/* ... */` se ignoran.
- Un comentario multilínea sin cierre produce un error léxico con línea y columna de
  inicio.
- Una cadena sin comilla de cierre y cualquier carácter no reconocido producen un
  error léxico con línea y columna.
- Al terminar el archivo, el lexer agrega el token sintético `EOF`, con lexema vacío
  y posición al final del archivo, para que el parser detecte el fin de entrada.

## Alcance

El lexer identifica estructura textual; no determina si un identificador fue
declarado, si un tipo es compatible, si una propiedad existe o si un valor cumple
restricciones. Esas validaciones semánticas no forman parte del proyecto acordado.
