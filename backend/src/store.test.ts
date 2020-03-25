import fs from 'fs'
import { promisify } from 'util'
import { ShareStore, ErrorNoRecordFound, ErrorMaxIdsReached } from './store'

const existsFile = promisify(fs.exists)
const unlinkFile = promisify(fs.unlink)

describe("Store", () => {
  const dbPath = "./testdb.sqlite"
  let store: ShareStore;
  beforeEach(async () => {
    store = new ShareStore()
    await store.init(dbPath)
    store.maxLength = 1
  })
  afterEach(async()=> {
    await store.close()
    await unlinkFile(dbPath)
  })
  it("should throw an exception if no record was found", async () => {
    expect(store.get("foo")).rejects.toThrow(ErrorNoRecordFound);
    expect(await existsFile(dbPath)).toBe(true)
  })
  it("should return the value if an exact match was found", async() => {
    const code = "console.log(123)"
    const id = await store.set(code)
    expect(await store.get(id)).toBe(code)
  })
  it("should not generate a new id if the code is already in the database", async() => {
    const code = "console.log(123)"
    const id1 = await store.set(code)
    const id2 = await store.set(code)
    expect(id1).toBe(id2)
  })
  it("should handle the case if no more IDs can be generated", async() => {
    let i = 0;
    let thrownError = null
    while(i <= 100) {
      try {
        await store.set(i.toString())
      } catch (error) {
        thrownError = true
        expect(error).toBe(ErrorMaxIdsReached)
        break
      }
      i++
    }
    if (!thrownError) {
      throw new Error("could not handle edge case if database run full of IDs")
    }
  })
})