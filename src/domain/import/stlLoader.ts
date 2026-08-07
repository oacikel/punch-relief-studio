/**
 * Thin wrapper around three.js's STLLoader for both binary and ASCII STL.
 * No network access is possible here by construction -- STLLoader.parse()
 * only ever reads the ArrayBuffer we hand it.
 */
import type * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export class MalformedStlError extends Error {
  constructor(filename: string, cause: unknown) {
    super(`Couldn't parse "${filename}" as STL. The file may be corrupted or not actually STL.`);
    this.name = 'MalformedStlError';
    this.cause = cause;
  }
}

export async function parseStlFile(file: File): Promise<THREE.BufferGeometry> {
  const buffer = await file.arrayBuffer();
  const loader = new STLLoader();
  try {
    const geometry = loader.parse(buffer);
    if (geometry.getAttribute('position').count === 0) {
      throw new Error('parsed geometry has zero vertices');
    }
    return geometry;
  } catch (err) {
    throw new MalformedStlError(file.name, err);
  }
}
