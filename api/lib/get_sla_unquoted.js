var query = require('./query'),
    cache = require('./cache'),
    util  = require('./util');

const DEBUG = false;

module.exports = function(req, res, next, ctx){
    cache.wait(cache.key('sla_hours_ts', ctx))
        .then((ts) => {
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
        })
        .timeout(() => {
            query.error(res, next)(new Error('sla_unquoted: sla_hours_ts cache timed out'));
        })
        .limit(20);
}


