import * as odd from '@oddjs/odd'

export type BackupStatus = {
  created: boolean | null
}

export const getBackupStatus = async (fs: odd.FileSystem): Promise<BackupStatus> => {
  try {
    // Check if the required methods exist
    if ((fs as any).exists && odd.path && (odd.path as any).backups) {
      const backupStatus = await (fs as any).exists((odd.path as any).backups());
      return { created: backupStatus };
    }
    
    // Fallback if methods don't exist
    console.warn('Backup methods not available in current ODD version');
    return { created: null };
  } catch (error) {
    console.error('Error checking backup status:', error);
    return { created: null };
  }
}