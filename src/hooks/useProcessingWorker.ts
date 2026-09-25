/**
 * React hook wrapping the height/color processing Web Worker. Keeps the
 * worker's message-passing plumbing out of components -- components just
 * call `process(...)` and await a typed result.
 */
import { useCallback, useEffect, useRef } from 'react';
import type {
  ProcessErrorResponse,
  ProcessImageRequest,
  ProcessRequest,
  ProcessResponse,
} from '@/workers/processing.worker';
import type { NeedleGeometry } from '@/domain/pattern/needleGeometry';
import type { ReliefSettings } from '@/domain/types';

export interface ProcessArgs {
  depth: Float32Array;
  width: number;
  height: number;
  emptyValue: number;
  settings: ReliefSettings;
  needleGeometry: NeedleGeometry;
  patternDimensions: { widthCm: number; heightCm: number };
  color?: { data: Uint8ClampedArray; channels: 3 | 4; paletteSize: number; seed: number };
}

export type ImageProcessArgs = Omit<ProcessImageRequest, 'type' | 'requestId'>;

export function useProcessingWorker(): {
  process: (args: ProcessArgs) => Promise<ProcessResponse>;
  processImage: (args: ImageProcessArgs) => Promise<ProcessResponse>;
} {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(
    new Map<string, { resolve: (r: ProcessResponse) => void; reject: (e: Error) => void }>(),
  );

  useEffect(() => {
    const worker = new Worker(new URL('../workers/processing.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<ProcessResponse | ProcessErrorResponse>) => {
      const msg = event.data;
      const entry = pending.current.get(msg.requestId);
      if (!entry) return;
      pending.current.delete(msg.requestId);
      if (msg.type === 'error') entry.reject(new Error(msg.message));
      else entry.resolve(msg);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const process = useCallback((args: ProcessArgs): Promise<ProcessResponse> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('Processing worker is not ready yet.'));
        return;
      }
      const requestId = crypto.randomUUID();
      pending.current.set(requestId, { resolve, reject });
      const request: ProcessRequest = { type: 'process', requestId, ...args };
      worker.postMessage(request, [request.depth.buffer]);
    });
  }, []);

  const processImage = useCallback((args: ImageProcessArgs): Promise<ProcessResponse> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('Processing worker is not ready yet.'));
        return;
      }
      const requestId = crypto.randomUUID();
      pending.current.set(requestId, { resolve, reject });
      const rgba = args.rgba.slice();
      const request: ProcessImageRequest = {
        type: 'process-image',
        requestId,
        ...args,
        rgba,
      };
      worker.postMessage(request, [rgba.buffer]);
    });
  }, []);

  return { process, processImage };
}
