var query = require('./query'),
    org_data = require('./org_data'),
    qf = require('./quote_funcs'),
    util = require('./util');

// result format = {
//   <YYYY-MM>: {
//     month: <YYYY-MM>
//     <org_name>: <hours>
//     total: <hours>
//   },
//   ...
// }
module.exports = query.prepare(
    'raw_timesheets',
    'raw_timesheets',
    function(ctx){
        return `SELECT  u.org_code AS org_id,
                        o.org_name,
                        r.request_id,
                        t.work_on,
                        t.work_quantity,
                        t.work_by_id
                FROM request_timesheet t
                JOIN request r ON r.request_id=t.request_id
                JOIN usr u ON u.user_no=r.requester_id
                JOIN organisation o ON o.org_code=u.org_code
                WHERE u.org_code IN (${org_data.active().get_all_orgs().join(",")})
                  AND t.work_on >= current_date - interval '13 months'
                ORDER BY r.request_id,t.work_on`.replace(/\s+/, ' ');
    },
    function(data, ctx, next){
        let r = {};
        if (data && data.rows && data.rows.length > 0){
            data.rows.forEach(row => {
                let period = util.date_fmt(new Date(row.work_on.replace(/T\d\d:/, 'T12:')));

                let o = r[period] || {
                    month: period,
                    total: 0
                };

                o.total += row.work_quantity;
                
                let n = o[row.org_name] || 0;
                n += row.work_quantity;
                o[row.org_name] = n;

                r[period] = o;
            });
        }
        next(r);
    }
)
