import sqlite from 'sqlite'

export class ShareStore {
  private db!: sqlite.Database
  async init(dbPath: string): Promise<void> {
    this.db = await sqlite.open(dbPath);
    this.db.run(`CREATE TABLE IF NOT EXISTS shares (id TEXT NOT NULL PRIMARY KEY, code TEXT UNIQUE)`)
  }
  async get(id: string): Promise<string | null> {
    const rows = await this.db.get('SELECT code FROM shares WHERE id = ?', id)
    if (!rows) {
      throw new Error("no code found")
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
        console.log("Could not set an ID, retry", err)
      }
      retryCount++
    }
    throw new Error("Could not generate an ID")
  }
  static getRandomID(): string {
    return [...Array(5)].map(() => Math.random().toString(36)[2]).join('')
  }
}