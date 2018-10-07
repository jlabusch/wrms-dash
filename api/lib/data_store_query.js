var request = require('request'),
    config  = require('config'),
    util    = require('wrms-dash-util');

function make_handler(req, res, next, ctx, label = __filename){
    return function(transform){
        return handler(req, res, next, ctx, transform, label);
    }
}

exports.make_query_handler = make_handler;

function handler_send_data(res, next, data, label){
    res.charSet('utf-8');
    res.json(data);
    next && next(false);
}

exports.query_send_data = handler_send_data;

function handler_send_error(res, next, err, label){
    let e = err.message || err;
    util.log(label, 'ERROR: ' + e);
    handler_send_data(res, next, {error: e}, label);
}

exports.query_send_error = handler_send_error;

function handler(req, res, next, ctx, transform, label = __filename){
    return function(err, data){
        if (err){
            handler_send_error(res, next, err, label);
            return;
        }

        if (transform){
            try{
                data = transform(data);
            }catch(ex){
                handler_send_error(res, next, ex, label);
                return;
            }
        }

        handler_send_data(res, next, data, label);
    }
}

exports.query_handler = handler;

// Query remote store
exports.query = function(/* stmt, arg, ..., next(err,rows) */){
    let args = Array.prototype.slice.call(arguments, 0),
        next = function(){};

    if (typeof(args[args.length - 1]) === 'function'){
        next = args.pop();
    }

    util.log_debug(__filename, args[0]);

    util.send_post({ url: config.get('api-cache.host') + '/query' })
        .with({ query: args })
        .then(next);
}

