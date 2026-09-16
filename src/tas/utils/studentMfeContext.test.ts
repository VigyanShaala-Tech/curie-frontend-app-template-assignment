import { courseIdFromUsageKey } from './studentMfeContext';

describe('courseIdFromUsageKey', () => {
  it('strips the XBlock suffix without leaving a trailing plus', () => {
    expect(
      courseIdFromUsageKey(
        'block-v1:VigyanShaala+STEM101+2026_T3+type@tas+block@d1307edb223a40d384e18d52a5e9cdc0',
      ),
    ).toBe('course-v1:VigyanShaala+STEM101+2026_T3');
  });
});
