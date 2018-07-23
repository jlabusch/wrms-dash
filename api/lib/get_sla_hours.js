var store = require('./data_store'),
    sync  = require('./data_sync'),
    odata = require('./org_data'),
    util  = require('./util');

module.exports = function(req, res, next, ctx){
    let handler = store.make_query_handler(req, res, next, ctx, __filename);

    let org = odata.get_org(ctx);

    store.query(
        util.trim  `SELECT  b.id,
                            b.base_hours,
                            b.base_hours_spent,
                            b.sla_quote_hours,
                            b.additional_hours
                    FROM    budgets b
                    JOIN    contract_budget_link cb ON cb.budget_id=b.id
                    JOIN    contracts c ON c.id=cb.contract_id
                    JOIN    contract_system_link cs ON cs.contract_id=c.id
                    WHERE   c.org_id=?
                    AND     cs.system_id IN (${ctx.sys.join(',')})
                    GROUP BY b.id`,
        ctx.org,
        handler(data => {
            if (!Array.isArray(data) || data.length < 1){
                throw new Error("couldn't determine SLA hours for " + JSON.stringify(ctx));
            }

            util.log_debug(__filename, 'raw data: ' + JSON.stringify(data, null, 2));

            let monthly_name = sync.create_budget_name(org, 'month', ctx.period);

            let r = {
                budget: 0,
                result: [
                    ['SLA quotes', 0],
                    ['SLA unquoted', 0],
                    ['Additional quotes', 0]
                ]
            };

            // Sum up ALL the relevant budgets.
            // This logic is very similar to data_sync.js:select_best_budget()
            data.forEach(d => {
                let relevant = d.id === monthly_name || sync.match_non_monthly_budget_name(d.id, ctx);

                util.log_debug(__filename, 'Considering "' + d.id + '" ' + (relevant ? 'relevant' : 'not relevant'));

                if (relevant){
                    r.budget += d.base_hours;
                    r.result[0][1] += d.sla_quote_hours;
                    r.result[1][1] += d.base_hours_spent - d.sla_quote_hours;
                    r.result[2][1] += d.additional_hours;
                }
            });

            return r;
        })
    );
}

