var get_dash_context = require('./context'),
    cache   = require('./cache'),
    db      = require('./db').get();

function db_error_handler(res, next){
    return function(err){
        console.log('ERROR: ' + err);
        res.json({error: err.message});
        next && next(false);
    }
}

exports.error = db_error_handler;

function prepare_query(
    label,
    cache_key_base,
    sql,
    process_data,
    db_query_override,
    cache_timelimit_override,
    cache_key_override
){
    return function(req, res, next){
        let ctx = get_dash_context(req);

        if (ctx.error){
            console.log(label + ': ' + ctx.error);
            res.json({error: ctx.error});
            return;
        }

        let ck = cache_key_override ? cache_key_override(ctx) : cache.key(cache_key_base, ctx);

        let success = function(data, cache_hit){
            if (!cache_hit){
                cache.put(ck, data);
            }
            process_data(data, ctx, (result) => {
                res.json(result);
                next && next(false);
            });
        }

        var c = cache.get(ck, cache_timelimit_override);
        if (c){
            success(c, true);
        }else{
            if (typeof(db_query_override) === 'function'){
                db_query_override(
                    cache_key_base,
                    ctx,
                    success,
                    db_error_handler(res, next)
                );
            }else{
                db.query(
                        cache_key_base,
                        sql(ctx).replace(/\s+/g, ' ')
                    )
                    .then(
                        success,
                        db_error_handler(res, next)
                    )
            }
        }
    }
}

exports.prepare = prepare_query;


