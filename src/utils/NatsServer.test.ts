import { connect } from "ts-nats"
import { generate } from "randomstring"

import { NatsServer } from "./NatsServer"

// has to be below 4222 to avoid conflicts with Server
const port = 4220

const randomOptions: Parameters<typeof generate>[0] = {
  length: 20,
  charset: "alphanumeric"
}

describe("Nats server", () => {
  let server: NatsServer
  beforeAll(async () => {
    server = new NatsServer({ port })
    await server.start()
  })
  test("is a class", () => expect(() => new NatsServer({ port })).toBeTruthy())
  test("clients can connect", async done => {
    const nc = await connect({ port })
    nc.close()
    done()
  })
  test("clients can publish to the server", async done => {
    const subject = generate(randomOptions)
    const nc = await connect({ port })
    nc.publish(subject)
    await nc.flush()
    nc.close()
    done()
  })
  test("clients can subscribe to the server", async done => {
    const subject = generate(randomOptions)
    const nc = await connect({ port })
    nc.subscribe(subject, () => {
      nc.close()
      done()
    })
    nc.publish(subject)
    await nc.flush()
  })
  afterAll(async () => {
    await server.close()
  })
})
