var store = require('./data_store'),
    util  = require('./util');

module.exports = function(req, res, next, ctx){
    store.query(
        // hours on WRs that don't have quotes
        // and aren't tagged additional or unchargeable
        util.trim  `SELECT  w.id,
                            w.brief,
                            SUM(t.hours) AS result
                    FROM    wrs w
                    JOIN    contract_system_link cs ON cs.system_id=w.system_id
                    JOIN    contracts c ON c.id=cs.contract_id
                    JOIN    contract_budget_link cb ON cb.contract_id=c.id
                    JOIN    budgets b ON b.id=cb.budget_id
                    JOIN    timesheets t ON t.wr_id=w.id AND t.budget_id=b.id
                    WHERE   w.system_id IN (${ctx.sys.join(',')})
                    AND     w.tag_additional=0
                    AND     w.tag_unchargeable=0
                    AND     c.org_id=?
                    AND     b.id LIKE '%${ctx.period}'
                    GROUP BY w.id,w.brief
                    ORDER BY w.id`,
        ctx.org,
        (err, data) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.json({error: err.message});
                next && next(false);
                return;
            }

            let r = {result: [{wr: "None", result: 0}]};

            if (Array.isArray(data) && data.length > 0){
                r.result = data.map(row => {
                    return {
                        wr: row.id + ': ' + row.brief,
                        result: row.result
                    };
                });
            }
            res.charSet('utf-8');
            res.json(r);

            next && next(false);
        }
    );
}
