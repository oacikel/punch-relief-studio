import type { CalibrationProfile } from '@/domain/calibration';
import { withExtension } from '@/domain/filenameSanitize';
import { downloadJson } from './download';

export function exportCalibrationProfile(profile: CalibrationProfile): void {
  downloadJson(profile, withExtension(profile.profileName, 'json'));
}
