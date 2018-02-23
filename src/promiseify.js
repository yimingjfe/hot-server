module.exports = function(fn){
  return (...args) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err, ...res) => {
        if(err){
          return reject(err);
        }
        
        if(res.length === 1) return resolve(res[0]);
        
        resolve(res);
      });
    });
  };
};