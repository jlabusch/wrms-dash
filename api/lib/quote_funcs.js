var util = require('./util');

exports.exclude_additional_quote_statuses = ['F', 'H', 'M'];

function describe_quote(row){
    // Rule 1: In the absence of other metadata,
    //  - treat this as SLA because it's in an SLA system,
    //  - and period=actual time of approval.
    let r = {
        additional: false,
        sla: true,
        period: undefined
    };

    if (row.approved_on){
        let approval_match = row.approved_on.match(/^(\d\d\d\d-\d\d)/);
        if (approval_match){
            r.period = approval_match[1];
            // TODO: timezones... but with month granularity, not a killer.
        }
    }

    // Rule 2: If the WR has a tag named "Additional", make the default
    // additional=true instead.
    if (row.tags && row.tags.match(/\bAdditional\b/)){
        r.additional = true;
        r.sla = false;
    }

    // Rule 3: The invoice_to field always overrides everything else.
    if (row.invoice_to){
        let m = row.invoice_to.match(new RegExp(row.quote_id + '\\s*:\\s*(\\d\\d\\d\\d).0?(\\d+)\\s+(\\w+)'));
        if (m){
            r.sla = m[3].match(/(SLA|Service)/i);
            r.additional = !r.sla;
            r.period = m[1] + '-' + m[2];
        }
    }

    util.log_debug(__filename, 'WR ' + row.request_id + ' quote ' + row.quote_id + ': "' + row.invoice_to + '" -> ' + JSON.stringify(r));
    return r;
}

exports.describe_quote = describe_quote;

exports.is_sla_quote_for_this_period = function(row, context){
    let q = describe_quote(row);
    return  q.sla &&
            q.period === context.period;
}

exports.is_additional_quote_for_this_period = function(row, context){
    let q = describe_quote(row);
    return  q.additional &&
            (q.period === context.period || q.period === undefined) &&
            ['H', 'M'].indexOf(row.last_status) < 0;
}

// We've made an explicit decision here to IGNORE quotes that are
// not measured in time. Hours and days are fine, GBP/EUR/USD are
// ignored.
function convert_quote_amount(row){
    if (row.quote_units === 'days'){
        return row.quote_amount * 8;
    }
    if (row.quote_units === 'hours'){
        return row.quote_amount;
    }
    return 0;
}

exports.convert_quote_amount = convert_quote_amount;

exports.quote_sql = function(context, approved){
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
                    CASE WHEN q.quote_units = 'days' THEN q.quote_amount*8
                         ELSE q.quote_amount
                    END AS quote_amount,
                    q.approved_on,
                    CASE WHEN q.quote_units = 'days' THEN 'hours'
                         ELSE q.quote_units
                    END AS quote_units
            FROM request r
            JOIN request_quote q ON q.request_id=r.request_id
            JOIN usr u ON u.user_no=r.requester_id
            WHERE u.org_code=${context.org}
              AND r.system_id IN (${context.sys.join(',')})
              AND r.last_status NOT IN ('C')
              ${
                approved ?
                    "AND q.approved_by_id IS NOT NULL "
                :
                    "AND q.approved_by_id IS NULL " +
                    "AND q.quoted_on >= current_date - interval '1 month' "
              }
              AND q.quote_cancelled_by IS NULL
              AND q.quote_units in ('days', 'hours')
            ORDER BY r.request_id`;
}

exports.make_query_handler = function(pred, transform){
    return function(data, context, next){
        let r = { result: [ {wr: "None", result: 0} ] };
        if (data && data.rows){
            let wr_data = {},
                any = false;
            data.rows
                .filter(pred(context))
                .forEach(row => {
                    any = true;
                    let key = row.request_id + ': ' + row.brief;
                    if (!wr_data[key]){
                        wr_data[key] = row;
                        wr_data[key].quote_sum = 0;
                    }
                    let x = wr_data[key].quote_sum;
                    wr_data[key].quote_sum = x + convert_quote_amount(row);
                });
            if (any){
                r.result = Object.keys(wr_data).map(key => {
                    return transform(key, wr_data);
                });
            }
        }
        next(r);
    }
}

