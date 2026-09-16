import fs from 'fs';
import path from 'path';

describe('desktop CURIE review pane split', () => {
  const scss = fs.readFileSync(
    path.join(__dirname, '../../index.scss'),
    'utf8',
  );

  it('lets both halves shrink so feedback is not crushed by worksheet width', () => {
    const left = scss.match(/\.curie-half-left \{([^}]+)\}/);
    const right = scss.match(/\.curie-half-right \{([^}]+)\}/);
    expect(left?.[1]).toMatch(/min-width:\s*0/);
    expect(left?.[1]).toMatch(/flex:\s*1 1 0/);
    expect(right?.[1]).toMatch(/min-width:\s*0/);
    expect(right?.[1]).toMatch(/flex:\s*1 1 0/);
  });

  it('does not clip the mobile worksheet with overflow hidden', () => {
    expect(scss).toMatch(
      /@media \(width >= 768px\)[\s\S]*?\.curie-left-scroll:has\(\.tas-template-canvas--fit-pane\) \{[^}]*overflow:\s*hidden/,
    );
    const mobileBlock = scss.match(/@media \(width <= 767\.98px\) \{([\s\S]*)$/);
    expect(mobileBlock?.[1]).toMatch(
      /\.curie-left-scroll:has\(\.tas-template-canvas--fit-pane\) \{[^}]*overflow-y:\s*auto/,
    );
  });
});
