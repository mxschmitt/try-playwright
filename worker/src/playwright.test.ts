import tmp from 'tmp'
import { registerFileListener, emitNewFile } from './playwright'

describe("File handling", () => {
  it("should be able to emit and receive files", async () => {
    const browserId = "1"
    const filename = "original.pdf"
    const assetDir = tmp.dirSync();
    const getFiles = registerFileListener(browserId, assetDir.name)
    emitNewFile(browserId, filename)
    const files = await getFiles()
    expect(files.length).toBe(1)
    expect(files[0].extension).toBe(".pdf")
    expect(files[0].publicURL).toMatch(/public\/.*\.pdf/)
    expect(files[0].filename).toBe(filename)
  })
})
