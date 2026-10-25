# Gramática sintáctica de AutoInfra

Este documento define el subconjunto de AutoInfra que consumirá el parser. La
gramática se expresa en EBNF y utiliza los nombres de token de
`backend/src/lexer/token-types.js`. Los espacios y comentarios son ignorados por el
lexer; `EOF` representa el fin del archivo.

La gramática determina únicamente si la secuencia de tokens tiene una estructura
válida. No comprueba declaraciones, ámbitos, tipos, firmas, propiedades, referencias
ni restricciones de recursos. Esas comprobaciones semánticas quedan fuera del alcance
acordado.

## Notación

- `{ X }` significa cero o más repeticiones de `X`.
- `[ X ]` significa que `X` es opcional.
- `|` separa alternativas.
- Los nombres en mayúsculas son tokens; los nombres en minúsculas son reglas.

## Programas y declaraciones

```ebnf
program                 = { globalDeclaration | resourceDeclaration
                            | functionDeclaration | taskDeclaration },
                          mainDeclaration, EOF ;

globalDeclaration       = variableDeclaration ;

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

type                    = primitiveType, { LEFT_BRACKET, RIGHT_BRACKET } ;
primitiveType           = INT | FLOAT | STRING | BOOL ;
```

Las declaraciones globales, los recursos, las funciones y las tareas pueden
intercalarse antes de `main`; el orden entre esas categorías no se valida. El programa
debe contener exactamente un `main`, y este debe ser la última construcción del
archivo.

La forma de una función incluye un tipo de retorno porque el inventario léxico no
define `void` como palabra reservada. El parser no comprobará que el cuerpo devuelva
un valor compatible con ese tipo.

## Bloques y sentencias

```ebnf
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
propertySuffix          = DOT, IDENTIFIER ;
indexSuffix             = LEFT_BRACKET, expression, RIGHT_BRACKET ;
expressionStatement     = expression, SEMICOLON ;

ifStatement             = IF, LEFT_PAREN, expression, RIGHT_PAREN, statement,
                          [ ELSE, statement ] ;
whileStatement          = WHILE, LEFT_PAREN, expression, RIGHT_PAREN, statement ;

forStatement            = FOR, LEFT_PAREN,
                          [ forInitializer ], SEMICOLON,
                          [ expression ], SEMICOLON,
                          [ forUpdate ], RIGHT_PAREN, statement ;
forInitializer          = variableDeclarationCore
                        | assignmentCore
                        | expression ;
variableDeclarationCore = type, IDENTIFIER, [ ASSIGN, expression ] ;
forUpdate               = assignmentCore | expression ;
assignmentCore          = assignmentTarget, ASSIGN, expression ;

runStatement            = RUN, IDENTIFIER,
                          [ LEFT_PAREN, [ argumentList ], RIGHT_PAREN ],
                          SEMICOLON ;
returnStatement         = RETURN, [ expression ], SEMICOLON ;
breakStatement          = BREAK, SEMICOLON ;
continueStatement       = CONTINUE, SEMICOLON ;
```

La gramática acepta expresiones en las condiciones y no comprueba que produzcan un
booleano. Tampoco comprueba si `break`, `continue` o `return` aparecen en un contexto
de ejecución válido.

## Expresiones y precedencia

Las reglas están ordenadas de menor a mayor precedencia. Los operadores binarios de
cada nivel son asociativos por la izquierda. La asignación se restringe a las reglas
de sentencia y a las cláusulas de `for`.

```ebnf
expression              = logicalOr ;
logicalOr                = logicalAnd, { OR_OR, logicalAnd } ;
logicalAnd               = equality, { AND_AND, equality } ;
equality                 = comparison, { ( EQUAL_EQUAL | BANG_EQUAL ), comparison } ;
comparison               = term,
                           { ( GREATER | GREATER_EQUAL | LESS | LESS_EQUAL ), term } ;
term                     = factor, { ( PLUS | MINUS ), factor } ;
factor                   = unary, { ( STAR | SLASH | PERCENT ), unary } ;
unary                    = ( BANG | MINUS ), unary | postfix ;

postfix                  = primary, { callSuffix | propertySuffix | indexSuffix } ;
callSuffix               = LEFT_PAREN, [ argumentList ], RIGHT_PAREN ;
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

Por ejemplo, `a + b * c` se agrupa como `a + (b * c)`, y `!ready || count >= 2`
como `(!ready) || (count >= 2)`. La sintaxis permite arreglos, pero no se valida que
sus elementos sean del mismo tipo.

## Ejemplos cubiertos

Declaración de recursos y bloque principal:

```infra
server web {
    cpu = 2;
    memory = 4;
}

main {
    start(web);
    print("AutoInfra listo");
}
```

Declaraciones, función, tarea, control de flujo y arreglo:

```infra
int count = 1;
function isReady(int amount) bool {
    return amount > 0;
}
task prepare {
    run setup;
}
main {
    if (isReady(count)) {
        count = count + 1;
    } else {
        count = 0;
    }
    for (int i = 0; i < 2; i = i + 1) {
        print([count, i]);
    }
}
```

## Fuera del análisis sintáctico

El parser no resolverá nombres ni aplicará reglas semánticas. En particular, que una
construcción sea aceptada por esta gramática no implica que los identificadores estén
declarados, que los tipos coincidan, que las llamadas tengan una firma válida, que una
propiedad exista o que una condición tenga tipo booleano.
