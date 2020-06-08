# NATS Server

This tool bootstraps a NATS server/cluster for development purposes. Inspired by [this repo][mongo]. **DO NOT USE FOR PRODUCTION**

# Author

[onichandame](https://github/onichandame/nats-server)

# Usage

Installation(downloads NATS server binary if not found in path):

```bash
yarn add -D nats-server
```

Test scripts:

```typescript
import { Server, Cluster } from 'nats-server'
import { connect } from 'ts-nats'

describe("module1", () => {
  const server: Server
  const cluster: Cluster
  beforeAll(() => {
    server = new Server()
    cluster = new Cluster()
  })
  test("can connect to NATS", async done => {
    let nc = await connect(await server.getUri())
    nc = await connect({servers: await cluster.getUris()})
    console.log("Able to connect to the test NATS cluster!")
    done()
  })
  afterAll(async () => {
    await server.stop()
    await cluster.stop()
  })
})
```

# Known Issues

1. does not support Windows. May work on OSX(not tested as I do not possess a Mac)
2. Not fully tested yet so there may be server instances dangling around after the main process exits abnormally. Make sure you call `await server.stop()` to clean it up and check `ps aux | grep nats-server` if process exits before `server.stop()` is resolved.
3. requires to open ports between 10000 and 12000. This limit is hard coded for now. Let me know if a customization is desirable.

[mongo]: https://github.com/nodkz/mongodb-memory-server
