var util  = require('./util');

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

module.exports = function(fn, ctx, next){
    util.log_debug(__filename, JSON.stringify(ctx, null, 2), DEBUG);
    let res = new Response(next);
    fn({}, res, empty_fn, ctx);
}

