var store = require('./data_store'),
    sync  = require('./data_sync'),
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
                                q.hours AS quote_amount
                        FROM    wrs w
                        JOIN    quotes q ON q.wr_id=w.id
                        JOIN    contract_system_link cs ON cs.system_id=w.system_id
                        JOIN    contracts c ON c.id=cs.contract_id
                        WHERE   c.org_id=?
                        AND     w.system_id IN (${ctx.sys.join(',')})
                        AND     w.status!='Cancelled'
                        ${args.limit_period ? "AND q.approved_on='" + ctx.period + "'" : ''}
                        ${args.sla === true ?  'AND q.additional=0' :
                          args.sla === false ? 'AND q.additional=1' :
                          '' /* undefined => don't care */}
                        AND     q.approved=?
                        AND     q.valid=1
                        ORDER BY w.id,q.id DESC
                        `,
            ctx.org,
            args.approved|0,
            handler(data => {
                util.log_debug(__filename, 'get_quotes(' + JSON.stringify(args) + ') query returned ' + JSON.stringify(data, null, 2));
                if (!Array.isArray(data)){
                    data = [];
                }

                // Compress the list to one element per WR
                let wrs = {};

                data.forEach(d => {
                    let wr = wrs[d.request_id] || {
                        wr: d.request_id + ': ' + d.brief,
                        request_id: d.request_id,
                        brief: d.brief,
                        quote_amount: 0,
                        quote_units: 'hours'
                    };

                    wr.quote_amount += d.quote_amount;

                    wrs[d.request_id] = wr;
                });

                // Reformat each list element to fit the query type
                return {
                    result: Object.values(wrs).map(d => {
                        const amount = Math.round(d.quote_amount*10)/10;

                        if (args.approved){
                            return { wr: d.wr, result: amount };
                        }else{
                            d.quote_amount = amount;
                            d.quote_units = 'hours';
                            return d;
                        }
                    })
                };
            })
        );
    }
}

