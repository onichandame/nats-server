import { createConnection } from "net"
import debug from "debug"

import { NatsServer } from "./utils"

type Props = {
  cluster?:
    | {
        master: false
        routePorts: number[]
      }
    | { master: true }
}

const log = debug("Server")

//babel does not support regenerator well. has conflict with while(await)
//async function* genPort(): AsyncGenerator<number, number> {
//  const startPort = 4222
//  const lastPort = 10000
//  for (let next = startPort; next <= lastPort; ++next) {
//    if (next > lastPort)
//      throw new Error("all ports unavailable. check system settings")
//    yield next
//  }
//  return lastPort
//}

async function checkPort(port: number): Promise<boolean> {
  if (!port) throw new Error("port undefined")
  log(`checking port ${port}`)
  const con = createConnection(port)
  return new Promise((r, j) => {
    con.on("error", (e: any) => {
      if (e.code === "ECONNREFUSED") r(true)
      else j(new Error(`${port} not available due to ${JSON.stringify(e)}`))
    })
    con.on("connect", () => {
      log(`${port} is in use`)
      r(false)
    })
  })
}

export class Server {
  static latestPort: number = 10000
  static step: number = 2000
  private routePorts?: number[]
  private clustered: boolean = false
  private _server?: NatsServer
  private _port?: number
  constructor({ cluster }: Props = {}) {
    if (cluster) this.clustered = true
    if (cluster && !cluster.master) this.routePorts = cluster.routePorts
  }
  static async genPort(): Promise<number> {
    const port = this.latestPort++
    log(`locked port ${Server.latestPort}`)
    if (port > this.latestPort + this.step)
      throw new Error("all ports unavailable")
    if (!(await checkPort(port))) return Server.genPort()
    else return port
  }
  public async port(): Promise<number> {
    if (!this._port) {
      let port = await Server.genPort()
      this._port = port
    }
    log(`allocated port ${this._port}`)
    return this._port
  }
  private async server(): Promise<NatsServer> {
    if (!this._server)
      this._server = new NatsServer({
        port: await this.port(),
        ...(this.clustered
          ? this.routePorts
            ? {
                clusterPort: (await this.port()) + Server.step,
                routePorts: this.routePorts
              }
            : { clusterPort: (await this.port()) + Server.step }
          : {})
      })
    return this._server
  }
  private async ensureUp() {
    log("called ensureUp")
    if (!(await this.server()).up) await (await this.server()).start()
    log("done Server ensureUp")
  }
  public async clusterPort() {
    return (await this.port()) + Server.step
  }
  public async getUri() {
    log("called getUri")
    await this.ensureUp()
    return `nats://localhost:${await this.port()}`
  }
  public async stop() {
    return this._server?.close()
  }
}
