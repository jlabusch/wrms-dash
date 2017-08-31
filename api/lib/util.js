var config = require('config'),
    crypto = require('crypto'),
    basename = require('path').basename;

function log(sourcefile, msg){
    console.log((new Date()).toISOString() + ' ' + basename(sourcefile) + ' | ' + msg);
}

exports.log = log;

function log_debug(sourcefile, msg, force_on){
    if (force_on || process.env['API_DEBUG']){
        log.apply(this, arguments);
    }
}

exports.log_debug = log_debug;

exports.encrypt = function encrypt(text){
    let cipher = crypto.createCipher('aes-256-ctr', 'timesheet_adjustments'),
        out = cipher.update(text, 'utf8', 'hex');

    out += cipher.final('hex');

    return out;
}

function decrypt(text){
    let cipher = crypto.createCipher('aes-256-ctr', 'timesheet_adjustments'),
        out = cipher.update(text, 'hex', 'utf8')

    out += cipher.final('utf8');

    return out;
}

exports.decrypt = decrypt;

exports.exclude_additional_quote_statuses = ['F', 'H', 'M'];

exports.orgs = (function(cfg){
    let o = JSON.parse(JSON.stringify(cfg));
    Object.keys(o).forEach(name => {
        o[name].name = name;
        o[ o[name].id ] = o[name];
    });
    return o;
})(config.get('orgs'));

function parse_timesheet_adjustment(invoice_to, ctx){
    let r = (h) => { return h };

    if (!invoice_to){
        return r;
    }

    let adj = invoice_to.match(/Adjust:\s*([a-f0-9]+)/i);

    if (!adj){
        return r;
    }

    let cmd = decrypt(adj[1]),
        // Examples: 2017-07 timesheets -7 hours
        //           2017-6  timesheets *0.5 hours
        //           2017-4  timesheets +1.5 hours
        // We only match one adjustment.
        parts = cmd.match(new RegExp(ctx.year + '-0?' + ctx.month + '\\s+time[0-9a-z]*\\s*([+*-]?)\\s*([0-9.]+)\\s*hours', 'i'));

    if (!parts){
        log_debug(__filename, "Timesheet adjustment invalid or not for this month: " + cmd);
        return r;
    }

    let op = parts[1],
        n  = parseFloat(parts[2]);

    if (isNaN(n)){
        log(__filename, "Couldn't parse timesheet adjustment value '" + parts[2] + "' in " + cmd);
        return r;
    }

    log(__filename, 'Manual timesheet adjustment: ' + cmd + ' -> ' + op + r);

    switch(op){
        case '-':
            r = (h) => { return h-n };
            break;
        case '*':
            r = (h) => { return h*n };
            break;
        default:
            // '' or '+'
            r = (h) => { return h+n };
    }

    return r;
}

exports.parse_timesheet_adjustment = parse_timesheet_adjustment;

exports.calculate_timesheet_hours = function(hours, invoice_to, context){
    let adj = parse_timesheet_adjustment(invoice_to, context);
    return round_hrs(adj(hours));
}

function describe_quote(row){
    let r = {
        additional: true,
        sla: false,
        period: undefined
    };

    if (row.invoice_to){
        let m = row.invoice_to.match(new RegExp(row.quote_id + '\\s*:\\s*(\\d\\d\\d\\d).0?(\\d+)\\s+(\\w+)'));
        if (m){
            r.sla = m[3].match(/(SLA|Service)/i);
            r.additional = !r.sla;
            r.period = m[1] + '-' + m[2];
        }
    }

    log_debug(__filename, 'WR ' + row.request_id + ' quote ' + row.quote_id + ': "' + row.invoice_to + '" -> ' + JSON.stringify(r));
    return r;
}

exports.describe_quote = describe_quote;

exports.is_sla_quote = function(row, context){
    let q = describe_quote(row);
    return  q.sla &&
            q.period === context.period;
}

exports.is_additional_quote = function(row, context){
    let q = describe_quote(row);
    return  q.additional &&
            (q.period === context.period || q.period === undefined) &&
            ['H', 'M'].indexOf(row.last_status) < 0;
}

// We've made an explicit decision here to IGNORE quotes that are
// not measured in time. Hours and days are fine, GBP/EUR/USD are
// ignored.
exports.convert_quote_amount = function(row){
    if (row.quote_units === 'days'){
        return row.quote_amount * 8;
    }
    if (row.quote_units === 'hours'){
        return row.quote_amount;
    }
    return 0;
}

exports.parse_period = function(str){
    let r = null,
        m = str.match(/^(\d\d\d\d)-0?(\d\d?)$/);
    if (m){
        r = {
            period: str.replace(/-0/, '-'),
            year: parseInt(m[1]),
            month: parseInt(m[2])
        }
    }else{
        log_debug(__filename, 'parse_period: "' + str + '" failed');
    }
    return r;
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
                   urg.lookup_desc as urgency,
                   imp.lookup_desc as importance
            FROM request r
            JOIN usr u ON u.user_no=r.requester_id
            JOIN lookup_code stat on stat.source_table='request'
               AND stat.source_field='status_code'
               AND stat.lookup_code=r.last_status
            JOIN lookup_code urg on urg.source_table='request'
               AND urg.source_field='urgency'
               AND urg.lookup_code=cast(r.urgency as text)
            JOIN lookup_code imp on urg.source_table='request'
               AND imp.source_field='importance'
               AND imp.lookup_code=cast(r.importance as text)
            WHERE u.org_code=${context.org}
               ${this_period_only ? and_period : ''}
               AND r.system_id in (${context.sys.join(',')})
               ${exclude_statuses.length ? and_status : ''}
            ORDER BY r.urgency,r.last_status ASC`.replace(/\s+/g, ' ');
}

function round_hrs(h){
    let i = h|0;
    h-=i;
    if (h > 0.5) h = 1;
    else if (h > 0) h = 0.5;
    else h = 0;
    return i+h;
}

exports.round_hrs = round_hrs;

exports.map_severity = function(urg, imp){
    const urgs = {
        "Anytime": 0,
        "Sometime soon": 1,
        "As Soon As Possible": 2,
        "Before Specified Date": 2,
        "On Specified Date": 2,
        "After Specified Date": 2,
        "'Yesterday'": 3
    };
    let urg_n = urgs[urg];

    const imps  = [
        "Minor importance",
        "Average importance",
        "Major importance",
        "Critical!"
    ];
    let imp_n = imps.indexOf(imp);

    const severity = [
        'Low',
        'Medium',
        'High',
        'Critical'
    ];

    let n = Math.max(urg_n, imp_n);

    return {
        name: severity[n],
        number: n
    };
}

function next_period_obj(context){
    let y = context.year,
        m = context.month + 1;
    if (m > 12){
        m = 1;
        y++;
    }
    let r = {year: y, month: m, period: y + '-' + m};
    return r;
}

exports.next_period_obj = next_period_obj;

function next_period(context){
    return next_period_obj(context).period;
}

exports.next_period = next_period;

