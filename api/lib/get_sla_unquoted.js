var store = require('./data_store'),
    sync  = require('./data_sync'),
    util  = require('./util');

module.exports = function(req, res, next, ctx){
    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    store.query(
        // Get hours on WRs that don't have quotes
        // and aren't tagged additional or unchargeable
        util.trim  `SELECT  w.id AS request_id,
                            w.brief,
                            t.hours AS result
                    FROM    wrs w
                    JOIN    contract_system_link cs ON cs.system_id=w.system_id
                    JOIN    contracts c ON c.id=cs.contract_id
                    JOIN    timesheets t ON t.wr_id=w.id
                    WHERE   w.system_id IN (${ctx.sys.join(',')})
                    AND     t.worked_on=?
                    AND     w.tag_additional=0
                    AND     w.tag_unchargeable=0
                    AND     c.org_id=?
                    ORDER BY w.id`,
        ctx.period,
        ctx.org,
        handler(data => {
            let r = {result: [{wr: "None", result: 0}]};

            util.log_debug(__filename, 'raw data: ' + JSON.stringify(data, null, 2));

            if (Array.isArray(data) && data.length > 0){
                // Compress the list to one element per WR
                let wrs = {};

                data.forEach(d => {
                    let wr = wrs[d.request_id] || {
                        wr: d.request_id + ': ' + d.brief,
                        result: 0
                    };

                    wr.result += d.result;

                    wrs[d.request_id] = wr;
                });

                // Reformat elements slightly
                r.result = Object.values(wrs).map(d => {
                    return {
                        wr: d.wr,
                        result: Math.round(d.result*10)/10
                    };
                });
            }

            return r;
        })
    );
}
