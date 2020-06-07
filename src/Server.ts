import { createConnection } from "net"
import debug from "debug"

import { NatsServer } from "./utils"

const log = debug("Server")

export class Server {
  static ports: number[] = []
  private _server?: NatsServer
  private _port?: number
  constructor() {}
  static async *genPort(): AsyncGenerator<number, number> {
    const startPort = 4222
    const lastPort = 10000
    let next = startPort
    if (!(await this.checkPort(next))) yield* Server.genPort()
    if (next === lastPort)
      throw new Error("all ports unavailable. check system settings")
    yield next
    return next
  }
  static async checkPort(port: number): Promise<boolean> {
    const con = createConnection(port)
    return new Promise(r => {
      con.on("error", () => r(false))
      con.on("connect", () => r(true))
    })
  }
  private async port(): Promise<number> {
    if (!this._port) this._port = (await Server.genPort().next()).value
    return this._port
  }
  private async server(): Promise<NatsServer> {
    if (!this._server)
      this._server = new NatsServer({ port: await this.port() })
    return this._server
  }
  private async ensureUp() {
    log("called Server ensureUp")
    if (!(await this.server()).up) await (await this.server()).start()
    log("done Server ensureUp")
  }
  public async getUri() {
    log("called Server getUri")
    await this.ensureUp()
    return `nats://localhost:${this.port}`
  }
  public async stop() {
    return (await this.server()).close()
  }
}
