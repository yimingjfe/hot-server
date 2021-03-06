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
const { throttle } = require('./util');


// 路径都是硬编码的问题如何解决？全部定义为常量？
// 错误处理，整理代码
// 命令与startServer没有分离

// 命令与startServer分离，这样options就能从某个配置文件中获取
// 获取最终的options,这样可以做单元测试
// 正在做chrome中显示list directory

const ISHTMLASSET = /\.html$/;
const htmlExtensions = ['.html'];
const injectedTag = '<script src="./hot/client.js"></script>';
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

// 指定相对html(非)
// 指定绝对html（非）
// 指定相对或绝对目录

// 如果用中间件的话，这个就可以作为中间件的一环，便于测试
function getMainAssetPath(dir, assetPath){
  let abAssetPath = path.resolve(dir, assetPath);
  // let isFile = false;
  // try{
  //   isFile = fs.lstatSync(abAssetPath).isFile();
  // } catch(error){
  //   console.error(error);
  // }
  // if(!isFile){
  //   abAssetPath = path.resolve(abAssetPath, 'index.html');
  // }
  // if(!htmlExtensions.includes(path.extname(abAssetPath))){
  //   throw new Error('Main asset must be a html');
  // }
  return abAssetPath;
}

function initOptions(){
  const dir = process.cwd();
  const assetPath = argv['dir'];
  const abAssetPath = getMainAssetPath(dir, assetPath);
  options = {
    dir: path.dirname(abAssetPath),
    port: argv.port,
    browser: argv.browser,
    open: argv.open,
    assetPath: abAssetPath
  };
}

// 设置options对应的参数，为html添加js，启动服务器，启动ws的服务器，启动文件监听
async function start(){
  initOptions();
  const server = await startServer();
  startWSServer(server);
}

function send404(req, res){
  return () => {
    res.writeHead(404);
    res.end();
  };
}

async function directory (res, path) {
  var stream = this;

  // redirect to trailing slash for consistent url
  if (!stream.hasTrailingSlash()) {
    return stream.redirect(path);
  }

  try {
    const list = await fs.readdir(path);
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.end(list.join('\n') + '\n');
  } catch (error) {
    return stream.error(error);
  }

}

function serve(req, res){
  const pathname = parseurl(req).pathname;
  let sendStream = null;
  if(pathname === '/hot/client.js'){
    sendStream = send(req, '/client.js', {root: __dirname});
  } else {
    sendStream = send(req, pathname, {root: options.dir});
    let injected = false;
    const originalWrite = res.write;
    res.write = (chunk, encoding, callback) => {
      if(res._headers['content-type'] === 'text/html; charset=UTF-8'){
        if(!injected){
          const content = chunk.toString();
          // chunk = transformHtmlSync(content, [addContentToHead]);
          chunk = content.replace('</body>', `${injectedTag}$&`);
          injected = true;
          res.setHeader('content-length', res._headers['content-length'] + chunk.length - content.length);
        }
      }
      originalWrite.call(res, chunk, encoding, callback);
    };
  }
  sendStream
    .on('error', send404(req, res))
    // .once('directory', directory)
    .pipe(res);
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

    return server;
  } catch (error) {
    console.error('startServer', error);
  }
}

function startWSServer(server){
  const wss = new WebSocket.Server({ server });
  wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
      console.log('received: %s', message);
    });

    ws.on('error', (error) => {
      if(error.errno !== 'ECONNRESET'){
        console.log('wserror', error);
      }
    });

    const sendReload = throttle(() => {
      wss.clients.forEach( ws => {
        ws.send('reload');
      });
    }, 500);
    
    const watcher = fs.watch(options.dir, { recursive: true }, function onWatchDir(eventType, filename){
      sendReload();
    });

    ws.on('close', (code, reason) => {
      wss.clients.delete(ws);
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
