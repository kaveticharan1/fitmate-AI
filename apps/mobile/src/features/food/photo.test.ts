import { analyzePhoto, preparePhoto } from './photo';

const mockDeleted: string[] = [];
jest.mock('expo-file-system', () => ({
  File: class {
    mockUri: string;
    constructor(mockPath: string) {
      this.mockUri = mockPath;
    }
    get exists() {
      return true;
    }
    delete() {
      mockDeleted.push(this.mockUri);
    }
  },
}));
const mockResize = jest.fn();
const mockSaveOpts = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: (o: unknown) => {
        mockResize(o);
        return {
          renderAsync: async () => ({
            saveAsync: async (o2: unknown) => {
              mockSaveOpts(o2);
              return { uri: 'file:///cache/small.jpg', base64: 'SMALLJPEG' };
            },
          }),
        };
      },
    }),
  },
}));
let mockConsent = true;
jest.mock('../../db/repositories', () => ({ hasConsent: () => mockConsent, getProfile: () => ({ aiLanguage: 'te' }) }));
let mockKey: { apiKey: string; model: string; fallbacks?: string[] } | null = { apiKey: 'K', model: 'gemini-3.6-flash', fallbacks: [] };
jest.mock('../coach/aiKey', () => ({ getAiKey: async () => mockKey }));

const fetchMock = jest.fn();
beforeEach(() => {
  mockDeleted.length = 0;
  mockConsent = true;
  mockKey = { apiKey: 'K', model: 'gemini-3.6-flash', fallbacks: [] };
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('food photo service', () => {
  it('shrinks the photo and deletes both temporary files', async () => {
    expect(await preparePhoto('file:///cache/original.jpg')).toBe('SMALLJPEG');
    expect(mockResize).toHaveBeenCalledWith({ width: 1024 });
    expect(mockSaveOpts).toHaveBeenCalledWith({ compress: 0.6, format: 'jpeg', base64: true });
    expect(mockDeleted.sort()).toEqual(['file:///cache/original.jpg', 'file:///cache/small.jpg']);
  });

  it('sends the small photo with the key and Telugu note language', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"items":[],"confidence":"low","note":"ఆహారం కనబడలేదు"}' }] } }] }),
    });
    const e = await analyzePhoto('file:///cache/original.jpg');
    expect(e.note).toBe('ఆహారం కనబడలేదు');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['x-goog-api-key']).toBe('K');
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0].inlineData.data).toBe('SMALLJPEG');
    expect(body.contents[0].parts[1].text).toContain('simple Telugu');
  });

  it('refuses without the AI coach', async () => {
    mockConsent = false;
    await expect(analyzePhoto('file:///x.jpg')).rejects.toMatchObject({ kind: 'invalid_key' });
    mockConsent = true;
    mockKey = null;
    await expect(analyzePhoto('file:///x.jpg')).rejects.toMatchObject({ kind: 'invalid_key' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
