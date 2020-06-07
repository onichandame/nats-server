import findCacheDir from "find-cache-dir"
import { promises as fsp } from "fs"
import { resolve } from "path"

export const cacheDir = async () => {
  let result =
    findCacheDir({ name: "nats-server", cwd: process.cwd() }) ||
    resolve(process.cwd(), ".cache")
  try {
    await fsp.access(result)
  } catch (e) {
    if (e.code === "ENOENT") await fsp.mkdir(result, { recursive: true })
    else throw e
  }
  return result
}
