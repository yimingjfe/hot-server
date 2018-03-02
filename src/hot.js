#!/usr/bin/env node
const path = require('path');
const http = require('http');
const opn = require('opn');
const posthtml = require('posthtml');
const parseurl = require('parseurl');
const send = require('send');
const WebSocket = require('ws');
const fs = require('./fs');
const getPort = require('./getPort');
const { throttle } = require('./util')

// 路径都是硬编码的问题如何解决？全部定义为常量？
// hmr服务器端口冲突问题，解决？
// 错误处理，整理代码
// 创建的stream是不是应该一直起作用，而不是每次handle都重新创建？
// 去掉-d 参数

const ISHTMLASSET = /\.html$/;
const htmlExtensions = ['html']
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

function initOptions2(){
  const dir = process.cwd();
  const assetPath = argv['_'];
  const isFile = false;
}

function initOptions(){
  console.log(argv)
  options = {
    dir: argv.dir,
    port: argv.port,
    browser: argv.browser,
    open: argv.open,
    assetPath: ''
  };
  // 判断是不是目录，拿到资源路径和目录的路径
  // const assetPath = argv['_']
  // const isFile = false;
  // try {
  //   isFile = fs.statSync(assetPath).isFile();
  // } catch (e) {
  //   console.error(e.toString().red)
  // }

  // const isFile = false;
  // if(isHtml){
    // try {
    //   isFile = fs.statSync(options.assetPath).isFile();
    // } catch (e) {
    //   console.error(e.toString().red)
    // }
  //   if(isFile){

  //   }
    
  // } else {

  // }
  if(!ISHTMLASSET.test(options.dir)){ // dir是真目录
    options.assetPath = path.resolve(options.assetPath, 'index.html');
  } else {
    options.assetPath = options.dir;
    options.dir = path.dirname(options.assetPath);
  }
}

const injectedTag = `<script src="./hot/client.js"></script>`
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
  };
}

function serve(req, res){
  const pathname = parseurl(req).pathname;
  if(pathname === '/hot/client.js'){
    const sendScriptStream = send(req, '/client.js', {root: __dirname});
    sendScriptStream
      .on('error', send404(req, res))
      .pipe(res);
  } else {
    const sendStream = send(req, pathname, {root: options.dir});
    let injected = false;
    const originalWrite = res.write;
    res.write = (chunk, encoding, callback) => {
      if(res._headers['content-type'] === 'text/html; charset=UTF-8'){
        if(!injected){
          const content = chunk.toString();
          // chunk = transformHtmlSync(content, [addContentToHead]);
          chunk = content.replace('</body>', `${injectedTag}$&`)
          injected = true;
          res.setHeader('content-length', res._headers['content-length'] + chunk.length - content.length);
        }
      }
      originalWrite.call(res, chunk, encoding, callback);
    };
    sendStream
      .on('error', send404(req, res))
      .pipe(res);
  }
}

// 将增加和删除script的操作抽离出来
async function startServer(){
  try {
    const basename = path.basename(options.assetPath);
    const server = http.createServer((req, res) => {
      serve(req, res);
    });

    const port = await getPort(options.port);
  
    server.listen(port, () => {
      if(options.open){
        opn(`http://localhost:${port}/${basename}`, {app: options.browser || ''});
      }
      console.log('服务器已经开启\n', `http://localhost:${port}/${basename}`);
    });

    server.on('error', (error) => {
      console.error('error', error);
    });

    process.on('SIGINT', async() => {
      process.exit(0);
    });
  } catch (error) {
    console.error('startServer', error);
  }
}

function startWSServer(){
  const wss = new WebSocket.Server({ port: 7782 });
  wss.on('connection', function connection(ws) {
    let safe = true;
    ws.on('message', function incoming(message) {
      console.log('received: %s', message);
    });

    ws.on('error', (err) => {
      console.log('wserror', err);
    });

    const sendReload = throttle(() => {
      console.log('reload');
      ws.send('reload');
    }, 500)
    
    const watcher = fs.watch(options.dir, { recursive: true }, function onWatchDir(eventType, filename){
      // if(safe){
      //   setTimeout(() => {
      //     console.log('reload');
      //     ws.send('reload');
      //     safe = true;
      //   }, 500);
      //   safe = false;
      // }
      sendReload();
    });

    ws.on('close', () => {
      watcher.close();
      wss.close();
      startWSServer();
    });
  });

  wss.on('error', (error) => {
    console.log('wserror', error);
  });
}


function addClientScript(tree){
  tree.match({ tag: 'body' }, (node) => {
    const script = {
      tag: 'script',
      attrs: { src: './src/client.js' }
    };
    node.content.push('\n', script, '\n');
    return node;
  });
}

function addContentToHead(tree){
  tree.match({ tag: 'head' }, (node) => {
    const script = {
      tag: 'script',
      attrs: { src: './hot/client.js' }
    };
    node.content.unshift('\n', script, '\n');
    return node;
  });
}

async function transformHtml(content, plugins){
  const newContent = await posthtml(...plugins).process(content);
  return newContent.html;
}

function transformHtmlSync(content, plugins){
  const newContent = posthtml(...plugins).process(content, {sync: true});
  return newContent.html;
}


start();
