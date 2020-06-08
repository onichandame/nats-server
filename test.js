const { Server } = require(".")

const server = new Server()
console.log("starting download")
server
  .getUri()
  .then(() => console.log("downloaded"))
  .catch(e => console.log(e))
setInterval(() => {}, 2 ^ 25)
