import { Server } from "./Server"
import { connect } from "ts-nats"

describe("server", () => {
  test("is a class", () => {
    expect(() => new Server()).toBeTruthy()
  })
  test("starts a server after calling getUri", async done => {
    const server = new Server()
    const nc = await connect(await server.getUri())
    nc.close()
    done()
  })
})
