import type * as odd from '@oddjs/odd'

export type BackupStatus = {
  created: boolean | null
}

export const getBackupStatus = async (fs: odd.FileSystem): Promise<BackupStatus> => {
  try {
    const backupStatus = await fs.exists(odd.path.backups())
    return { created: backupStatus }
  } catch (error) {
    console.error('Error checking backup status:', error)
    return { created: null }
  }
}