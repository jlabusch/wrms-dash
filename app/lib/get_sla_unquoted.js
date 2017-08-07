var get_dash_context = require('./context'),
    query = require('./query'),
    cache = require('./cache'),
    util  = require('./util');

module.exports = function(req, res, next){
    let ctx = get_dash_context(req);

    if (ctx.error){
        util.log(__filename, ctx.error);
        res.json({error: ctx.error});
        return;
    }

    function process_results(tsdata, qdata){
        let r = {result: []};
        if (tsdata && tsdata.rows && tsdata.rows.length > 0 && qdata && Array.isArray(qdata.rows)){
            let wrs_with_time = {};
            tsdata.rows.forEach(row => {
                wrs_with_time[row.request_id] = row;
            });
            qdata.rows.forEach(row => {
                delete wrs_with_time[row.request_id];
            });
            r.result = Object.keys(wrs_with_time).sort().map(key => {
                let row = wrs_with_time[key],
                    n = util.parse_timesheet_adjustment(row.invoice_to, ctx);
                return [{wr: row.request_id + ': ' + row.brief, result: util.round_hrs(row.hours + n)}];
            });
        }else{
            r.result.push({wr: "None", result: 0});
        }
        res.json(r);
        next && next(false);
    }

    cache.wait(cache.key('sla_hours', ctx))
        .then((tsdata) => {
            cache.wait(cache.key('approved_quotes', ctx))
                .then((qdata) => { process_results(tsdata, qdata) })
                .timeout(() => { query.error(res, next)(new Error('sla_unquoted: quote cache timed out')); })
                .limit(40);
        })
        .timeout(() => { query.error(res, next)(new Error('sla_unquoted: timesheet cache timed out')); })
        .limit(40);
}


