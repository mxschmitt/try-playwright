import { registerFileListener, emitNewFile } from './playwright'

describe("File handling", () => {
  it("should be able to emit and receive files", () => {
    const browserId = "1"
    const filename = "original.pdf"
    const getFiles = registerFileListener(browserId)
    emitNewFile(browserId, filename)
    const files = getFiles()
    expect(files.length).toBe(1)
    expect(files[0].extension).toBe(".pdf")
    expect(files[0].publicURL).toMatch(/public\/.*\.pdf/)
    expect(files[0].filename).toBe(filename)
  })
})
