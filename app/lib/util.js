var config = require('config');

exports.exclude_additional_quote_statuses = ['F', 'H', 'M'];

exports.orgs = (function(cfg){
    let o = JSON.parse(JSON.stringify(cfg));
    Object.keys(o).forEach(name => {
        o[ o[name].id ] = o[name];
    });
    return o;
})(config.get('orgs'));

exports.is_sla_quote = function(row, ctx, loose_match){
    if (!row.invoice_to){
        return false;
    }
    let rs  = loose_match
                ? row.quote_id + '\\s*:\\s*' + '\\d\\d\\d\\d' + '.\\d\\d?'        + '\\s+SLA'
                : row.quote_id + '\\s*:\\s*' + ctx.year       + '.0?' + ctx.month + '\\s+SLA',
        m   = row.invoice_to.match(new RegExp(rs));
    //console.log('check WR ' + row.request_id + ' quote vs ' + rs + ': "' + row.invoice_to + '" -> ' + JSON.stringify(m));
    return !!m;
}

exports.convert_quote_amount = function(row){
    return row.quote_units === 'days'
            ? 8*row.quote_amount
            : row.quote_units === 'pounds'
                ? row.quote_amount/85
                : row.quote_amount;
}

exports.wr_list_sql = function(context, this_period_only, exclude_statuses){
    exclude_statuses = exclude_statuses || ["'C'", "'F'"];
    let and_period =   `AND r.request_on >= '${context.period + '-01'}'                 
                        AND r.request_on < '${next_period(context) + '-01'}'`,
        and_status =   `AND r.last_status not in (${exclude_statuses.join(',')})`;

    return `SELECT r.request_id,
                   r.brief,
                   r.request_on,
                   stat.lookup_desc as status,
                   urg.lookup_desc as urgency
            FROM request r
            JOIN usr u ON u.user_no=r.requester_id
            JOIN lookup_code stat on stat.source_table='request'
               AND stat.source_field='status_code'
               AND stat.lookup_code=r.last_status
            JOIN lookup_code urg on urg.source_table='request'
               AND urg.source_field='urgency'
               AND urg.lookup_code=cast(r.urgency as text)
            WHERE u.org_code=${context.org}
               ${this_period_only ? and_period : ''}
               AND r.system_id in (${context.sys.join(',')})
               ${exclude_statuses.length ? and_status : ''}
            ORDER BY r.urgency,r.last_status ASC`.replace(/\s+/g, ' ');
}

exports.map_severity = function(urg){
    var urgency = {
        "'Yesterday'": 3,
        "As Soon As Possible": 2,
        "Before Specified Date": 2,
        "On Specified Date": 2,
        "After Specified Date": 2,
        "Sometime soon": 1,
        "Anytime": 0
    };
    var severity = [
        'Low',
        'Medium',
        'High',
        'Critical'
    ];
    return {
        name: severity[ urgency[urg] ],
        number: urgency[urg]
    };
}

function next_period(context){
    let y = parseInt(context.year),
        m = parseInt(context.month) + 1;
    if (m > 12){
        m = 1;
        y++;
    }
    return y + '-' + m;
}

exports.next_period = next_period;

