import which from "which"
import { createConnection } from "net"
import { promises as fsp, constants as fsConstants } from "fs"
import { ChildProcess } from "child_process"
import { resolve, dirname } from "path"
import debug from "debug"
import ZipFile from "adm-zip"
import spawn from "cross-spawn"

import { Downloader } from "./Downloader"
import { cacheDir } from "./cacheDir"

type Props = {
  port: number
  clusterPort?: number
  routePorts?: number[]
  executable?: {
    name: string
    path?: string
  }
}

const log = debug("NatsServer:NatsServer")

export class NatsServer {
  public up: boolean
  private _executable: string
  private exeName: string
  private process?: Promise<ChildProcess>
  private port: number
  private clusterPort?: number
  private routePorts?: number[]
  constructor({ port, executable, clusterPort, routePorts }: Props) {
    executable &&
      executable.path &&
      (executable.name = resolve(
        executable?.path || "",
        executable?.name || ""
      ))
    this.exeName = executable?.name || "nats-server"
    this._executable = ""
    this.port = port
    this.clusterPort = clusterPort
    this.routePorts = routePorts
    this.up = false
    process.on("exit", async () => await this.close())
    process.on("SIGINT", async () => await this.close())
    process.on("SIGUSR1", async () => await this.close())
    process.on("SIGUSR2", async () => await this.close())
    process.on("uncaughtException", async () => await this.close())
  }
  static async cachedExe() {
    return resolve(await cacheDir(), "nats-server")
  }
  private async executable() {
    if (!this._executable) {
      try {
        this._executable = await which(this.exeName).catch(async e => {
          if (e.code === "ENOENT") return which(await NatsServer.cachedExe())
          else throw e
        })
      } catch (e) {
        const zipFile = new ZipFile(await Downloader.download())
        let entry = null
        for (let en of zipFile.getEntries()) {
          if (en.entryName.split("/").pop() === "nats-server")
            entry = en.entryName
        }
        if (!entry)
          throw new Error("downloaded file does not contain nats-server")
        await fsp
          .access(await NatsServer.cachedExe())
          .then(async () => {
            const stat = await fsp.stat(await NatsServer.cachedExe())
            if (stat.isDirectory())
              return fsp.rmdir(await NatsServer.cachedExe(), {
                recursive: true
              })
            else return fsp.unlink(await NatsServer.cachedExe())
          })
          .catch(e => {
            if (e.code !== "ENOENT") throw e
          })
        zipFile.extractEntryTo(
          entry,
          dirname(await NatsServer.cachedExe()),
          false,
          true
        )
        await fsp.chmod(await NatsServer.cachedExe(), fsConstants.S_IRWXO)
        this._executable = await NatsServer.cachedExe()
      }
    }
    return this._executable
  }
  public async start(): Promise<ChildProcess> {
    log("called NatsServer.start")
    if (!this.process) {
      this.process = new Promise(async (r, j) => {
        try {
          const process = spawn(
            await this.executable(),
            [
              "-p",
              this.port.toString(),
              ...(this.routePorts && this.clusterPort
                ? [
                    "-routes",
                    this.routePorts.map(p => `nats://localhost:${p}`).join(",")
                  ]
                : []),
              ...(this.clusterPort
                ? ["-cluster", `nats://localhost:${this.clusterPort}`]
                : [])
            ],
            { stdio: "inherit" }
          )
          process.stderr?.on("error", e => log(JSON.stringify(e.message || e)))
          log("child process spawned")
          const started = Date.now()
          const timer = setInterval(() => {
            const con = createConnection(this.port)
            con.on("connect", () => {
              if (process.pid) {
                log("nats server started")
                con.end()
                this.up = true
                r(process)
                clearInterval(timer)
                con.end()
              }
            })
            con.on("error", () => {
              if (Date.now() - started > 1000 * 2) {
                const msg = `failed to start server after 2s`
                log(msg)
                j(msg)
              }
            })
          }, 100)
        } catch (e) {
          log(`failed to spawn due to ${JSON.stringify(e.message || e)}`)
          j(e)
        }
      })
    }
    return this.process
  }
  public async close() {
    return this.process?.then(p => p!.kill())
  }
}
