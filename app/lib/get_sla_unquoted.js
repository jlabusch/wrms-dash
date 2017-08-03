var config= require('config'),
    query = require('./query'),
    cache = require('./cache'),
    util  = require('./util');

module.exports = query.prepare(
    'sla_unquoted',
    'sla_hours', // to match ./get_sla_hours.js
    null,
    function(data, ctx, next){
        let r = {result: [{wr: "None", result: 0}]};
        if (data && data.rows && data.rows.length > 0){
            r.result = data.rows.map(row => {
                return [{wr: row.request_id + ': ' + row.brief, result: row.hours}];
            });
        }
        next(r);
    },
    function(ckb, ctx, next, error){
        cache.wait(cache.key(ckb, ctx))
            .then(next)
            .timeout(() => { error(new Error('sla_unquoted: cache timed out')); })
            .limit(47);
    }
);

