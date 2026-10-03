import type { GeneralSettings, UpdateGeneralSettingsInput } from '../types/settings';
import { apiFetch } from './client';

export function getGeneralSettings(): Promise<GeneralSettings> {
  return apiFetch<GeneralSettings>('/settings/general');
}

export function updateGeneralSettings(
  input: UpdateGeneralSettingsInput,
): Promise<GeneralSettings> {
  return apiFetch<GeneralSettings>('/settings/general', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
