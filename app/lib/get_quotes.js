var config= require('config'),
    query = require('./query'),
    get_dash_context = require('./context'),
    util  = require('./util');

module.exports = function(pred){
    return query.prepare(
        'approved_quotes',
        'approved_quotes',
        (ctx) => {
            return `SELECT r.request_id,
                            r.brief,
                            r.invoice_to,
                            r.last_status,
                            q.quote_id,
                            q.quote_amount,
                            q.quote_units
                    FROM request r
                    JOIN request_quote q ON q.request_id=r.request_id
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${ctx.org}
                      AND r.system_id IN (${ctx.sys.join(',')})
                      AND r.last_status NOT IN ('C')
                      AND q.approved_by_id IS NOT NULL
                      AND q.quote_cancelled_by IS NULL
                    ORDER BY r.request_id`
        },
        (data, ctx, next) => {
            let r = { result: [ {wr: "None", result: 0} ] };
            if (data && data.rows){
                let quote_sum = {},
                    any = false;
                data.rows
                    .filter(pred(ctx))
                    .forEach(row => {
                        any = true;
                        let key = row.request_id + ': ' + row.brief;
                        let x = quote_sum[key] || 0;
                        quote_sum[key] = x + util.convert_quote_amount(row);
                    });
                if (any){
                    r.result = Object.keys(quote_sum).map(key => {
                        return {wr: key, result: Math.round(quote_sum[key]*10)/10};
                    });
                }
            }
            next(r);
        }
    );
}

/*
function XXX(pred){
    return function(req, res, next){
        let ctx = get_dash_context(req);

        if (ctx.error){
            console.log(o.error);
            res.json({error: ctx.error});
            return;
        }

        function success(data, cache_hit){
            let r = { result: [ {wr: "None", result: 0} ] };
            if (data && data.rows){
                if (!cache_hit){
                    cache.put(cache.key('approved_quotes',ctx), data);
                }
                let quote_sum = {},
                    any = false;
                data.rows
                    .filter(pred(ctx))
                    .forEach(row => {
                        any = true;
                        let key = row.request_id + ': ' + row.brief;
                        let x = quote_sum[key] || 0;
                        quote_sum[key] = x + util.convert_quote_amount(row);
                    });
                if (any){
                    r.result = Object.keys(quote_sum).map(key => {
                        return {wr: key, result: Math.round(quote_sum[key]*10)/10};
                    });
                }
            }
            res.json(r);
            next && next(false);
        }

        var c = cache.get(cache.key('approved_quotes',ctx));
        if (c){
            success(c, true);
        }else{
            db.query(
                    'approved_quotes', 
                    `SELECT r.request_id,
                            r.brief,
                            r.invoice_to,
                            r.last_status,
                            q.quote_id,
                            q.quote_amount,
                            q.quote_units
                    FROM request r
                    JOIN request_quote q ON q.request_id=r.request_id
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${ctx.org}
                      AND r.system_id IN (${ctx.sys.join(',')})
                      AND r.last_status NOT IN ('C')
                      AND q.approved_by_id IS NOT NULL
                      AND q.quote_cancelled_by IS NULL
                    ORDER BY r.request_id`.replace(/\s+/g, ' ')
                )
                .then(
                    success,
                    query.error(res, next)
                )
        }
    }
}
*/
