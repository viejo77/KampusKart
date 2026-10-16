import { CardTemplate, PdfExportSettings, StudentRecord } from '../types';

export interface AppPersistedState {
  version: number;
  savedAt: string;
  students: StudentRecord[];
  photoPoolEntries: [string, { dataUrl: string; fileName: string }][];
  templates: CardTemplate[];
  activeTemplateId: string;
  visitorTemplate: CardTemplate;
  staffTemplate: CardTemplate;
  globalSchoolLine1: string;
  globalSchoolLine2: string;
  globalAcademicYear: string;
  visitorSettings: {
    count: number;
    prefix: string;
    title: string;
    subtitle: string;
    pattern: string;
  };
  staffSettings: {
    count: number;
    prefix: string;
    title: string;
    subtitle: string;
    pattern: string;
  };
  pdfSettings: PdfExportSettings;
}

const DB_NAME = 'kampuskart_local_db_v1';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';
const RECORD_KEY = 'root_state';
const LOCAL_STORAGE_KEY = 'kampuskart_backup_state_v1';

// Open or initialize IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Save app state to persistent storage (IndexedDB with LocalStorage fallback)
 */
export async function saveAppState(state: AppPersistedState): Promise<boolean> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const putRequest = store.put(state, RECORD_KEY);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    // Also attempt saving a lightweight copy or mirror to localStorage if possible
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY + '_meta',
        JSON.stringify({
          savedAt: state.savedAt,
          studentsCount: state.students.length,
          activeTemplateId: state.activeTemplateId,
        })
      );
    } catch {
      // Ignore localStorage quota errors
    }

    return true;
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to localStorage:', err);
    try {
      // Fallback to localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (localStorageErr) {
      console.error('All storage attempts failed:', localStorageErr);
      return false;
    }
  }
}

/**
 * Load persisted app state from storage
 */
export async function loadAppState(): Promise<AppPersistedState | null> {
  try {
    const db = await openDatabase();
    const data = await new Promise<AppPersistedState | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(RECORD_KEY);

      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });

    if (data && Array.isArray(data.students)) {
      return data;
    }
  } catch (err) {
    console.warn('IndexedDB load failed, attempting localStorage fallback:', err);
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local) as AppPersistedState;
      if (parsed && Array.isArray(parsed.students)) {
        return parsed;
      }
    }
  } catch (parseErr) {
    console.error('Failed to parse localStorage fallback data:', parseErr);
  }

  return null;
}

/**
 * Clear stored state completely
 */
export async function clearAppState(): Promise<boolean> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const delRequest = store.delete(RECORD_KEY);
      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch (err) {
    console.warn('Failed to clear IndexedDB:', err);
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_KEY + '_meta');
    return true;
  } catch {
    return false;
  }
}

/**
 * Download a full JSON backup file of all students, templates, and settings
 */
export function downloadBackupFile(state: AppPersistedState, customName?: string): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customName || `kampuskart_tam_yedek_${dateStr}.json`;
  const jsonContent = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded JSON backup file
 */
export function parseBackupFile(file: File): Promise<AppPersistedState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as AppPersistedState;
        if (!parsed || !Array.isArray(parsed.students)) {
          throw new Error('Geçersiz yedek dosyası: Öğrenci listesi bulunamadı.');
        }
        resolve(parsed);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Dosya okunamadı veya bozuk.'));
      }
    };
    reader.onerror = () => reject(new Error('Dosya yüklenirken hata oluştu.'));
    reader.readAsText(file);
  });
}
