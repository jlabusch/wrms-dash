var store = require('./data_store'),
    util  = require('./util');

module.exports = function(req, res, next, ctx){
    store.query(
        util.trim  `SELECT  COUNT(*) AS result
                    FROM    wrs w
                    JOIN    contract_system_link cs ON cs.system_id=w.system_id
                    JOIN    contracts c ON c.id=cs.contract_id
                    WHERE   w.created_on=?
                    AND     w.system_id IN (${ctx.sys.join(',')})
                    AND     c.org_id=?`,
        ctx.period,
        ctx.org,
        (err, data) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.json({error: err.message});
                next && next(false);
                return;
            }
            res.charSet('utf-8');
            res.json(data[0]);
            next && next(false);
        }
    );
}

