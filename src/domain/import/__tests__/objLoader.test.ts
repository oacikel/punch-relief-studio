import { describe, expect, it } from 'vitest';
import { RemoteAssetBlockedError, buildLocalAssetMap, localOnlyManager } from '../objLoader';

describe('buildLocalAssetMap', () => {
  it('maps filenames case-insensitively to blob URLs', () => {
    const file = new File(['data'], 'Texture.PNG');
    const { map, urls } = buildLocalAssetMap([file]);
    expect(map.get('texture.png')).toBeDefined();
    expect(urls).toHaveLength(1);
    for (const url of urls) URL.revokeObjectURL(url);
  });
});

describe('localOnlyManager URL resolution (security)', () => {
  it('resolves a matched local filename', () => {
    const file = new File(['data'], 'diffuse.jpg');
    const { map, urls } = buildLocalAssetMap([file]);
    const manager = localOnlyManager(map);
    const resolved = manager.resolveURL('diffuse.jpg');
    expect(resolved.startsWith('blob:')).toBe(true);
    for (const url of urls) URL.revokeObjectURL(url);
  });

  it('throws for a remote http(s) URL instead of resolving it', () => {
    const { map } = buildLocalAssetMap([]);
    const manager = localOnlyManager(map);
    expect(() => manager.resolveURL('https://example.com/texture.jpg')).toThrow(
      RemoteAssetBlockedError,
    );
  });

  it('throws for a filename that was not supplied by the user', () => {
    const { map } = buildLocalAssetMap([new File(['x'], 'a.jpg')]);
    const manager = localOnlyManager(map);
    expect(() => manager.resolveURL('b.jpg')).toThrow(RemoteAssetBlockedError);
  });

  it('passes through already-resolved blob: URLs unchanged', () => {
    const { map } = buildLocalAssetMap([]);
    const manager = localOnlyManager(map);
    const resolved = manager.resolveURL('blob:http://localhost/abc-123');
    expect(resolved).toBe('blob:http://localhost/abc-123');
  });

  it('throws for a protocol-relative URL', () => {
    const { map } = buildLocalAssetMap([]);
    const manager = localOnlyManager(map);
    expect(() => manager.resolveURL('//evil.example/texture.jpg')).toThrow(RemoteAssetBlockedError);
  });

  it('throws for a data: URI', () => {
    const { map } = buildLocalAssetMap([]);
    const manager = localOnlyManager(map);
    expect(() => manager.resolveURL('data:image/png;base64,AAAA')).toThrow(RemoteAssetBlockedError);
  });
});
