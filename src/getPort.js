const { createServer } = require('net')

const getPort = port => new Promise((resolve, reject) => {
  const server = createServer()
  server.listen(port, () => {
    port = server.address().port
    server.close(() => {
      resolve(port)
    })
  })

  server.on('error', reject)
})

module.exports = port => port ? 
  getPort(port).catch(err => getPort(0)) :
  getPort(0)