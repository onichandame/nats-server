import { resolve } from "path"
import { platform, arch } from "os"
import { createWriteStream, promises as fsp } from "fs"
import { get as http, IncomingMessage } from "http"
import { get as https } from "https"
import debug from "debug"
import { SingleBar, Presets } from "cli-progress"

import { cacheDir } from "./cacheDir"

type Props = {
  version?: string
  repo?: string
}

const log = debug("NatsServer:Downloader")

// download a zip file from github
export class Downloader {
  private version: string
  private repo: string
  static downloading?: Promise<string>
  constructor({ version, repo }: Props = {}) {
    this.version = version || "2.1.7"
    this.repo =
      repo ||
      `https://github.com/nats-io/nats-server/releases/download/v${this.version}`
  }
  static get arch(): string {
    const raw = arch()
    let result = ""
    if (raw.includes("x64")) result = "amd64"
    return result
  }
  static download(props?: Props) {
    return new this(props).download()
  }
  private get fileName(): string {
    return `nats-server-v${this.version}-${platform()}-${Downloader.arch}.zip`
  }
  private async filePath() {
    return resolve(await cacheDir(), this.fileName)
  }
  private get url() {
    return `${this.repo}/${this.fileName}`
  }
  async download(): Promise<string> {
    log("called Downloader download")
    if (Downloader.downloading) return Downloader.downloading
    Downloader.downloading = new Promise(async (r, j) => {
      await fsp
        .access(await this.filePath())
        .then(async () => fsp.unlink(await this.filePath()))
        .catch(e => {
          if (e.code !== "ENOENT") throw e
        })
      const file = createWriteStream(await this.filePath())
      const res = await this.getResponse(this.url)
      log("starting download")
      if (!res.headers["content-length"])
        throw new Error("content length is empty")
      let totalBytes = parseInt(res.headers["content-length"] || "", 10)
      let currentBytes = 0
      const progress = new SingleBar({}, Presets.shades_classic)
      progress.start(totalBytes, currentBytes)
      res.pipe(file)
      res.on("data", data => {
        currentBytes += data.length
        process.env.DEBUG &&
          process.stdout.write(
            `Nats server download progress ${Math.round(
              (currentBytes / totalBytes) * 100
            )}%${platform().includes("win32") ? "\x1b[0G" : "\r"}`
          )
        progress.increment(data.length)
      })
      file.on("finish", () => {
        if (currentBytes < totalBytes)
          j(new Error(`download not complete! ${currentBytes}/${totalBytes}`))
        log("executable downloaded")
        file.close()
        log("nats server zip file downloaded")
        r(this.filePath())
      })
      res.on("error", e => {
        j(new Error(`cannot download due to ${JSON.stringify(e.message || e)}`))
      })
    })
    return Downloader.downloading
  }
  private async getResponse(url: string): Promise<IncomingMessage> {
    log(`called Downloader getResponse with url ${url}`)
    const fetch = this.url.toLowerCase().startsWith("https") ? https : http
    return new Promise((r, j) => {
      fetch(url, res => {
        switch (res.statusCode) {
          case 200:
            log(`final url: ${url}`)
            r(res)
            break
          case 302:
            if (res.headers["location"])
              r(this.getResponse(res.headers["location"]))
            else j(new Error("got 302 redirect but no location"))
            break
          case 403:
            j(
              new Error(
                "downloadable file not found! check version and platform"
              )
            )
            break
          default:
            j(new Error(`download failed. code ${res.statusCode}`))
        }
      })
    })
  }
}
