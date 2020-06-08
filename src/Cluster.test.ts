import { connect } from "ts-nats"
import { generate } from "randomstring"

import { Cluster } from "./Cluster"

const randomOptions: Parameters<typeof generate>[0] = {
  length: 20,
  charset: "alphanumeric"
}

describe("Cluster", () => {
  let cluster: Cluster
  beforeAll(() => {
    cluster = new Cluster()
  })
  test("is a class", () => expect(new Cluster()).toBeTruthy())
  test("starts a cluster when calling getUris", async done => {
    const nc = await connect({ servers: await cluster.getUris() })
    nc.close()
    done()
  })
  test("clients can publish to cluster", async done => {
    const subject = generate(randomOptions)
    let nc = await connect(
      (await cluster.getUris())[Math.round(Math.random() * 2)]
    )
    nc.publish(subject)
    await nc.flush()
    nc.close()
    done()
  })
  test("clients can receive from cluster", async done => {
    const subject = generate(randomOptions)
    let nc = await connect((await cluster.getUris())[0])
    nc.subscribe(subject, () => {
      nc.close()
      done()
    })
    nc = await connect((await cluster.getUris())[1])
    nc.publish(subject)
    await nc.flush()
  })
  afterAll(async () => cluster.stop())
})
