import debug from "debug"

import { Server } from "./Server"

const log = debug("Cluster")

type Props = {
  count: number
}

export class Cluster {
  private count: number
  private servers: Server[] = []
  private started?: Promise<any>
  constructor({ count }: Props = { count: 3 }) {
    if (count < 1)
      throw new Error(
        `a nats cluster must have at least 1 instance! received ${count}`
      )
    this.count = count
  }
  private async start() {
    if (!this.started) {
      this.started = new Promise(async (r, j) => {
        try {
          this.servers = []
          const master = new Server({ cluster: { master: true } })
          this.servers.push(master)
          const result: Promise<any>[] = []
          await master.getUri()
          for (let i = 0; i < this.count - 1; ++i) {
            const slave = new Server({
              cluster: {
                master: false,
                routePorts: [await master.clusterPort()]
              }
            })
            this.servers.push(slave)
            result.push(slave.getUri())
          }
          r(Promise.all(result))
          log("cluster started")
        } catch (e) {
          j(e)
        }
      })
    }
    return this.started
  }
  private async ensureUp() {
    await this.start()
  }
  public async getUris() {
    await this.ensureUp()
    const result: string[] = []
    for (let server of this.servers) {
      result.push(await server.getUri())
    }
    return result
  }
  public async stop() {
    return Promise.all(this.servers.map(server => server.stop()))
  }
}
