#!/usr/bin/env node
const path = require('path')
const http = require('http')
const serveStatic = require('serve-static')
const opn = require('opn')
const fs = require('./fs')
const getPort = require('./getPort')
const posthtml = require('posthtml')
const WebSocket = require('ws')


const ISHTMLASSET = /\.html$/

// 增加指定端口功能
const options = require('yargs')
  .option('d', {
    alias: 'dir',
    describe: '提供资源的路径或目录',
    default: './'
  })
  .options('p', {
    alias: 'port',
    describe: '指定对应的端口号',
    default: 3000
  })
  .options('browser', {
    alias: '-b',
    describe: '指定打开的浏览器',
  })
  .options('o', {
    alias: 'open',
    describe: '是否打开浏览器',
    default: false
  })
  .argv;


function start(){
  let assetPath = options.dir || './';
  if(!ISHTMLASSET.test(assetPath)){
    assetPath = path.resolve(assetPath, 'index.html')
  }
  startServer(assetPath)
}

function send404(req, res){
  return () => {
    res.writeHead(404);
    res.end();
  }
}

// 将增加和删除script的操作抽离出来
async function startServer(file){
  try {
    const dir = path.dirname(file);
    const content = await fs.readFile(file);
    const newHtml = await transformHtml(content);
    const basename = path.basename(file);
    await fs.writeFile(file, newHtml);
    const serve = serveStatic(dir)
    const server = http.createServer((req, res) => {
      serve(req, res, send404(req, res));
    })
    const port = await getPort(options.port)
  
    server.listen(port, () => {
      if(options.o){
        opn(`http://localhost:${port}/${basename}`, {app: options.browser || ''})
      }
    })

    server.on('error', () => {
      console.error('error', error)
    })

    const wss = new WebSocket.Server({ port: 7782 });
    wss.on('connection', function connection(ws) {
      console.log('握手完成')
      ws.on('message', function incoming(message) {
        console.log('received: %s', message);
      });
    
      // ws.send('something');
    });

    wss.on('error', (error) => {
      console.log('wserror', error)
    })

    process.on('uncaughtException', function(err) {
      console.log(err.stack);
      console.log('NOT exit...');
    })


    process.on('SIGINT', async() => {
      await fs.writeFile(file, content);
      process.exit(0);
    })

    fs.watch(dir, { recursive: true }, (eventType, filename) => {
      console.log('filename', filename, eventType)
    })
  } catch (error) {
    console.error('trerf', error)
  }
}


function addClientScript(tree){
  tree.match({ tag: 'body' }, (node) => {
    const script = {
      tag: 'script',
      attrs: { src: './src/client.js' }
    }
    node.content.push('\n', script, '\n')
    return node
  })
}

async function transformHtml(content){
  const newContent = await posthtml(addClientScript).process(content);
  return newContent.html;
}


start()
