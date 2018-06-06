const Koa = require('koa');
const app = new Koa();
const serve = require('koa-static');

app.use(timelogger);
app.use(serve('/Users/ming/Desktop/jsAround/demo'));

async function timelogger(ctx, next){
  console.time('timelogger');
  await next();
  console.timeEnd('timelogger');
}

app.listen(3000);

console.log('listening on port 3000');