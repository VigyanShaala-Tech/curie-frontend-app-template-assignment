import { loadOwnedSubmission } from './ownedSubmission';

jest.mock('./api', () => ({
  blockTemplatesApi: {
    list: jest.fn(),
  },
  submissionsApi: {
    createOrGetDraft: jest.fn(),
  },
  templatesApi: {},
}));

const { blockTemplatesApi, submissionsApi } = jest.requireMock('./api');

describe('loadOwnedSubmission', () => {
  it('uses the TemplateBlock course_id instead of a derived context id', async () => {
    blockTemplatesApi.list.mockResolvedValue({
      usage_key: 'block-v1:VigyanShaala+STEM101+2026_T3+type@tas+block@demo',
      course_id: 'course-v1:VigyanShaala+STEM101+2026_T3',
      templates: [{ template_block_id: 1, template: { id: '1' } }],
    });
    submissionsApi.createOrGetDraft.mockResolvedValue({ id: '5' });

    await loadOwnedSubmission({
      usageKey: 'block-v1:VigyanShaala+STEM101+2026_T3+type@tas+block@demo',
      courseId: 'course-v1:VigyanShaala+STEM101+2026_T3+',
      studentId: 'student_curie_reject2',
      isStaff: false,
      isInstructor: false,
    });

    expect(submissionsApi.createOrGetDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        course_id: 'course-v1:VigyanShaala+STEM101+2026_T3',
      }),
    );
  });
});
