import {
  sumCategoryMarks,
  validateCategoryMarks,
  hasInvalidCategoryMarks,
} from './rubricMarksValidation';
import type { RubricOption } from '../types';

const options = (marks: number[]): RubricOption[] => marks.map((m, i) => ({ name: `Criteria ${i + 1}`, marks: m }));

describe('rubricMarksValidation', () => {
  it('sums criteria marks for a category', () => {
    expect(sumCategoryMarks(options([4, 3, 3]))).toBe(10);
    expect(sumCategoryMarks(options([5, 2]))).toBe(7);
  });

  it('passes when total equals 10', () => {
    const result = validateCategoryMarks(options([4, 3, 3]));
    expect(result.isValid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.total).toBe(10);
  });

  it('fails when total exceeds 10', () => {
    const result = validateCategoryMarks(options([6, 5]));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('The total marks for this category cannot exceed 10.');
    expect(result.total).toBe(11);
  });

  it('fails when total is less than 10', () => {
    const result = validateCategoryMarks(options([4, 3]));
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('The total marks for this category must equal 10. Current total: 7 / 10.');
    expect(result.total).toBe(7);
  });

  it('detects invalid categories across a rubric', () => {
    expect(hasInvalidCategoryMarks([
      { options: options([5, 5]) },
      { options: options([4, 3]) },
    ])).toBe(true);
    expect(hasInvalidCategoryMarks([
      { options: options([5, 5]) },
      { options: options([4, 3, 3]) },
    ])).toBe(false);
  });
});
