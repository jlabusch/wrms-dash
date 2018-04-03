var query = require('./query'),
    cache = require('./cache'),
    send_internal_request = require('./internal_request'),
    util  = require('./util');

const DEBUG = false;

function process_timesheets(res, next){
    return function(ts){
        let r = {result: [{wr: "None", result: 0}]},
            arr = Object.keys(ts);

        if (arr.length > 0){
            r.result = arr.sort().map(key => {
                let row = ts[key];
                return [{
                    wr: row.request_id + ': ' + row.brief,
                    result: row.total
                }];
            });
        }

        res.json(r);
        next && next(false);
    }
}

module.exports = function(req, res, next, ctx){
    cache.wait(cache.key('sla_hours_ts', ctx))
        .then(process_timesheets(res, next))
        .timeout(() => {
            send_internal_request(
                require('./get_sla_hours'),
                ctx,
                cache.key('sla_hours_ts', ctx),
                process_timesheets(res, next)
            );
        })
        .limit(17);
}


