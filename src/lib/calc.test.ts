import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abv, attenuation, brixToSg, cToF, daysBetween, fToC, gallonsToLiters, litersToGallons, sgToBrix } from './calc.ts';

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('abv uses the standard (OG - FG) x 131.25 formula', () => {
  near(abv(1.1, 1.0), 13.125, 1e-9);
  near(abv(1.12, 1.01), 14.4375, 1e-9);
});

test('abv never goes negative', () => {
  assert.equal(abv(1.0, 1.02), 0);
});

test('attenuation is the share of sugar fermented', () => {
  near(attenuation(1.1, 1.0), 100, 1e-9);
  near(attenuation(1.1, 1.05), 50, 1e-9);
  assert.equal(attenuation(1.0, 1.0), 0);
});

test('Brix and SG convert both ways', () => {
  near(sgToBrix(1.04), 10, 0.05);
  near(sgToBrix(1.1), 23.8, 0.1);
  near(brixToSg(10), 1.04, 0.0005);
  near(brixToSg(sgToBrix(1.085)), 1.085, 0.0005);
});

test('volume and temperature conversions round-trip', () => {
  near(gallonsToLiters(1), 3.785, 0.001);
  near(litersToGallons(gallonsToLiters(5)), 5, 1e-9);
  assert.equal(cToF(20), 68);
  near(fToC(68), 20, 1e-9);
});

test('daysBetween counts whole days and never goes negative', () => {
  assert.equal(daysBetween('2026-11-01', '2026-11-15'), 14);
  assert.equal(daysBetween('2026-11-01', '2026-11-01T23:30:00Z'), 0);
  assert.equal(daysBetween('2026-11-15', '2026-11-01'), 0);
});
