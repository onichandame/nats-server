import { connect } from "ts-nats"
import { generate } from "randomstring"

import { Server } from "./Server"

const randomOptions: Parameters<typeof generate>[0] = {
  length: 20,
  charset: "alphanumeric"
}

describe("server", () => {
  let server: Server
  beforeAll(() => {
    server = new Server()
  })
  test("is a class", () => {
    expect(() => new Server()).toBeTruthy()
  })
  test("starts a server after calling getUri", async done => {
    const nc = await connect(await server.getUri())
    nc.close()
    done()
  })
  test("clients can publish to server", async done => {
    const subject = generate(randomOptions)
    const nc = await connect(await server.getUri())
    nc.publish(subject)
    await nc.flush()
    nc.close()
    done()
  })
  test("clients can receive from server", async done => {
    const subject = generate(randomOptions)
    const nc = await connect(await server.getUri())
    nc.subscribe(subject, async () => {
      nc.close()
      done()
    })
    nc.publish(subject)
    await nc.flush()
  })
  afterAll(async () => await server.stop())
})
