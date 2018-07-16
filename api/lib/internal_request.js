var util  = require('./util'),
    cache = require('./cache');

'use strict';

let empty_fn = function(){};

const DEBUG = false;

// A shim for http.Response that makes it easier for us to
// build composite APIs like sla_hours, which relies
// on approved_quotes and pending_quotes under the hood.
function Response(handler){
    this.handler = handler || empty_fn;
}

Response.prototype.charSet = empty_fn;

Response.prototype.json = function(j){
    util.log_debug(__filename, JSON.stringify(j, null, 2), DEBUG);
    this.handler(j);
}

module.exports = function(fn, ctx, key, next){
    util.log_debug(__filename, JSON.stringify(ctx, null, 2), DEBUG);
    let res = new Response(() => {
        let data = cache.get(key);
        if (data){
            next(data);
        }else{
            next({error: "Couldn't resolve " + key});
        }
    });
    fn({}, res, empty_fn, ctx);
}

