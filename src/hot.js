#!/usr/bin/env node
const path = require('path')
const http = require('http')
const Stream = require('stream')
const opn = require('opn')
const posthtml = require('posthtml')
const parseurl = require('parseurl')
const send = require('send')
const WebSocket = require('ws')
const serveStatic = require('serve-static')
const es = require('event-stream')
const url = require('url')
const fs = require('./fs')
const getPort = require('./getPort')

// 路径都是硬编码的问题如何解决？全部定义为常量？

const ISHTMLASSET = /\.html$/;
let options = {};

const argv = require('yargs')
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
  .options('b', {
    alias: 'browser',
    describe: '指定打开的浏览器',
  })
  .options('o', {
    alias: 'open',
    describe: '是否打开浏览器',
    default: false
  })
  .argv;

function initOptions(){
  options = {
    dir: argv.dir,
    port: argv.port,
    browser: argv.browser,
    open: argv.open,
    assetPath: ''
  }
  
  if(!ISHTMLASSET.test(options.dir)){ // dir是真目录
    options.assetPath = path.resolve(options.assetPath, 'index.html')
  } else {
    options.assetPath = options.dir;
    options.dir = path.dirname(options.assetPath);
  }
}

// 设置options对应的参数，为html添加js，启动服务器，启动ws的服务器，启动文件监听
function start(){
  initOptions();
  startServer();
  startWSServer();
}

function send404(req, res){
  return () => {
    res.writeHead(404);
    res.end();
  }
}

function serve(req, res){
  const pathname = parseurl(req).pathname;
  if(pathname === '/hot/client.js'){
    const sendScriptStream = send(req, '/src/client.js', {root: process.cwd()})
    sendScriptStream
      .on('error', send404(req, res))
      .pipe(res)
  } else {
    const sendStream = send(req, pathname, {root: options.dir});
    let injected = false
    const originalWrite = res.write
    res.write = (chunk, encoding, callback) => {
      if(res._headers['content-type'] === 'text/html; charset=UTF-8'){
        if(!injected){
          const content = chunk.toString();
          chunk = transformHtmlSync(content, [addContentToHead]);
          injected = true;
          res.setHeader('content-length', chunk.length);
        }
      }
      originalWrite.call(res, chunk, encoding, callback);
    }
    sendStream
      .on('error', send404(req, res))
      .pipe(res)
  }
}

// 将增加和删除script的操作抽离出来
async function startServer(){
  try {
    // const content = await fs.readFile(options.assetPath);
    const basename = path.basename(options.assetPath);
    // const clientScript = await fs.readFile(path.resolve("./src/client.js"));
    // const clientDir = path.resolve(options.dir, "./hot");
    // mfs.mkdirpSync(clientDir);
    // mfs.writeFileSync(path.resolve(clientDir, "./client.js"), clientScript);
    // const serve = serveStatic(dir)
    const server = http.createServer((req, res) => {
      // serve(req, res, send404(req, res));
      serve(req, res);
    })

    const port = await getPort(options.port)
  
    server.listen(port, () => {
      if(options.open){
        opn(`http://localhost:${port}/${basename}`, {app: options.browser || ''});
        console.log('浏览器已经打开');
      }
    })

    server.on('error', () => {
      console.error('error', error)
    })

    process.on('SIGINT', async() => {
      process.exit(0);
    })
  } catch (error) {
    console.error('err', error)
  }
}

function startWSServer(){
  const wss = new WebSocket.Server({ port: 7782 });
  wss.on('connection', function connection(ws) {
    let safe = true;
    console.log('connection', ws.readyState);
    ws.on('message', function incoming(message) {
      console.log('received: %s', message);
    });

    ws.on('error', (err) => {
      console.log('err', err)
    })
    
    const watcher = fs.watch(options.dir, { recursive: true }, function onWatchDir(eventType, filename){
      if(safe){
        setTimeout(() => {
          console.log('reload')
          ws.send('reload');
          safe = true;
        }, 500)
        safe = false;
      }
      // console.log('filename', filename, eventType)
    })

    ws.on('close', () => {
      console.log('server socket is closed');
      watcher.close();
      wss.close();
      startWSServer();
    })
  });

  wss.on('error', (error) => {
    console.log('wserror', error)
  })
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

function addContentToHead(tree){
  tree.match({ tag: 'head' }, (node) => {
    const script = {
      tag: 'script',
      attrs: { src: './hot/client.js' }
    }
    node.content.unshift('\n', script, '\n')
    return node
  })
}

async function transformHtml(content, plugins){
  const newContent = await posthtml(...plugins).process(content);
  return newContent.html;
}

function transformHtmlSync(content, plugins){
  const newContent = posthtml(...plugins).process(content, {sync: true});
  return newContent.html;
}


start()
