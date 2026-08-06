/**
 * Save/load a ProjectFile as downloadable JSON (not localStorage -- project
 * files are meant to be shared/reopened explicitly, per product spec §14).
 */
import { InvalidProjectFileError, parseProjectFile, type ProjectFile } from '@/domain/projectSchema';
import { withExtension } from '@/domain/filenameSanitize';

export function serializeProject(project: ProjectFile): string {
  return JSON.stringify(project, null, 2);
}

export function deserializeProject(text: string): ProjectFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidProjectFileError('not valid JSON');
  }
  return parseProjectFile(json);
}

export function projectFilename(projectName: string): string {
  return withExtension(`${projectName}-project`, 'json');
}
