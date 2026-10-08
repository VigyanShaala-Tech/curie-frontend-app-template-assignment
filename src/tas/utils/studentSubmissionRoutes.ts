import { matchPath } from 'react-router-dom';

const STUDENT_SUBMISSION_PATHS = [
  '/submission/:usageKey',
  '/submission/:usageKey/history',
  '/submission/:usageKey/history/:version',
];

export function isStudentSubmissionRoute(pathname: string): boolean {
  return STUDENT_SUBMISSION_PATHS.some((path) => Boolean(matchPath({ path, end: true }, pathname)));
}
