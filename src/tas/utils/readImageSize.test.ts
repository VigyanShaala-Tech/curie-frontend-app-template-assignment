import { readImageSize } from './readImageSize';

describe('readImageSize', () => {
  const originalImage = global.Image;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  afterEach(() => {
    global.Image = originalImage;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('resolves the file pixel size and a preview url', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:preview');
    URL.revokeObjectURL = jest.fn();
    class FakeImage {
      naturalWidth = 800;

      naturalHeight = 3369;

      onload: (() => void) | null = null;

      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }
    global.Image = FakeImage as unknown as typeof Image;

    const file = new File(['x'], 'template.png', { type: 'image/png' });
    await expect(readImageSize(file)).resolves.toEqual({
      width: 800,
      height: 3369,
      url: 'blob:preview',
    });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('rejects and revokes the preview url when the file is not an image', async () => {
    URL.createObjectURL = jest.fn(() => 'blob:bad');
    URL.revokeObjectURL = jest.fn();
    class FakeImage {
      naturalWidth = 0;

      naturalHeight = 0;

      onload: (() => void) | null = null;

      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onerror?.();
      }
    }
    global.Image = FakeImage as unknown as typeof Image;

    const file = new File(['x'], 'notes.txt', { type: 'text/plain' });
    await expect(readImageSize(file)).rejects.toThrow('Could not read the template image size.');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bad');
  });
});
