import { isStudentSubmissionRoute } from './studentSubmissionRoutes';

describe('isStudentSubmissionRoute', () => {
  it.each([
    '/submission/block-v1%3Atest',
    '/submission/block-v1%3Atest/history',
    '/submission/block-v1%3Atest/history/2',
  ])('matches student assignment route %s', (pathname) => {
    expect(isStudentSubmissionRoute(pathname)).toBe(true);
  });

  it('does not match instructor or admin routes', () => {
    expect(isStudentSubmissionRoute('/instructor/grade-submissions/block-v1%3Atest')).toBe(false);
    expect(isStudentSubmissionRoute('/admin/templates')).toBe(false);
  });
});
