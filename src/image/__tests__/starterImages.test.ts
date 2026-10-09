import { afterEach, describe, expect, it, vi } from 'vitest';
import { TWO_D_STARTERS, createStarterImageFile, getTwoDStarterById } from '../starterImages';

function stubCanvasDrawing(): void {
  const fakeContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void,
  ) {
    callback(new Blob(['fake-png-bytes'], { type: 'image/png' }));
  });
}

describe('TWO_D_STARTERS', () => {
  it('lists at least three code-generated starters with names and ids', () => {
    expect(TWO_D_STARTERS.length).toBeGreaterThanOrEqual(3);
    for (const starter of TWO_D_STARTERS) {
      expect(starter.id).toMatch(/^starter-/);
      expect(starter.name.length).toBeGreaterThan(0);
      expect(typeof starter.draw).toBe('function');
    }
  });

  it('looks up a starter by id', () => {
    const first = TWO_D_STARTERS[0];
    expect(first).toBeDefined();
    expect(getTwoDStarterById(first!.id)).toBe(first);
    expect(getTwoDStarterById('nope')).toBeUndefined();
  });
});

describe('createStarterImageFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the starter pattern into a PNG File', async () => {
    stubCanvasDrawing();
    const starter = TWO_D_STARTERS[0];
    expect(starter).toBeDefined();
    const file = await createStarterImageFile(starter!, 64);
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('image/png');
    expect(file.name).toBe(`${starter!.id}.png`);
  });

  it('raises a friendly error when the browser has no 2D canvas context', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const starter = TWO_D_STARTERS[0];
    expect(starter).toBeDefined();
    await expect(createStarterImageFile(starter!, 64)).rejects.toThrow(/could not render/i);
  });
});
