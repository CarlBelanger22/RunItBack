import { Team, Tournament, Game } from '../App';

const STORAGE_KEY = 'runitback-data';
const STORAGE_VERSION = '1.0.0';

interface StoredData {
  version: string;
  teams: Team[];
  tournaments: Tournament[];
  games: Game[];
  preferences?: {
    darkMode?: boolean;
  };
}

/**
 * Loads data from localStorage
 * Returns null if no data exists or if there's an error
 */
export function loadFromStorage(): StoredData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const data = JSON.parse(stored) as StoredData;
    
    // Validate that we have the expected structure
    if (!data.teams || !data.tournaments || !data.games) {
      console.warn('Invalid data structure in localStorage, clearing...');
      clearStorage();
      return null;
    }

    // Validate arrays are actually arrays
    if (!Array.isArray(data.teams) || !Array.isArray(data.tournaments) || !Array.isArray(data.games)) {
      console.warn('Invalid data types in localStorage, clearing...');
      clearStorage();
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    // If JSON parsing fails, clear corrupted data
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore errors during cleanup
    }
    return null;
  }
}

/**
 * Saves data to localStorage
 */
export function saveToStorage(
  teams: Team[],
  tournaments: Tournament[],
  games: Game[],
  preferences?: { darkMode?: boolean }
): void {
  try {
    const data: StoredData = {
      version: STORAGE_VERSION,
      teams,
      tournaments,
      games,
      preferences,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Consider clearing old data.');
      // Show user-friendly warning
      const size = getStorageSize();
      const sizeMB = (size / (1024 * 1024)).toFixed(2);
      alert(`Storage is full (${sizeMB}MB used). Please clear some old games or contact support.`);
    }
  }
}

/**
 * Clears all stored data
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

/**
 * Gets the storage size in bytes (approximate)
 */
export function getStorageSize(): number {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? new Blob([data]).size : 0;
  } catch {
    return 0;
  }
}

/**
 * Checks if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

