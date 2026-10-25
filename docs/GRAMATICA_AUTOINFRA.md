# Gramática completa de AutoInfra

Este documento especifica la gramática léxica y sintáctica que implementan el
analizador léxico y el parser del proyecto. Está escrita en EBNF; el parser es manual,
de descenso recursivo, y construye un AST propio. Esta gramática describe sintaxis,
no valida tipos, declaraciones, ámbitos, firmas ni restricciones semánticas.

## Convenciones EBNF

- `A = B ;` define una regla.
- `|` separa alternativas.
- `{ X }` representa cero o más repeticiones.
- `[ X ]` representa un elemento opcional.
- Los nombres en mayúsculas representan tokens.
- `EOF` representa el fin del archivo.

## Gramática léxica

Los espacios en blanco, tabulaciones, retornos de carro y saltos de línea separan
tokens y no se emiten. Las posiciones de línea y columna empiezan en `1`. Las
palabras reservadas distinguen mayúsculas de minúsculas.

```ebnf
letter                  = "A" | ... | "Z" | "a" | ... | "z" | "_" ;
digit                   = "0" | ... | "9" ;
identifier              = ( letter ), { letter | digit } ;

integerLiteral          = digit, { digit } ;
floatLiteral            = digit, { digit }, ".", digit, { digit } ;

stringLiteral           = '"', { stringCharacter | escapeSequence }, '"' ;
stringCharacter         = cualquier carácter excepto comilla doble (U+0022),
                          barra inversa (U+005C), CR o LF ;
escapeSequence          = barra inversa, ( '"' | barra inversa | "n" | "t" ) ;

lineComment             = "//", { cualquier carácter excepto CR o LF } ;
blockComment            = "/*", { cualquier carácter o salto de línea }, "*/" ;

reservedWord            = "int" | "float" | "string" | "bool"
                        | "server" | "service" | "database"
                        | "if" | "else" | "while" | "for"
                        | "break" | "continue" | "return"
                        | "function" | "task" | "main" | "run"
                        | "true" | "false" ;

operator                = "+" | "-" | "*" | "/" | "%"
                        | "=" | ">" | "<" | ">=" | "<="
                        | "==" | "!=" | "&&" | "||" | "!" ;

punctuation             = "(" | ")" | "{" | "}" | "[" | "]"
                        | "," | ";" | "." ;
```

Los operadores de dos caracteres se reconocen antes que sus prefijos de un carácter.
El signo `-` es un operador unario o binario, no parte del token numérico. `1.0` es
decimal; un punto que no forma parte de un decimal es el operador de acceso a
propiedad. Los comentarios no generan tokens. Los escapes aceptados en cadenas son
comillas dobles, barra inversa, nueva línea y tabulación.

Un carácter desconocido, una cadena sin cierre, un comentario multilínea sin cierre
o un escape no permitido genera un error léxico con línea y columna. El lexer puede
continuar escaneando para informar otros errores léxicos. Si hay errores léxicos, el
servicio no invoca el parser.

## Gramática sintáctica

```ebnf
program                 = { declaration }, mainDeclaration, EOF ;

declaration             = variableDeclaration
                        | resourceDeclaration
                        | functionDeclaration
                        | taskDeclaration ;

variableDeclaration     = type, IDENTIFIER, [ ASSIGN, expression ], SEMICOLON ;

resourceDeclaration     = resourceKind, IDENTIFIER, LEFT_BRACE,
                          { resourceProperty }, RIGHT_BRACE ;
resourceKind            = SERVER | SERVICE | DATABASE ;
resourceProperty        = IDENTIFIER, ASSIGN, expression, SEMICOLON ;

functionDeclaration    = FUNCTION, IDENTIFIER, LEFT_PAREN,
                          [ parameterList ], RIGHT_PAREN, type, block ;
parameterList           = parameter, { COMMA, parameter } ;
parameter               = type, IDENTIFIER ;

taskDeclaration        = TASK, IDENTIFIER, block ;
mainDeclaration        = MAIN, block ;

type                    = baseType, { LEFT_BRACKET, RIGHT_BRACKET } ;
baseType                = INT | FLOAT | STRING | BOOL
                        | SERVER | SERVICE | DATABASE ;

block                   = LEFT_BRACE, { statement }, RIGHT_BRACE ;

statement               = block
                        | variableDeclaration
                        | assignmentStatement
                        | expressionStatement
                        | ifStatement
                        | whileStatement
                        | forStatement
                        | runStatement
                        | returnStatement
                        | breakStatement
                        | continueStatement ;

assignmentStatement     = assignmentTarget, ASSIGN, expression, SEMICOLON ;
assignmentTarget        = IDENTIFIER, { propertySuffix | indexSuffix } ;
expressionStatement     = expression, SEMICOLON ;

ifStatement             = IF, LEFT_PAREN, expression, RIGHT_PAREN, statement,
                          [ ELSE, statement ] ;
whileStatement          = WHILE, LEFT_PAREN, expression, RIGHT_PAREN, statement ;

forStatement            = FOR, LEFT_PAREN, [ forInitializer ], SEMICOLON,
                          [ expression ], SEMICOLON, [ forUpdate ],
                          RIGHT_PAREN, statement ;
forInitializer          = variableDeclarationCore
                        | assignmentOrExpressionCore ;
variableDeclarationCore = type, IDENTIFIER, [ ASSIGN, expression ] ;
forUpdate               = assignmentOrExpressionCore ;
assignmentOrExpressionCore
                        = expression, [ ASSIGN, expression ] ;

runStatement            = RUN, IDENTIFIER,
                          [ LEFT_PAREN, [ argumentList ], RIGHT_PAREN ],
                          SEMICOLON ;
returnStatement         = RETURN, [ expression ], SEMICOLON ;
breakStatement          = BREAK, SEMICOLON ;
continueStatement       = CONTINUE, SEMICOLON ;

expression              = logicalOr ;
logicalOr                = logicalAnd, { OR_OR, logicalAnd } ;
logicalAnd               = equality, { AND_AND, equality } ;
equality                 = comparison,
                          { ( EQUAL_EQUAL | BANG_EQUAL ), comparison } ;
comparison               = term,
                          { ( GREATER | GREATER_EQUAL | LESS | LESS_EQUAL ), term } ;
term                     = factor, { ( PLUS | MINUS ), factor } ;
factor                   = unary, { ( STAR | SLASH | PERCENT ), unary } ;
unary                    = ( BANG | MINUS ), unary | postfix ;

postfix                  = primary, { callSuffix | propertySuffix | indexSuffix } ;
callSuffix               = LEFT_PAREN, [ argumentList ], RIGHT_PAREN ;
propertySuffix           = DOT, IDENTIFIER ;
indexSuffix              = LEFT_BRACKET, expression, RIGHT_BRACKET ;
argumentList             = expression, { COMMA, expression } ;

primary                  = INTEGER_LITERAL
                         | FLOAT_LITERAL
                         | STRING_LITERAL
                         | TRUE
                         | FALSE
                         | IDENTIFIER
                         | arrayLiteral
                         | LEFT_PAREN, expression, RIGHT_PAREN ;
arrayLiteral             = LEFT_BRACKET, [ argumentList ], RIGHT_BRACKET ;
```

## Desambiguación y asociatividad

Una declaración de recurso y una variable de referencia empiezan con la misma
palabra (`server`, `service` o `database`). Se reconoce una declaración de recurso
cuando después del tipo y el identificador viene `{`; por ejemplo, `server node {}`
declara un recurso y `server node;` declara una variable de referencia.

Las declaraciones globales de variables, recursos, funciones y tareas pueden
intercalarse antes de `main`. El programa requiere exactamente una declaración
`main`, al final del archivo. El tipo de retorno de las funciones es obligatorio; no
existe un token reservado `void`.

Los operadores binarios de cada nivel son asociativos por la izquierda. De menor a
mayor precedencia:

1. `||`
2. `&&`
3. `==`, `!=`
4. `<`, `<=`, `>`, `>=`
5. `+`, `-`
6. `*`, `/`, `%`
7. `!`, `-` unarios
8. llamadas, acceso a propiedades e índices

Por ejemplo, `a + b * c` se agrupa como `a + (b * c)`, y `!ready || count >= 2`
como `(!ready) || (count >= 2)`. Los paréntesis permiten modificar explícitamente
la agrupación. El intérprete implementa cortocircuito para `&&` y `||`.

## Límites del análisis

El parser informa el primer error sintáctico localizado y detiene el análisis; no
realiza sincronización ni recuperación para acumular errores. La gramática no
determina si nombres existen, si tipos o argumentos son compatibles, si un arreglo es
homogéneo, si una propiedad existe o es de solo lectura, ni si una condición produce
un booleano. Esas validaciones semánticas están fuera del alcance acordado.

## Ejemplo

```infra
server backend {
    cpu = 4;
    memory = 8;
    disk = 100;
    os = "ubuntu";
}

service api {
    port = 8080;
    replicas = 2;
}

function canDeploy(server host, int minimumMemory) bool {
    return host.memory >= minimumMemory;
}

task production {
    start(backend);
    if (canDeploy(backend, 8)) {
        deploy(backend, api);
        scale(api, 3);
    }
}

main {
    run production;
    print(api.status);
}
```
