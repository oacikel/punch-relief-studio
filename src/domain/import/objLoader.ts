/**
 * OBJ (+ optional MTL + local textures) import that never fetches a remote
 * resource. Builds a filename -> blob: URL map from exactly the files the
 * user supplied (drag-drop or file picker), and installs a
 * THREE.LoadingManager with setURLModifier that resolves only against that
 * map -- any absolute http(s) URL or unmatched filename throws instead of
 * reaching fetch(). See docs/DECISIONS.md and docs/PLAN_REVIEW.md.
 */
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export class MalformedObjError extends Error {
  constructor(filename: string, cause: unknown) {
    super(`Couldn't parse "${filename}" as OBJ. The file may be corrupted or not actually OBJ.`);
    this.name = 'MalformedObjError';
    this.cause = cause;
  }
}

export class RemoteAssetBlockedError extends Error {
  constructor(requested: string) {
    super(
      `Refused to load "${requested}": Punch Relief Studio never fetches remote assets. ` +
        'Drag in the referenced file alongside the OBJ/MTL to use it.',
    );
    this.name = 'RemoteAssetBlockedError';
  }
}

interface LocalAssetMap {
  get(basename: string): string | undefined;
}

/** Build a case-insensitive basename -> blob URL map from user-supplied
 * files. Caller is responsible for revoking the returned URLs when done. */
export function buildLocalAssetMap(files: File[]): { map: LocalAssetMap; urls: string[] } {
  const table = new Map<string, string>();
  const urls: string[] = [];
  for (const file of files) {
    const url = URL.createObjectURL(file);
    urls.push(url);
    table.set(file.name.toLowerCase(), url);
  }
  return {
    map: { get: (basename: string) => table.get(basename.toLowerCase()) },
    urls,
  };
}

export function localOnlyManager(assetMap: LocalAssetMap): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url: string) => {
    if (url.startsWith('blob:')) return url; // already resolved
    if (/^[a-z]+:\/\//i.test(url)) throw new RemoteAssetBlockedError(url);
    const basename = url.split('/').pop() ?? url;
    const resolved = assetMap.get(basename);
    if (!resolved) throw new RemoteAssetBlockedError(basename);
    return resolved;
  });
  return manager;
}

export interface ObjImportResult {
  object: THREE.Group;
  warnings: string[];
}

export async function parseObjWithAssets(objFile: File, siblingFiles: File[]): Promise<ObjImportResult> {
  const warnings: string[] = [];
  const { map, urls } = buildLocalAssetMap(siblingFiles);
  const manager = localOnlyManager(map);

  try {
    const objText = await objFile.text();
    const mtlFile = siblingFiles.find((f) => f.name.toLowerCase().endsWith('.mtl'));

    let materials: ReturnType<MTLLoader['parse']> | undefined;
    if (mtlFile) {
      try {
        const mtlText = await mtlFile.text();
        const mtlLoader = new MTLLoader(manager);
        materials = mtlLoader.parse(mtlText, '');
        materials.preload();
      } catch (err) {
        warnings.push(
          `Ignored materials in "${mtlFile.name}" (couldn't be parsed): ${(err as Error).message}`,
        );
        materials = undefined;
      }
    } else {
      warnings.push('No matching .mtl file was provided -- the model will use a single default color.');
    }

    const objLoader = new OBJLoader(manager);
    if (materials) objLoader.setMaterials(materials);
    let object: THREE.Group;
    try {
      object = objLoader.parse(objText);
    } catch (err) {
      throw new MalformedObjError(objFile.name, err);
    }

    let vertexCount = 0;
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        vertexCount += child.geometry.getAttribute('position')?.count ?? 0;
      }
    });
    if (vertexCount === 0) {
      throw new MalformedObjError(objFile.name, new Error('zero vertices after parse'));
    }

    return { object, warnings };
  } finally {
    for (const url of urls) URL.revokeObjectURL(url);
  }
}
