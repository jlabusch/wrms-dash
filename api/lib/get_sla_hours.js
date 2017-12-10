var config= require('config'),
    query = require('./query'),
    http  = require('http'),
    cache = require('./cache'),
    util  = require('./util');

const HOURS = 60*60*1000,
      DEBUG = false;

module.exports = query.prepare(
    'sla_hours',
    'sla_hours',
    function(ctx){
        return `SELECT r.request_id,r.brief,r.invoice_to,SUM(ts.work_quantity) AS hours,otag.tag_description as tag
                FROM request r
                JOIN request_timesheet ts ON r.request_id=ts.request_id
                LEFT JOIN request_tag rtag ON r.request_id=rtag.request_id
                LEFT JOIN organisation_tag otag ON otag.tag_id=rtag.tag_id
                JOIN usr u ON u.user_no=r.requester_id
                WHERE u.org_code=${ctx.org}
                    AND r.system_id IN (${ctx.sys.join(',')})
                    AND ts.work_on >= '${ctx.period + '-01'}'
                    AND ts.work_on < '${util.next_period(ctx) + '-01'}'
                    AND ts.work_units='hours'
                GROUP BY r.request_id,otag.tag_description`;
    },
    function(data, ctx, next){
        let ts = {};
        if (data && data.rows && data.rows.length > 0){
            let warranty_wrs = {};
            data.rows.forEach(row => {
                // Don't add hours if we find a Warranty tag.
                // It sucks that the cache is a low-level DB cache, that means
                // get_sla_unquoted.js has to repeat all of the Warranty
                // pruning logic.
                if (row.tag === 'Warranty'){
                    warranty_wrs[row.request_id] = true;
                    delete ts[row.request_id];
                }else if (!warranty_wrs[row.request_id]){
                    ts[row.request_id] = util.calculate_timesheet_hours(row.hours, row.invoice_to, ctx);
                }
            });
            util.log_debug(__filename, JSON.stringify(ts, null, 2), DEBUG);
        }
        let budget = 0;
        if (util.orgs[ctx.org] && util.orgs[ctx.org].budget_hours){
            budget = util.orgs[ctx.org].budget_hours;
        }
        cache.wait(cache.key('approved_quotes',ctx))
            .then((aq) => {
                let sla = 0,
                    add = 0;
                aq.rows.forEach(row => {
                    if (util.is_sla_quote(row, ctx)){
                        sla += util.convert_quote_amount(row);
                    }else if (util.is_additional_quote(row, ctx)){
                        add += util.convert_quote_amount(row);
                    }
                    // Delete timesheets if there has ever been any kind of quote,
                    // even if it's for a different month.
                    delete ts[row.request_id];
                    util.log_debug(__filename, 'deleting timesheets for ' + row.request_id + ', it has a quote', DEBUG);
                });
                util.log_debug(__filename, JSON.stringify(ts, null, 2), DEBUG);
                let t = Object.keys(ts).reduce((acc, val) => {
                    return acc + ts[val];
                }, 0);
                util.log_debug(__filename, 'sum of unquoted SLA hours: ' + t, DEBUG);
                next({
                    budget: budget,
                    result: [
                        ['SLA quotes', sla],
                        ['SLA unquoted', t],
                        ['Additional quotes', add]
                    ]
                });
            })
            .timeout(() => {
                next({
                    budget: 0,
                    result: [
                        ['SLA quotes', 0],
                        ['SLA unquoted', 0],
                        ['Additional quotes', 0]
                    ]
                });
            })
            .limit(17);
    }
);

