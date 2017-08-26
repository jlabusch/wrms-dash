var query = require('./query'),
    util = require('./util');

module.exports = query.prepare(
    'wrs_created_count',
    'wcc',
    function(ctx){
        return `SELECT COUNT(*)
                FROM request r
                JOIN usr u ON u.user_no=r.requester_id
                WHERE u.org_code=${ctx.org}
                    AND r.system_id IN (${ctx.sys.join(',')})
                    AND r.request_on >= '${ctx.period + '-01'}'
                    AND r.request_on < '${util.next_period(ctx) + '-01'}'`;
    },
    function(data, ctx, next){
        let r = {
            result: 0
        }
        if (data && data.rows && data.rows.length > 0){
            r.result = parseInt(data.rows[0].count);
        }
        next(r);
    }
)
