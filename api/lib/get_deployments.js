var store = require('./data_store_query'),
    util = require('wrms-dash-util');

module.exports = function(req, res, next, ctx){
    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    store.query(
        util.trim  `SELECT  w.id AS request_id,
                            w.brief,
                            w.detailed AS description,
                            w.status
                    FROM    wrs w
                    JOIN    contract_system_link cs ON cs.system_id=w.system_id
                    JOIN    contracts c ON c.id=cs.contract_id
                    WHERE   w.system_id IN (${ctx.sys.join(',')})
                    AND     c.org_id=?
                    AND     w.brief like '%eployment%'
                    ORDER BY w.id`,
        ctx.org,
        handler(data => {
            if (!Array.isArray(data)){
                data = [];
            }

            let re_str = 'deployment.*' + ctx.year + '[-/]?0?' + ctx.month + '[-/]?\\d\\d',
                re = new RegExp(re_str, 'i');

            return data.filter(row => { return !!row.brief.match(re) });
        })
    );
}

