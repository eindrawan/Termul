import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { ConnectionProfile, TransferItem, Bookmark, TerminalBookmark } from '../../renderer/types'

export class DatabaseService {
  private db: Database.Database

  constructor() {
    const dbPath = join(app.getPath('userData'), 'termul.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.initializeTables()
  }

  private initializeTables(): void {
    // Connection profiles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS connection_profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 22,
        username TEXT NOT NULL,
        auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'ssh-key', 'private-key')),
        key_path TEXT,
        password_id TEXT,
        passphrase TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Migration: Update auth_type from 'key' to 'ssh-key' for existing profiles
    // This needs to run immediately after the table is created
    try {
      this.db.exec(`UPDATE connection_profiles SET auth_type = 'ssh-key' WHERE auth_type = 'key'`)
    } catch (error) {
      // Migration already applied or no records to update
    }

    // Migration: Add passphrase column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE connection_profiles ADD COLUMN passphrase TEXT`)
    } catch (error) {
      // Column already exists
    }

    // Migration: Update the check constraint by recreating the table if needed
    // This handles the case where an old constraint still exists
    try {
      // Check if there's an old constraint by trying to insert an old value
      // If this fails, we need to recreate the table with the new constraint
      const testStmt = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='connection_profiles'");
      const result: any = testStmt.get();
      const tableSql = result?.sql || '';
      
      // If the old constraint still exists in the table definition, recreate the table
      if (tableSql.includes("CHECK (auth_type IN ('password', 'key'))")) {
        this.updateAuthTypeConstraint();
      }
    } catch (error) {
      console.error('Error checking table constraint:', error);
    }

    // Transfer queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_queue (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('upload', 'download')),
        size INTEGER,
        overwrite_policy TEXT NOT NULL DEFAULT 'prompt' CHECK (overwrite_policy IN ('prompt', 'overwrite', 'skip')),
        priority INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'failed', 'cancelled')),
        progress REAL NOT NULL DEFAULT 0.0,
        speed INTEGER,
        eta INTEGER,
        error TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        started_at INTEGER,
        completed_at INTEGER
      )
    `)

    // Known hosts table for SSH host key verification
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS known_hosts (
        host TEXT PRIMARY KEY,
        port INTEGER NOT NULL DEFAULT 22,
        algorithm TEXT NOT NULL,
        key_type TEXT NOT NULL,
        key_data TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        first_seen INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Connection paths table to store last visited paths
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS connection_paths (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        path_type TEXT NOT NULL CHECK (path_type IN ('local', 'remote')),
        path TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(connection_id, path_type)
      )
    `)

    // Bookmarks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        local_path TEXT NOT NULL,
        remote_path TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(profile_id, local_path, remote_path)
      )
    `)

    // Terminal bookmarks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS terminal_bookmarks (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        description TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(profile_id, name, command)
      )
    `)

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transfer_queue_status ON transfer_queue(status);
      CREATE INDEX IF NOT EXISTS idx_transfer_queue_created_at ON transfer_queue(created_at);
      CREATE INDEX IF NOT EXISTS idx_connection_profiles_updated_at ON connection_profiles(updated_at);
      CREATE INDEX IF NOT EXISTS idx_connection_paths_connection_id ON connection_paths(connection_id);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_profile_id ON bookmarks(profile_id);
      CREATE INDEX IF NOT EXISTS idx_terminal_bookmarks_profile_id ON terminal_bookmarks(profile_id);
    `)
  }

  async saveProfile(profile: ConnectionProfile): Promise<ConnectionProfile> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO connection_profiles
      (id, name, host, port, username, auth_type, key_path, password_id, passphrase, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `)

    const id = profile.id || this.generateId()
    stmt.run(
      id,
      profile.name,
      profile.host,
      profile.port,
      profile.username,
      profile.authType,
      profile.keyPath,
      profile.passwordId,
      profile.passphrase
    )

    return { ...profile, id }
  }

  async getProfiles(): Promise<ConnectionProfile[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM connection_profiles
      ORDER BY updated_at DESC, name ASC
    `)
    
    const profiles = stmt.all() as any[]
    
    return profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.auth_type as 'password' | 'ssh-key' | 'private-key',
      keyPath: profile.key_path || undefined,
      passwordId: profile.password_id || undefined,
      passphrase: profile.passphrase || undefined,
    }))
  }

  async deleteProfile(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM connection_profiles WHERE id = ?')
    stmt.run(id)
  }

  async getProfile(id: string): Promise<ConnectionProfile | null> {
    const stmt = this.db.prepare('SELECT * FROM connection_profiles WHERE id = ?')
    const profile = stmt.get(id) as any
    
    if (!profile) return null
    
    return {
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authType: profile.auth_type as 'password' | 'ssh-key' | 'private-key',
      keyPath: profile.key_path || undefined,
      passwordId: profile.password_id || undefined,
      passphrase: profile.passphrase || undefined,
    }
  }

  async enqueueTransfer(transfer: Omit<TransferItem, 'id' | 'createdAt' | 'startedAt' | 'completedAt'>): Promise<TransferItem> {
    const id = this.generateId()
    const now = Math.floor(Date.now() / 1000)

    const stmt = this.db.prepare(`
      INSERT INTO transfer_queue
      (id, connection_id, source_path, destination_path, direction, size, overwrite_policy, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      transfer.connectionId,
      transfer.sourcePath,
      transfer.destinationPath,
      transfer.direction,
      transfer.size,
      transfer.overwritePolicy,
      transfer.priority,
      transfer.status,
      now
    )

    return {
      ...transfer,
      id,
      createdAt: now,
    }
  }

  async getQueue(): Promise<TransferItem[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM transfer_queue
      ORDER BY priority DESC, created_at ASC
    `)

    const transfers = stmt.all() as any[]

    return transfers.map(transfer => ({
      id: transfer.id,
      connectionId: transfer.connection_id,
      sourcePath: transfer.source_path,
      destinationPath: transfer.destination_path,
      direction: transfer.direction as 'upload' | 'download',
      size: transfer.size,
      overwritePolicy: transfer.overwrite_policy as 'prompt' | 'overwrite' | 'skip',
      priority: transfer.priority,
      status: transfer.status as TransferItem['status'],
      progress: transfer.progress,
      speed: transfer.speed,
      eta: transfer.eta,
      error: transfer.error,
      createdAt: transfer.created_at,
      startedAt: transfer.started_at,
      completedAt: transfer.completed_at,
    }))
  }

  async updateTransfer(id: string, updates: Partial<TransferItem>): Promise<void> {
    const fields = []
    const values = []
    
    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    
    if (updates.progress !== undefined) {
      fields.push('progress = ?')
      values.push(updates.progress)
    }
    
    if (updates.speed !== undefined) {
      fields.push('speed = ?')
      values.push(updates.speed)
    }
    
    if (updates.eta !== undefined) {
      fields.push('eta = ?')
      values.push(updates.eta)
    }
    
    if (updates.error !== undefined) {
      fields.push('error = ?')
      values.push(updates.error)
    }
    
    if (updates.startedAt !== undefined) {
      fields.push('started_at = ?')
      values.push(updates.startedAt)
    }
    
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?')
      values.push(updates.completedAt)
    }
    
    if (fields.length === 0) return
    
    const stmt = this.db.prepare(`
      UPDATE transfer_queue
      SET ${fields.join(', ')}
      WHERE id = ?
    `)
    
    stmt.run(...values, id)
  }

  async removeTransfer(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM transfer_queue WHERE id = ?')
    stmt.run(id)
  }

  async clearTransferHistory(): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM transfer_queue')
    stmt.run()
  }

  async saveKnownHost(host: string, port: number, algorithm: string, keyType: string, keyData: string, fingerprint: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO known_hosts
      (host, port, algorithm, key_type, key_data, fingerprint, first_seen)
      VALUES (?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `)
    
    stmt.run(host, port, algorithm, keyType, keyData, fingerprint)
  }

  async getKnownHost(host: string, port: number): Promise<any> {
    const stmt = this.db.prepare('SELECT * FROM known_hosts WHERE host = ? AND port = ?')
    const knownHost = stmt.get(host, port)
    return knownHost
  }

  async saveConnectionPath(profileId: string, pathType: 'local' | 'remote', path: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO connection_paths
      (id, connection_id, path_type, path, updated_at)
      VALUES (?, ?, ?, ?, strftime('%s', 'now'))
    `)
    
    const id = `${profileId}-${pathType}`
    stmt.run(id, profileId, pathType, path)
  }

  async getConnectionPath(profileId: string, pathType: 'local' | 'remote'): Promise<string | null> {
    const stmt = this.db.prepare(`
      SELECT path FROM connection_paths
      WHERE connection_id = ? AND path_type = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `)
    
    const result = stmt.get(profileId, pathType) as any
    return result ? result.path : null
  }

  async getAllConnectionPaths(profileId: string): Promise<{ local?: string; remote?: string }> {
    const stmt = this.db.prepare(`
      SELECT path_type, path FROM connection_paths
      WHERE connection_id = ?
    `)
    
    const results = stmt.all(profileId) as any[]
    const paths: { local?: string; remote?: string } = {}
    
    results.forEach(result => {
      if (result.path_type === 'local') {
        paths.local = result.path
      } else if (result.path_type === 'remote') {
        paths.remote = result.path
      }
    })
    
    return paths
  }

  // Bookmark methods
  async saveBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO bookmarks
      (id, profile_id, name, local_path, remote_path, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `)

    const id = this.generateId()
    stmt.run(
      id,
      bookmark.profileId,
      bookmark.name,
      bookmark.localPath,
      bookmark.remotePath
    )

    return {
      ...bookmark,
      id,
      createdAt: Math.floor(Date.now() / 1000)
    }
  }

  async getBookmarks(profileId: string): Promise<Bookmark[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM bookmarks
      WHERE profile_id = ?
      ORDER BY created_at DESC
    `)
    
    const bookmarks = stmt.all(profileId) as any[]
    
    return bookmarks.map(bookmark => ({
      id: bookmark.id,
      profileId: bookmark.profile_id,
      name: bookmark.name,
      localPath: bookmark.local_path,
      remotePath: bookmark.remote_path,
      createdAt: bookmark.created_at,
    }))
  }

  async deleteBookmark(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM bookmarks WHERE id = ?')
    stmt.run(id)
  }

  async getBookmark(id: string): Promise<Bookmark | null> {
    const stmt = this.db.prepare('SELECT * FROM bookmarks WHERE id = ?')
    const bookmark = stmt.get(id) as any
    
    if (!bookmark) return null
    
    return {
      id: bookmark.id,
      profileId: bookmark.profile_id,
      name: bookmark.name,
      localPath: bookmark.local_path,
      remotePath: bookmark.remote_path,
      createdAt: bookmark.created_at,
    }
  }

  async bookmarkExists(profileId: string, localPath: string, remotePath: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM bookmarks
      WHERE profile_id = ? AND local_path = ? AND remote_path = ?
    `)
    
    const result = stmt.get(profileId, localPath, remotePath) as any
    return result.count > 0
  }

  // Terminal bookmark methods
  async saveTerminalBookmark(bookmark: Omit<TerminalBookmark, 'id' | 'createdAt'>): Promise<TerminalBookmark> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO terminal_bookmarks
      (id, profile_id, name, command, description, created_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
    `)

    const id = this.generateId()
    stmt.run(
      id,
      bookmark.profileId,
      bookmark.name,
      bookmark.command,
      bookmark.description || null
    )

    return {
      ...bookmark,
      id,
      createdAt: Math.floor(Date.now() / 1000)
    }
  }

  async getTerminalBookmarks(profileId: string): Promise<TerminalBookmark[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM terminal_bookmarks
      WHERE profile_id = ?
      ORDER BY created_at DESC
    `)
    
    const bookmarks = stmt.all(profileId) as any[]
    
    return bookmarks.map(bookmark => ({
      id: bookmark.id,
      profileId: bookmark.profile_id,
      name: bookmark.name,
      command: bookmark.command,
      description: bookmark.description,
      createdAt: bookmark.created_at,
    }))
  }

  async deleteTerminalBookmark(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM terminal_bookmarks WHERE id = ?')
    stmt.run(id)
  }

  async getTerminalBookmark(id: string): Promise<TerminalBookmark | null> {
    const stmt = this.db.prepare('SELECT * FROM terminal_bookmarks WHERE id = ?')
    const bookmark = stmt.get(id) as any
    
    if (!bookmark) return null
    
    return {
      id: bookmark.id,
      profileId: bookmark.profile_id,
      name: bookmark.name,
      command: bookmark.command,
      description: bookmark.description,
      createdAt: bookmark.created_at,
    }
  }

  async terminalBookmarkExists(profileId: string, name: string, command: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM terminal_bookmarks
      WHERE profile_id = ? AND name = ? AND command = ?
    `)
    
    const result = stmt.get(profileId, name, command) as any
    return result.count > 0
  }

  private updateAuthTypeConstraint(): void {
    // Since SQLite doesn't support ALTER TABLE to modify CHECK constraints,
    // we need to recreate the table with the new constraint
    try {
      // Begin transaction
      this.db.exec('BEGIN TRANSACTION');
      
      // Create a temporary table with the new structure
      this.db.exec(`
        CREATE TABLE connection_profiles_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          host TEXT NOT NULL,
          port INTEGER NOT NULL DEFAULT 22,
          username TEXT NOT NULL,
          auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'ssh-key', 'private-key')),
          key_path TEXT,
          password_id TEXT,
          passphrase TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
      
      // Copy data from old table to new table
      // Map old 'key' values to 'ssh-key' during the copy
      this.db.exec(`
        INSERT INTO connection_profiles_new
        SELECT
          id,
          name,
          host,
          port,
          username,
          CASE
            WHEN auth_type = 'key' THEN 'ssh-key'
            ELSE auth_type
          END as auth_type,
          key_path,
          password_id,
          passphrase,
          created_at,
          updated_at
        FROM connection_profiles
      `);
      
      // Drop the old table
      this.db.exec('DROP TABLE connection_profiles');
      
      // Rename the new table to the original name
      this.db.exec('ALTER TABLE connection_profiles_new RENAME TO connection_profiles');
      
      // Commit transaction
      this.db.exec('COMMIT');
    } catch (error) {
      // Rollback in case of error
      try {
        this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      console.error('Error updating auth type constraint:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  close(): void {
    this.db.close()
  }
}