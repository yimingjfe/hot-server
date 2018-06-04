#!/usr/bin/env node
const path = require('path');
const http = require('http');
const opn = require('opn');
const posthtml = require('posthtml');
const parseurl = require('parseurl');
// const send = require('send');
const send = require('koa-send');
const WebSocket = require('ws');
const fs = require('./fs');
const getPort = require('./getPort');
const { throttle } = require('./util');
const chokidar = require('chokidar');
const Koa = require('koa');
const app = new Koa();
const serveIndex = require('koa2-serve-index');

const ISHTMLASSET = /\.html$/;
const htmlExtensions = ['.html'];
const injectedTag = '<script src="/hot/client.js"></script>';

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
  const dir = process.cwd();
  const assetPath = argv['dir'];
  const abAssetPath = getMainAssetPath(dir, assetPath);
  return {
    dir: path.dirname(abAssetPath),
    port: argv.port,
    browser: argv.browser,
    open: argv.open,
    assetPath: abAssetPath
  };
}

// 解析参数
// 启动两个服务器

function serve(options){
  return async function(ctx){
    const pathname = parseurl(ctx).pathname;
    if(pathname === '/hot/client.js'){
      await send(ctx, '/client.js', {root: __dirname});
    } else {
      await send(ctx, pathname, {root: options.dir});
      let injected = false;
      const res = ctx.res;
      const originalWrite = res.write;
      // 文件比较大的时候改chunk，可能有问题
      res.write = (chunk, encoding, callback) => {
        if(ctx.response.is('html')){
          if(!injected){
            const content = chunk.toString();
            chunk = content.replace('</body>', `${injectedTag}$&`);
            injected = true;
            ctx.response.set('content-length', Number(ctx.response.get('content-length')) + chunk.length - content.length);
          }
        }
        originalWrite.call(res, chunk, encoding, callback);
      };
    }
  };
}

async function startServer(options){
  try {
    const basename = path.basename(options.assetPath);
    app.use(serveIndex(options.dir));
    // app.use(async(ctx) => {
    //   await send(ctx, ctx.path, { root: options.dir });
    // });

    app.use(serve(options));
  
    const port = await getPort(options.port);
    const server = app.listen(port, () => {
      if(options.open){
        opn(`http://localhost:${port}/${basename}`, {app: options.browser || ''});
      }
      console.log('服务器已经开启\n', `http://localhost:${port}/${basename}`);
    });

    app.on('error', (error) => {
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

function startWSServer(server, options){
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

    ws.on('close', (code, reason) => {
      console.log('ws close', wss.clients);
      wss.clients.delete(ws);
    });
    console.log('链接');
  });

  const sendReload = throttle(() => {
    wss.clients.forEach( ws => {
      ws.send('reload');  
    });
  }, 500);
  console.log('dir', options.dir);
  chokidar.watch(options.dir, { recursive: true }, function onWatchDir(eventType, filename){
    console.log('sendReload', eventType, filename);
    sendReload();
  });

  wss.on('error', (error) => {
    console.log('wserror', error);
  });
}

async function start(){
  const options = initOptions();
  const server = await startServer(options);
  startWSServer(server, options);
}

start();


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
