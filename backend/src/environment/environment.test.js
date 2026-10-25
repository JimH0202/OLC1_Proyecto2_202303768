import assert from 'node:assert/strict';
import test from 'node:test';
import {
  Environment,
  RuntimeEnvironmentError,
} from './environment.js';

test('stores and updates variables in memory', () => {
  const environment = new Environment();

  environment.defineVariable('count', 1);
  assert.equal(environment.getVariable('count'), 1);
  environment.assignVariable('count', 2);
  assert.equal(environment.getVariable('count'), 2);
});

test('resolves variables in parent scopes and assigns them in their defining scope', () => {
  const globalEnvironment = new Environment();
  const localEnvironment = globalEnvironment.createChild();
  globalEnvironment.defineVariable('count', 1);

  assert.equal(localEnvironment.getVariable('count'), 1);
  localEnvironment.assignVariable('count', 3);
  assert.equal(globalEnvironment.getVariable('count'), 3);
});

test('allows a child scope to shadow a parent variable without changing it', () => {
  const globalEnvironment = new Environment();
  const localEnvironment = globalEnvironment.createChild();
  globalEnvironment.defineVariable('count', 1);
  localEnvironment.defineVariable('count', 2);

  assert.equal(localEnvironment.getVariable('count'), 2);
  assert.equal(globalEnvironment.getVariable('count'), 1);
});

test('reports missing variables explicitly', () => {
  const environment = new Environment();

  assert.throws(
    () => environment.getVariable('missing'),
    {
      name: 'RuntimeEnvironmentError',
      message: 'Variable no definida: missing.',
    },
  );
  assert.throws(
    () => environment.assignVariable('missing', 1),
    RuntimeEnvironmentError,
  );
});

test('stores simulated resources and their properties in shared memory', () => {
  const environment = new Environment();
  const child = environment.createChild();
  const server = {
    kind: 'server',
    name: 'web',
    properties: [
      { name: 'cpu', value: 2 },
      { name: 'os', value: 'ubuntu' },
    ],
  };

  child.defineResource(server);

  assert.deepEqual(environment.getResource('web'), {
    kind: 'server',
    name: 'web',
    properties: {
      cpu: 2,
      os: 'ubuntu',
    },
  });
  assert.deepEqual(environment.listResources(), [{
    kind: 'server',
    name: 'web',
    properties: {
      cpu: 2,
      os: 'ubuntu',
    },
  }]);
});

test('reports missing resources and rejects malformed resource records', () => {
  const environment = new Environment();

  assert.throws(
    () => environment.getResource('missing'),
    {
      name: 'RuntimeEnvironmentError',
      message: 'Recurso no definido: missing.',
    },
  );
  assert.throws(() => environment.defineResource({ kind: 'server', name: 'web' }), TypeError);
});

test('does not expose the internal resource map through resource listings', () => {
  const environment = new Environment();
  environment.defineResource({
    kind: 'database',
    name: 'db',
    properties: [{ name: 'engine', value: 'postgres' }],
  });

  const listedResources = environment.listResources();
  listedResources[0].properties.engine = 'changed';

  assert.equal(environment.getResource('db').properties.engine, 'postgres');
});
