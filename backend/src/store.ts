import sqlite from 'sqlite'

export const ErrorNoRecordFound = new Error("no record found")
export const ErrorMaxIdsReached = new Error("database unique limit of IDs reached")

export class ShareStore {
  private db!: sqlite.Database
  static maxLength = 5
  async init(dbPath: string): Promise<void> {
    this.db = await sqlite.open(dbPath);
    await this.db.run(`CREATE TABLE IF NOT EXISTS shares (id TEXT NOT NULL PRIMARY KEY, code TEXT UNIQUE)`)
  }
  async close(): Promise<void> {
    return this.db.close()
  }
  async get(id: string): Promise<string | null> {
    const rows = await this.db.get('SELECT code FROM shares WHERE id = ?', id)
    if (!rows) {
      throw ErrorNoRecordFound
    }
    return rows.code
  }
  async set(code: string): Promise<string> {
    const rows = await this.db.get('SELECT id FROM shares WHERE code = ?', code)
    if (rows) {
      return rows.id
    }
    let retryCount = 0
    while (retryCount <= 3) {
      try {
        const key = ShareStore.getRandomID()
        await this.db.run("INSERT INTO shares(id, code) VALUES(?, ?)", [key, code])
        return key
      } catch (err) {
        console.log(`Could not set an ID, retry number: ${retryCount}`, err)
      }
      retryCount++
    }
    throw ErrorMaxIdsReached
  }
  static getRandomID(): string {
    return [...Array(ShareStore.maxLength)].map(() => Math.random().toString(36)[2]).join('')
  }
}