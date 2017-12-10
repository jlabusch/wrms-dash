var config= require('config'),
    query = require('./query'),
    util  = require('./util');

module.exports = function(pred){
    return query.prepare(
        'approved_quotes',
        'approved_quotes',
        (ctx) => {
            return `SELECT  r.request_id,
                            r.brief,
                            r.invoice_to,
                            r.last_status,
                            (
                                SELECT string_agg(otag.tag_description, ',')
                                FROM organisation_tag otag
                                JOIN request_tag rtag ON rtag.tag_id=otag.tag_id
                                WHERE rtag.request_id=r.request_id
                            ) as tags,
                            q.quote_id,
                            q.quote_amount,
                            q.approved_on,
                            q.quote_units
                    FROM request r
                    JOIN request_quote q ON q.request_id=r.request_id
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${ctx.org}
                      AND r.system_id IN (${ctx.sys.join(',')})
                      AND r.last_status NOT IN ('C')
                      AND q.approved_by_id IS NOT NULL
                      AND q.quote_cancelled_by IS NULL
                      AND q.quote_units in ('days', 'hours')
                    ORDER BY r.request_id`
        },
        (data, ctx, next) => {
            let r = { result: [ {wr: "None", result: 0} ] };
            if (data && data.rows){
                let quote_sum = {},
                    any = false;
                data.rows
                    .filter(pred(ctx))
                    .forEach(row => {
                        any = true;
                        let key = row.request_id + ': ' + row.brief;
                        let x = quote_sum[key] || 0;
                        quote_sum[key] = x + util.convert_quote_amount(row);
                    });
                if (any){
                    r.result = Object.keys(quote_sum).map(key => {
                        return {wr: key, result: Math.round(quote_sum[key]*10)/10};
                    });
                }
            }
            next(r);
        }
    );
}

