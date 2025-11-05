import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { ConnectionProfile, TransferItem } from '../../renderer/types'

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
        auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'key')),
        key_path TEXT,
        password_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Transfer queue table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transfer_queue (
        id TEXT PRIMARY KEY,
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

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transfer_queue_status ON transfer_queue(status);
      CREATE INDEX IF NOT EXISTS idx_transfer_queue_created_at ON transfer_queue(created_at);
      CREATE INDEX IF NOT EXISTS idx_connection_profiles_updated_at ON connection_profiles(updated_at);
    `)
  }

  async saveProfile(profile: ConnectionProfile): Promise<ConnectionProfile> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO connection_profiles
      (id, name, host, port, username, auth_type, key_path, password_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
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
      profile.passwordId
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
      authType: profile.auth_type as 'password' | 'key',
      keyPath: profile.key_path || undefined,
      passwordId: profile.password_id || undefined,
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
      authType: profile.auth_type as 'password' | 'key',
      keyPath: profile.key_path || undefined,
      passwordId: profile.password_id || undefined,
    }
  }

  async enqueueTransfer(transfer: Omit<TransferItem, 'id' | 'createdAt' | 'startedAt' | 'completedAt'>): Promise<TransferItem> {
    const id = this.generateId()
    const now = Math.floor(Date.now() / 1000)
    
    const stmt = this.db.prepare(`
      INSERT INTO transfer_queue
      (id, source_path, destination_path, direction, size, overwrite_policy, priority, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    stmt.run(
      id,
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

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  close(): void {
    this.db.close()
  }
}