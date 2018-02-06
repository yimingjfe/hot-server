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
const argv = require('yargs')
  .option('d', {
    alias: 'dir',
    describe: '指定提供资源的目录',
    default: './'
  })
  .argv;


function start(argv){
  let assetPath = argv.dir || './';
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

// 增加关闭，删除script功能
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
    const port = await getPort(3000)
  
    server.listen(port, () => {
      opn(`http://localhost:${port}`)
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

start(argv)
