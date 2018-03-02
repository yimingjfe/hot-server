if(WebSocket) {
  ;(function(){
    var socket = new WebSocket('ws://localhost:7782');
    var RELOAD_ORD = 'reload';
    
    console.log('hot reload client is ready');
    
    socket.addEventListener('message', (event) => {
      console.log('Message from server', event.data);
      var message = event.data;
      if(RELOAD_ORD === message){
        location.reload();
      }
    });
  })()
}


// window.addEventListener('beforeunload', function () {
//   console.log('close socket')
//   socket.close();
// })
