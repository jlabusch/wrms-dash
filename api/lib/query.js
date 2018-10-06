var cache   = require('./cache'),
    util    = require('wrms-dash-util'),
    db      = require('./db').get();

function db_error_handler(res, next){
    return function(err){
        util.log(__filename, 'ERROR: ' + err);
        res.json({error: err.message});
        next && next(false);
    }
}

exports.error = db_error_handler;

function prepare_query(args){
    if (arguments.length !== 1){
        args = {
            label:                  arguments[0],
            cache_key_base:         arguments[1],
            sql:                    arguments[2],
            process_data:           arguments[3],
            db_query_override:      arguments[4],
            cache_timelimit_override: arguments[5],
            cache_key_override:     arguments[6],
            use_last_known_good:    arguments[7]
        }
    }
    if (!args.cache_key_base){
        args.cache_key_base = args.label;
    }
    return function(req, res, next, ctx){
        let ck = args.cache_key_override ? args.cache_key_override(ctx) : cache.key(args.cache_key_base, ctx);

        let success = function(data, cache_hit){
            if (!cache_hit){
                cache.put(ck, data);
            }
            args.process_data(data, ctx, (result) => {
                res.charSet('utf-8');
                res.json(result);
                next && next(false);
            });
        }

        var c = cache.get(ck, args.cache_timelimit_override);
        if (c){
            success(c, true);
        }else{
            let already_called_success = false;
            if (args.use_last_known_good){
                c = cache.get(ck, cache.LAST_KNOWN_GOOD_LIMIT);
                if (c){
                    util.log(__filename, 'Using last-known-good cache for [' + ck + ']');
                    already_called_success = true;
                    success(c, true);
                }
            }
            if (typeof(args.db_query_override) === 'function'){
                args.db_query_override(
                    args.cache_key_base,
                    ctx,
                    success,
                    db_error_handler(res, next)
                );
            }else{
                db.query(
                        args.cache_key_base,
                        args.sql(ctx).replace(/\s+/g, ' '),
                        ctx
                    )
                    .then(
                        (data, cache_hit) => {
                            if (already_called_success){
                                // Just update cache, don't return result
                                cache.put(ck, data);
                            }else{
                                success(data, cache_hit);
                            }
                        },
                        db_error_handler(res, next)
                    );
            }
        }
    }
}

exports.prepare = prepare_query;


