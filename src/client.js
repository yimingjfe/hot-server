const socket = new WebSocket(`ws://localhost:7782`)

socket.addEventListener('message', (event) => {
  console.log('Message from server', event.data)
})

window.addEventListener('beforeunload', function () {
  socket.close();
})
