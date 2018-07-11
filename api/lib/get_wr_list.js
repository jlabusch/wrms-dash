var store = require('./data_store'),
    util  = require('./util');

const DEBUG = false;

// List all the WRs for a particular org/sys/period.
//
// args.exclude_statuses -> [] (default finished/cancelled/ongoing maint)
// args.limit_period -> true, false (default false)
// args.processor -> function(rows) (default no-op)
module.exports = function(args){
    if (!Array.isArray(args.exclude_statuses)){
        args.exclude_statuses = ["'Finished'", "'Cancelled'", "'Ongoing Maintenance'"];
    }

    return function(req, res, next, ctx){
        const sql = util.trim `
            SELECT  w.id as request_id,
                    w.brief,
                    w.created_on as request_on,
                    w.status,
                    w.urgency,
                    w.importance
            FROM    wrs w
            JOIN    contract_system_link cs ON cs.system_id=w.system_id
            JOIN    contracts c ON c.id=cs.contract_id
            WHERE   c.org_id=?
            ${args.limit_period ? 'AND w.created_on=?' : ''}
            ${args.exclude_statuses.length ? 'AND w.status NOT IN (' + args.exclude_statuses.join(',') + ')' : ''}
            AND     w.system_id IN (${ctx.sys.join(',')})
            ORDER   BY w.urgency,w.status ASC`;

        let query_args = [sql, ctx.org];

        if (args.limit_period){
            query_args.push(ctx.period);
        }

        query_args.push(
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
                if (args.processor){
                    data = args.processor(data);
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

        store.query.apply(null, query_args);
    }
}

