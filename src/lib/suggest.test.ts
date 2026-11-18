import { test } from 'node:test';
import assert from 'node:assert/strict';
import { styleForType } from '../db/types.ts';
import { suggestFromIcon } from './suggest.ts';

test('mead: the icon gives a name and style', () => {
  assert.deepEqual(suggestFromIcon('maple', 'mead', ''), { name: 'Maple Acerglyn', style: 'Acerglyn' });
  assert.deepEqual(suggestFromIcon('traditional', 'mead', ''), { name: 'Traditional Mead', style: 'Traditional' });
  assert.equal(suggestFromIcon('orange', 'mead', '').style, 'Melomel');
  assert.equal(suggestFromIcon('pumpkin', 'mead', '').style, 'Metheglin');
  assert.equal(suggestFromIcon('vanilla', 'mead', '').style, 'Metheglin');
});

test('mead: a chosen style is kept and used in the name', () => {
  assert.deepEqual(suggestFromIcon('maple', 'mead', 'Melomel'), { name: 'Maple Melomel', style: 'Melomel' });
});

test('other types use the type in the name', () => {
  assert.deepEqual(suggestFromIcon('raspberry', 'wine', ''), { name: 'Raspberry Wine', style: null });
  assert.deepEqual(suggestFromIcon('apple', 'cider', ''), { name: 'Apple Cider', style: null });
  assert.deepEqual(suggestFromIcon('hops', 'beer', 'IPA'), { name: 'Hops Beer', style: 'IPA' });
  assert.equal(suggestFromIcon('hops', 'beer', 'Melomel').style, null, 'a mead style does not belong to beer');
});

test('switching type clears styles from another list, keeps custom ones', () => {
  assert.equal(styleForType('Melomel', 'beer'), '');
  assert.equal(styleForType('Stout', 'beer'), 'Stout');
  assert.equal(styleForType('Session cyser', 'wine'), 'Session cyser');
  assert.equal(styleForType('Melomel', 'cider'), '');
  assert.equal(styleForType('Anything', 'other'), 'Anything');
});
