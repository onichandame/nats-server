const { Server } = require("./dist")

const server = new Server()
;(async () => {
  try {
    await server.getUri()
    await server.stop()
    process.exit(0)
  } catch (e) {
    console.error(
      `failed to find nats-server binary due to ${JSON.stringify(
        e.message || e
      )}`
    )
    process.exit(1)
  }
})()
