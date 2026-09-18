import { describe, expect, it } from 'vitest';
import { parsePhrase } from './phrase.js';

describe('parsePhrase (5.3)', () => {
  it('extracts counts', () => {
    expect(parsePhrase('2 eggs')).toEqual({ original: '2 eggs', quantity: { amount: '2', unit: 'count' }, query: 'eggs' });
    expect(parsePhrase('2 Sam Adams Octoberfest')).toMatchObject({ quantity: { amount: '2', unit: 'count' }, query: 'Sam Adams Octoberfest' });
  });

  it('understands fractions and words', () => {
    expect(parsePhrase('half my shake')).toMatchObject({ quantity: { amount: '0.5', unit: 'count' }, query: 'my shake' });
    expect(parsePhrase('1/2 my shake')).toMatchObject({ quantity: { amount: '0.5', unit: 'count' } });
    expect(parsePhrase('½ banana')).toMatchObject({ quantity: { amount: '0.5', unit: 'count' }, query: 'banana' });
    expect(parsePhrase('1½ cups oats')).toMatchObject({ quantity: { amount: '1.5', unit: 'count' }, query: 'cups oats' });
    expect(parsePhrase('two beers')).toMatchObject({ quantity: { amount: '2', unit: 'count' }, query: 'beers' });
    expect(parsePhrase('a banana')).toMatchObject({ quantity: { amount: '1', unit: 'count' }, query: 'banana' });
  });

  it('understands mass, volume and servings', () => {
    expect(parsePhrase('150 g chicken')).toMatchObject({ quantity: { amount: '150', unit: 'g' }, query: 'chicken' });
    expect(parsePhrase('150g chicken')).toMatchObject({ quantity: { amount: '150', unit: 'g' }, query: 'chicken' });
    expect(parsePhrase('3 oz turkey')).toMatchObject({ quantity: { amount: '3', unit: 'oz' }, query: 'turkey' });
    expect(parsePhrase('8 fl oz milk')).toMatchObject({ quantity: { amount: '8', unit: 'floz' }, query: 'milk' });
    expect(parsePhrase('250 ml milk')).toMatchObject({ quantity: { amount: '250', unit: 'ml' }, query: 'milk' });
    expect(parsePhrase('1.5 servings of oats')).toMatchObject({ quantity: { amount: '1.5', unit: 'serving' }, query: 'oats' });
  });

  it('leaves text alone when there is no leading quantity', () => {
    expect(parsePhrase('my shake')).toEqual({ original: 'my shake', query: 'my shake' });
    expect(parsePhrase('eggs 2')).toEqual({ original: 'eggs 2', query: 'eggs 2' });
    expect(parsePhrase('2')).toEqual({ original: '2', query: '2' });
    expect(parsePhrase('   ')).toEqual({ original: '   ', query: '' });
  });
});
