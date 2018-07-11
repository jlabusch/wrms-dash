var store = require('./data_store'),
    util  = require('./util');

module.exports = function(req, res, next, ctx){
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
                    AND     b.id LIKE '%${ctx.period}'`,
        ctx.org,
        (err, data) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.json({error: err.message});
                next && next(false);
                return;
            }

            if (!Array.isArray(data) || data.length < 1){
                const msg = "couldn't determine SLA hours" ;
                util.log(__filename, 'ERROR: ' + msg);
                res.json({error: msg});
                next && next(false);
                return;
            }

            let b = data[0];

            util.log_debug(__filename, 'raw data: ' + JSON.stringify(data, null, 2));

            res.charSet('utf-8');
            res.json({
                budget: b.base_hours,
                result: [
                    ['SLA quotes', b.sla_quote_hours],
                    ['SLA unquoted', b.base_hours_spent - b.sla_quote_hours],
                    ['Additional quotes', b.additional_hours]
                ]
            });

            next && next(false);
        }
    );
}

