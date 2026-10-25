import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { app } from '../app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('health route is handled by the API router', async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('connection-test preserves its response contract', async () => {
  const response = await fetch(`${baseUrl}/api/connection-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'main {}' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    received: true,
    sourceLength: 7,
    message: 'El backend recibió el código fuente.',
  });
});

test('analyze route returns lexical and syntactic analysis', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'int count = 1; main { print(count); }' }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.analysis.success, true);
  assert.equal(result.analysis.ast.type, 'Program');
  assert.deepEqual(result.analysis.errors, []);
  assert.equal(result.execution, null);
});

test('analyze route exposes an inspectable AST with multiplication grouped first', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'main { result = a + b * c; }' }),
  });
  const result = await response.json();
  const expression = result.analysis.ast.body[0].body.statements[0].value;

  assert.equal(result.success, true);
  assert.equal(expression.type, 'BinaryExpression');
  assert.equal(expression.operator, '+');
  assert.equal(expression.left.name, 'a');
  assert.equal(expression.right.type, 'BinaryExpression');
  assert.equal(expression.right.operator, '*');
  assert.equal(expression.right.left.name, 'b');
  assert.equal(expression.right.right.name, 'c');
});

test('analyze route returns located syntax errors without an AST', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'main { int count = ; }' }),
  });
  const result = await response.json();

  assert.equal(result.success, false);
  assert.equal(result.analysis.success, false);
  assert.equal(result.analysis.errors[0].type, 'syntactic');
  assert.equal(result.analysis.errors[0].line, 1);
  assert.equal(result.analysis.ast, null);
});

test('analyze route stops at the first located syntax error', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'main {\n  int first = ;\n  int second = ;\n}',
    }),
  });
  const result = await response.json();

  assert.equal(result.success, false);
  assert.equal(result.analysis.ast, null);
  assert.equal(result.analysis.errors.length, 1);
  assert.deepEqual(
    {
      type: result.analysis.errors[0].type,
      line: result.analysis.errors[0].line,
      column: result.analysis.errors[0].column,
      lexeme: result.analysis.errors[0].lexeme,
    },
    {
      type: 'syntactic',
      line: 2,
      column: 15,
      lexeme: ';',
    },
  );
});

test('analyze route returns lexical errors before invoking the parser', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'main { @ }' }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, false);
  assert.equal(result.analysis.success, false);
  assert.equal(result.analysis.errors.length, 1);
  assert.equal(result.analysis.errors[0].type, 'lexical');
  assert.equal(result.analysis.errors[0].line, 1);
  assert.equal(result.analysis.errors[0].column, 8);
  assert.equal(result.analysis.ast, null);
  assert.equal(result.execution, null);
});

test('execute route returns console, action log and grouped simulated infrastructure', async () => {
  const response = await fetch(`${baseUrl}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: `
        server web {}
        service api {}
        main {
          start(web);
          deploy(api, web);
          print("ready", length([1, 2]));
        }
      `,
    }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.analysis.success, true);
  assert.equal(result.execution.status, 'completed');
  assert.deepEqual(result.execution.console, ['ready 2']);
  assert.deepEqual(result.execution.log, [
    { action: 'start', resource: 'web' },
    { action: 'deploy', resource: 'api', value: 'web' },
  ]);
  assert.deepEqual(result.execution.infrastructure.servers[0].state, {
    status: 'running',
  });
  assert.deepEqual(result.execution.infrastructure.services[0].state, {
    status: 'deployed',
    deployedTo: 'web',
  });
  assert.deepEqual(result.execution.infrastructure.databases, []);
});

test('execute route skips execution when source has syntax errors', async () => {
  const response = await fetch(`${baseUrl}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'main { print(; }' }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, false);
  assert.equal(result.analysis.success, false);
  assert.equal(result.analysis.errors[0].type, 'syntactic');
  assert.deepEqual(result.execution, {
    status: 'not_run',
    success: false,
    console: [],
    log: [],
    errors: [],
    infrastructure: {
      servers: [],
      services: [],
      databases: [],
    },
  });
});

test('execute route returns runtime failures and keeps output already produced', async () => {
  const response = await fetch(`${baseUrl}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'server web {}\nmain { start(web); print("started"); missing(); }',
    }),
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.success, false);
  assert.equal(result.analysis.success, true);
  assert.equal(result.execution.status, 'failed');
  assert.deepEqual(result.execution.console, ['started']);
  assert.deepEqual(result.execution.log, [
    { action: 'start', resource: 'web' },
  ]);
  assert.equal(result.execution.errors[0].type, 'runtime');
  assert.equal(result.execution.infrastructure.servers[0].state.status, 'running');
});

test('execute route validates source type', async () => {
  const response = await fetch(`${baseUrl}/api/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: null }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "El campo 'source' debe ser una cadena.",
  });
});

test('source validation is handled by the controller', async () => {
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 42 }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    success: false,
    message: "El campo 'source' debe ser una cadena.",
  });
});
