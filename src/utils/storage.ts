import { LevelData } from '../types';

const STORAGE_KEY = 'battle-city-custom-maps';

export function saveCustomMaps(maps: LevelData[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
}

export function loadCustomMaps(): LevelData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Corrupted data, reset
  }
  return [];
}

export function exportMap(map: LevelData): void {
  const json = JSON.stringify(map, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${map.name || 'custom-map'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importMap(): Promise<LevelData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          resolve(data as LevelData);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
