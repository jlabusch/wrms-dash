var store = require('./data_store'),
    util  = require('./util');

const DEBUG = true;

// List all the WRs for a particular org/sys/period.
module.exports = function(req, res, next, ctx){
    store.query(
        util.trim  `SELECT  w.id as request_id,
                            w.brief,
                            w.created_on as request_on,
                            w.status,
                            w.urgency,
                            w.importance
                    FROM    wrs w
                    JOIN    contract_system_link cs ON cs.system_id=w.system_id
                    JOIN    contracts c ON c.id=cs.contract_id
                    WHERE   c.org_id=?
                    AND     w.created_on=?
                    AND     w.system_id IN (${ctx.sys.join(',')})
                    ORDER   BY w.urgency,w.status ASC`,
        ctx.org,
        ctx.period,
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
            if (DEBUG){
                data.forEach(d => {
                    util.log_debug(__filename, [d.request_id,d.brief,d.status].join(','), DEBUG);
                });
            }
            res.charSet('utf-8');
            res.json(data);
            next && next(false);
        }
    );
}

