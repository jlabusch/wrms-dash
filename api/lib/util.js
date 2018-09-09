var config  = require('config'),
    crypto  = require('crypto'),
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

exports.parse_period = function(str){
    let r = null,
        m = str.match(/^(\d\d\d\d)-0?(\d\d?)/);
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

function date_fmt(d){
    return d ? d.getFullYear() + '-' + (d.getMonth()+1) : '';
}

exports.date_fmt = date_fmt;

exports.current_period = function(){
    let now = new Date(),
        year = now.getFullYear(),
        month = now.getMonth()+1;
    return {
        year: year,
        month: month,
        period: date_fmt(now)
    };
}

// Crunch /\s+/g into ' '
exports.trim = function(str){
    let subs = Array.prototype.slice.call(arguments, 1);

    return str.map(s => s + (subs.shift() || '')).join('').replace(/\s+/g, ' ');
}

exports.send_err_if_not_vendor = function(req, res, next, context, filename){
    if (context.org_name === '__vendor'){
        return false;
    }

    let e = {error: 'Permission denied for users from ' + context.org_name};
    filename = filename || __filename;
    log(filename, e.error);

    if (res){
        res.charSet('utf-8');
        res.json(e);
        next && next(false);
    }
    return e;
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

// Input:  3.0  3.24  3.25  3.5  3.74  3.75   4.0
// Output: 3.0  3.0   3.5   3.5  3.5   4.0    4.0
//
// But the minimum amount is 0.5.
function round_hrs(h){
    let i = h|0;
    h-=i;
    if (h >= 0.75) h = 1;
    else if (h >= 0.25) h = 0.5;
    else h = 0;
    return Math.max(0.5, i+h);
}

exports.round_to_half_hour = round_hrs;

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

// Like Promise.all(), but guarantees promises executed sequentially.
//
//  - This function has the same fail-fast behaviour as Promise.all() unless on_error_continue
//    is set, in which case failures just add a null value to the result array.
//  - Inputs are processed starting at index i.
//
// Of course, the big problem with this idea is RAII, and we don't want the later promises
// to start executing until we're ready... so instead of a list of promises, we take in a
// list of inputs and a promise generator function:
//
//      generator(inputs[i]) => Promise
//
// Final resolve() contains a list of all values returned by the sequence's resolution.
function promise_sequence(inputs, generator, i = 0, on_error_continue = false){
    return new Promise((resolve, reject) => {
        if (!inputs){
            log_debug(__filename, `promise_sequence() no inputs`);
            return resolve([]);
        }
        promise_sequence_impl(resolve, on_error_continue ? null : reject, [], inputs, generator, i);
    });
}

exports.promise_sequence = promise_sequence;

exports.ON_ERROR_CONTINUE = true;

function promise_sequence_impl(resolve, reject, values, inputs, generator, i){
    if (i >= inputs.length){
        resolve(values);
        return;
    }
    function next(val){
        values.push(val);
        promise_sequence_impl(resolve, reject, values, inputs, generator, i+1);
    }
    generator(inputs[i]).then(
        next,
        err => {
            if (reject){
                log_debug(__filename, `promise_sequence(${i}) rejecting on error ${err.message || err}`);
                reject(err);
            }else{
                log_debug(__filename, `promise_sequence(${i}) not rejecting on error ${err.message || err}`);
                next(null);
            }
        }
    );
}

