import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAVORS } from './flavors.ts';
import { FLAVOR_COLORS, colorOf, getFlavor, joinIcon, splitIcon } from './flavorColors.ts';
import { suggestFromIcon } from '../lib/suggest.ts';

test('splitIcon and joinIcon: a flavor in its own color is saved as just the flavor', () => {
  assert.deepEqual(splitIcon('apple~red'), { flavorId: 'apple', colorId: 'red' });
  assert.deepEqual(splitIcon('apple'), { flavorId: 'apple', colorId: null });
  assert.equal(joinIcon('apple', 'red'), 'apple~red');
  assert.equal(joinIcon('apple', 'green'), 'apple');
  assert.equal(joinIcon('strawberry', null), 'strawberry');
});

test('getFlavor draws a color: its label, fills and, for Traditional, liquid and style', () => {
  const red = getFlavor('apple~red');
  assert.equal(red.label, 'Red apple');
  assert.ok(red.body.includes('#D8343B') && !red.body.includes('#9BC53D'));
  assert.equal(red.color, getFlavor('apple').color, 'a fruit color keeps the liquid color');
  const bochet = getFlavor('traditional~bochet');
  assert.deepEqual([bochet.label, bochet.style, bochet.color], ['Bochet', 'Bochet', '#6E3B1A']);
  assert.equal(getFlavor('traditional~pale').label, 'Pale traditional');
  assert.equal(getFlavor('apple~red'), red, 'drawn once and kept');
  assert.equal(getFlavor('apple').label, 'Green apple', 'a flavor with colors names its own');
  assert.equal(getFlavor('traditional').label, 'Traditional');
  assert.equal(getFlavor('strawberry').label, 'Strawberry');
});

test('getFlavor: an unknown color is the flavor itself, an unknown flavor is Traditional', () => {
  assert.equal(getFlavor('apple~blue'), getFlavor('apple'));
  assert.equal(getFlavor('apple~blue').body, FLAVORS.find((f) => f.id === 'apple')!.body);
  assert.equal(getFlavor('strawberry~red'), getFlavor('strawberry'));
  assert.equal(getFlavor('nope~red').id, 'traditional');
  assert.equal(colorOf('strawberry'), null);
  assert.equal(colorOf('apple')?.id, 'green');
});

test('every color swaps fills that are in its drawing, and the first color is the drawing as is', () => {
  for (const [flavorId, colors] of Object.entries(FLAVOR_COLORS)) {
    const flavor = FLAVORS.find((f) => f.id === flavorId);
    assert.ok(flavor, flavorId + ' is a flavor');
    assert.deepEqual(colors[0].swap, {}, flavorId + ': the first color is its own');
    for (const c of colors.slice(1)) {
      for (const from of Object.keys(c.swap)) assert.ok(flavor.body.includes(from), `${flavorId}~${c.id}: ${from} is in the drawing`);
    }
  }
});

test('suggestions: a fruit color keeps the fruit name; a bochet suggests a Bochet', () => {
  assert.deepEqual(suggestFromIcon('apple~red', 'mead', ''), { name: 'Apple Cyser', style: 'Cyser' });
  assert.deepEqual(suggestFromIcon('traditional~bochet', 'mead', ''), { name: 'Bochet Mead', style: 'Bochet' });
  assert.deepEqual(suggestFromIcon('traditional~amber', 'mead', ''), { name: 'Traditional Mead', style: 'Traditional' });
});
