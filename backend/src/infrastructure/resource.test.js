import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InfrastructureResource,
  RESOURCE_KINDS,
} from './resource.js';

test('models each supported infrastructure kind with configuration and initial state', () => {
  const resources = RESOURCE_KINDS.map((kind) => new InfrastructureResource({
    kind,
    name: `${kind}-resource`,
    properties: { cpu: 2 },
  }));

  assert.deepEqual(resources.map(({ kind }) => kind), [
    'server',
    'service',
    'database',
  ]);
  for (const resource of resources) {
    assert.deepEqual(resource.state, { status: 'stopped' });
    assert.deepEqual(JSON.parse(JSON.stringify(resource)), {
      kind: resource.kind,
      name: `${resource.kind}-resource`,
      properties: { cpu: 2 },
      state: { status: 'stopped' },
    });
  }
});

test('rejects resource kinds and properties outside the model shape', () => {
  assert.throws(
    () => new InfrastructureResource({
      kind: 'container',
      name: 'worker',
      properties: {},
    }),
    /Tipo de recurso no soportado/,
  );
  assert.throws(
    () => new InfrastructureResource({
      kind: 'server',
      name: 'web',
      properties: [],
    }),
    /Las propiedades del recurso deben ser un objeto/,
  );
});
