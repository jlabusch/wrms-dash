var query = require('./query');

module.exports = query.prepare(
    'customer',
    'cust', 
    function(ctx){
        return `SELECT org_code,org_name,system_id,system_desc
                FROM organisation,work_system
                WHERE org_code=${ctx.org} AND system_id IN (${ctx.sys.join(',')})`;
    },
    function(data, ctx, next){
        let r = {
            result: 0,
            org: { id: ctx.org },
            system: { id: ctx.sys }
        };
        if (data && data.rows && data.rows.length > 0){
            r.org.name = data.rows[0].org_name;
            r.system.name = data.rows.map(row => { return row.system_desc }).join(', ');
        }
        next(r);
    }
)
