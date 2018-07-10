var store = require('./data_store'),
    util = require('./util');

module.exports = function(req, res, next, ctx){
    let systems = ctx.sys.join(',');

    store.query(
        util.trim  `SELECT  w.id AS request_id,
                            w.brief,
                            w.detailed AS description,
                            w.status
                    FROM    wrs w
                    JOIN    contract_system_link cs ON cs.system_id=w.system_id
                    JOIN    contracts c ON c.id=cs.contract_id
                    WHERE   w.system_id IN (${systems})
                    AND     c.org_id=?
                    AND     w.brief like '%eployment%'
                    ORDER BY w.id`,
        ctx.org,
        (err, data) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.json({error: err.message});
                next && next(false);
                return;
            }

            if (!Array.isArray(data)){
                data = [];
            }

            let re_str = 'deployment.*' + ctx.year + '[-/]?0?' + ctx.month + '[-/]?\\d\\d',
                re = new RegExp(re_str, 'i');

            res.charSet('utf-8');
            res.json(data.filter(row => { return !!row.brief.match(re) }));

            next && next(false);
        }
    );
}

