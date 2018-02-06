#!/usr/bin/env node
const path = require('path')
const http = require('http')
const serveStatic = require('serve-static')
const opn = require('opn')
const fs = require('./fs')
const getPort = require('./getPort')
const posthtml = require('posthtml')


const ISHTMLASSET = /\.html$/

// 增加指定端口功能
const options = require('yargs')
  .option('d', {
    alias: 'dir',
    describe: '指定提供资源的目录',
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
  console.log('assetPath', assetPath);
  if(!ISHTMLASSET.test(assetPath)){
    assetPath = path.resolve(assetPath, 'index.html')
  }
  const dir = path.dirname(assetPath)
  startServer(dir)
}

function send404(req, res){
  return () => {
    res.writeHead(404);
    res.end();
  }
}

// 将增加和删除script的操作抽离出来
async function startServer(dir){
  try {
    const file = path.resolve(dir, './index.html');
    const content = await fs.readFile(file);
    const newHtml = await transformHtml(content)
    await fs.writeFile(file, newHtml)
    const serve = serveStatic(dir)
    const server = http.createServer((req, res) => {
      serve(req, res, send404(req, res));
    })
    const port = await getPort(options.port)
  
    server.listen(port, () => {
      if(options.o){
        opn(`http://localhost:${port}`, {app: options.browser || ''})
      }
    })

    server.on('error', () => {
      console.error('error', error)
    })


    process.on('SIGINT', async() => {
      await fs.writeFile(file, content);
      process.exit(0);
    })
  } catch (error) {
    console.error(error)
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
