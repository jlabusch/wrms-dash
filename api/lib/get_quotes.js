var store = require('./data_store'),
    util  = require('./util');

// args.sla -> true, false, undefined
// args.approved -> true, false
// args.limit_period -> true, false
module.exports = function(args){
    return function(req, res, next, ctx){
        let handler = store.make_query_handler(req, res, next, ctx, __filename);

        store.query(
            util.trim  `SELECT  w.id AS request_id,
                                w.brief,
                                SUM(q.hours) AS quote_sum
                        FROM    wrs w
                        JOIN    quotes q ON q.wr_id=w.id
                        JOIN    contract_system_link cs ON cs.system_id=w.system_id
                        JOIN    contracts c ON c.id=cs.contract_id
                        ${args.limit_period ? 'JOIN budgets b ON b.id=q.budget_id' : ''}
                        WHERE   c.org_id=?
                        AND     w.system_id IN (${ctx.sys.join(',')})
                        AND     w.status!='Cancelled'
                        ${args.limit_period ?  "AND  b.id LIKE '%" + ctx.period + "'" : ''}
                        ${args.sla === true ?  'AND q.additional=0' :
                          args.sla === false ? 'AND q.additional=1' :
                          '' /* undefined => don't care */}
                        AND     q.approved=?
                        AND     q.valid=1
                        GROUP BY w.id,w.brief
                        ORDER BY w.id
                        `,
            ctx.org,
            args.approved|0,
            handler(data => {
                if (!Array.isArray(data)){
                    data = [];
                }

                return {
                    result: data.map(d => {
                        const wr = d.request_id + ': ' + d.brief,
                            sum  = Math.round(d.quote_sum*10)/10;
                        if (args.approved){
                            return { wr: wr, result: sum };
                        }else{
                            d.wr = wr;
                            d.quote_amount = sum;
                            d.quote_units = 'hours';
                            return d;
                        }
                    })
                };
            })
        );
    }
}

