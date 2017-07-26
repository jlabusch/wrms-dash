var config  = require('config'),
    db      = require('./db').create(),
    restify = require('restify');

'use strict';

const GENERIC_ERROR = {error: 'Service interruption - please try again later'},
    HOURS = 60*60*1000;

function _L(f){
    return require('path').basename(__filename) + '#' + f + ' - ';
}

var server = restify.createServer({
    name: 'wrms-dash-api',
    versions: [config.get('server.version')]
});

server.use(function _cors(req, res, next){
    res.setHeader('Access-Control-Allow-Origin', '*');
    let m = req.headers['access-control-request-method'];
    if (m)  res.setHeader('Access-Control-Allow-Methods', m);
    let h = req.headers['access-control-request-headers'];
    if (h)  res.setHeader('Access-Control-Allow-Headers', h);
    return next();
});

server.use(restify.bodyParser({mapParams: true}));
server.use(restify.queryParser({mapParams: true}));

server.on('uncaughtException', (req, res, route, err) => {
    console.log('restify.uncaughtException - ' + err.stack);
    res.send(500, GENERIC_ERROR);
});

function preflight(req, res, next){
    res.send(200);
    return next();
}

function setup(method, uri, handler){
    server.opts(uri + '/:org/:sys/:period', preflight);
    server[method](uri + '/:org/:sys/:period', handler);
}

function get_dash_context(req){
    let o = {};
    o.org = parseInt(req.params.org);
    if (isNaN(o.org)){
        o.org = undefined;
        o.error = "Couldn't parse org=" + req.params.org;
        return o;
    }
    if (req.params.sys.match(/^[0-9,]+$/)){
        o.sys = req.params.sys.split(/,/);
    }else{
        o.error = "Couldn't parse sys=" + req.params.sys;
        return o;
    }
    if (req.params.period.match(/^\d\d\d\d-\d\d?$/)){
        o.period = req.params.period.replace(/-0/, '-');
    }else{
        let now     = new Date(),
            YEAR    = now.getFullYear(),
            MONTH   = (now.getMonth()+1)%12;
        o.period = YEAR + '-' + MONTH;
    }
    return o;
}

var cache = {},
    CACHE_TIMELIMIT_MS = 60*1000;

function cache_key(name, context){
    return name + JSON.stringify(context);
}

function cache_put(key, val){
    var now = new Date().getTime();
    cache[key] = {ts: now, val: JSON.parse(JSON.stringify(val))};
}

function cache_get(key){
    var now = new Date().getTime();
    var item = cache[key];
    if (item){
        if (item.ts + CACHE_TIMELIMIT_MS > now){
            console.log('cache hit [' + key + ']');
            return JSON.parse(JSON.stringify(item.val));
        }
    }
    console.log('cache miss [' + key + ']');
    return null;
}

function wait_for_cache(key, next, count, on_timeout){
    count = count || 1;
    if (count > 50){
        console.log('No longer waiting for ' + key);
        on_timeout && on_timeout(next);
        return;
    }
    let c = cache_get(key);
    if (c){
        next(c, true);
    }else{
        setTimeout(function(){ wait_for_cache(key, next, count+1, on_timeout); }, 50*count);
    }
}

function convert_quote_amount(row){
    return row.quote_units === 'days'
            ? 8*row.quote_amount
            : row.quote_units === 'pounds'
                ? row.quote_amount/85
                : row.quote_amount;
}

function db_error_handler(res, next){
    return function(err){
        console.log(err);
        res.json({error: err.message});
        next && next(false);
    }
}

function get_quotes(pred, exclude_statuses){
    return function(req, res, next){
        let os = get_dash_context(req);
        if (os.error){
            console.log(o.error);
            res.json({error: os.error});
            return;
        }
        console.log('sla_quotes(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

        function success(data, cache_hit){
            let r = { result: [ {wr: "None", result: 0} ] };
            if (data && data.rows && data.rows.length > 0){
                if (!cache_hit){
                    cache_put(cache_key('approved_quotes',os), data);
                }
                let quote_sum = {},
                    any = false;
                data.rows
                    .filter(pred(os))
                    .forEach(row => {
                        any = true;
                        let key = row.request_id + ': ' + row.brief;
                        let x = quote_sum[key] || 0;
                        quote_sum[key] = x + convert_quote_amount(row);
                    });
                if (any){
                    r.result = Object.keys(quote_sum).map(key => {
                        return {wr: key, result: Math.round(quote_sum[key]*10)/10};
                    });
                }
            }
            res.json(r);
            next && next(false);
        }

        var c = cache_get(cache_key('approved_quotes',os));
        if (c){
            success(c, true);
        }else{
            db.query(
                    'approved_quotes', 
                    `SELECT r.request_id,
                            r.brief,
                            r.invoice_to,
                            q.quote_id,
                            q.quote_amount,
                            q.quote_units
                    FROM request r
                    JOIN request_quote q ON q.request_id=r.request_id
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${os.org}
                      AND r.system_id IN (${os.sys.join(',')})
                      AND r.last_status NOT IN (${exclude_statuses.join(',')})
                      AND q.approved_by_id IS NOT NULL
                      AND q.quote_cancelled_by IS NULL
                    ORDER BY r.request_id`.replace(/\s+/g, ' ')
                )
                .then(
                    success,
                    db_error_handler(res, next)
                )
        }
    }
}

function is_sla_quote(row, ctx, loose_match){
    if (!row.invoice_to){
        return false;
    }
    let p = ctx.period.split(/-/),
        rs= loose_match
            ? '' + row.quote_id
            : row.quote_id + '\\s*:\\s*' + p[0] + '.0?' + p[1],
        m = row.invoice_to.match(new RegExp(rs));
    console.log('check quote vs ' + (loose_match ? 'id ' : 'date ') + rs + ': ' + row.invoice_to + ' -> ' + JSON.stringify(m));
    return !!m;
}

setup(
    'get',
    '/sla_quotes',
    get_quotes(
        function(context){
            return function(row){
                return is_sla_quote(row, context);
            }
        },
        ["'C'"]
    )
);

setup('get', '/additional_quotes',
    get_quotes(
        function(){
            return function(row){ return !row.invoice_to || row.invoice_to.indexOf(row.quote_id) < 0; }
        },
        ["'C'", "'F'", "'H'", "'M'"]
    )
);

setup('get', '/customer', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('customer(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = {
            result: 0,
            org: { id: os.org },
            system: { id: os.sys }
        };
        if (data && data.rows && data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('customer',os), data);
            }
            r.org.name = data.rows[0].org_name;
            r.system.name = data.rows.map(row => { return row.system_desc }).join(', ');
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('customer',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'customer', 
                `SELECT org_code,org_name,system_id,system_desc
                 FROM organisation,work_system
                 WHERE org_code=${os.org} AND system_id IN (${os.sys.join(',')})
                 `.replace(/\s+/g, ' ')
            )
            .then(
                success,
                db_error_handler(res, next)
            )
    }
});

setup('get', '/wrs_created_count', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('wrs_created_count(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = {
            result: 0
        }
        if (data && data.rows && data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('wrs_created_count',os), data);
            }
            r.result = parseInt(data.rows[0].count);
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wrs_created_count', os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wrs_created_count', 
                `SELECT COUNT(*)
                 FROM request r
                 JOIN usr u ON u.user_no=r.requester_id
                 WHERE u.org_code=${os.org}
                   AND r.system_id IN (${os.sys.join(',')})
                   AND r.request_on >= '${os.period + '-01'}'
                   AND r.request_on < '${next_period(os) + '-01'}'
                 `.replace(/\s+/g, ' ')
            )
            .then(
                success,
                db_error_handler(res, next)
            )
    }
});

setup('get', '/users', function(req, res, next){
    console.log('users()');
    res.json({
        result: 1
    });
    next && next(false);
});

setup('get', '/storage', function(req, res, next){
    console.log('storage()');
    res.json({
        result: 1
    });
    next && next(false);
});

setup('get', '/availability', function(req, res, next){
    console.log('availability()');
    res.json({
        result: 1
    });
    next && next(false);
});

function map_severity(urg){
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

setup('get', '/severity', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('severity(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = [
            [ 'Low', 0 ],
            [ 'Medium', 0 ],
            [ 'High', 0 ],
            [ 'Critical', 0 ]
        ];
        if (data && data.rows && data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('wr_list-full',os), data);
            }
            data.rows.forEach(row => {
                r[map_severity(row.urgency).number][1]++;
            });
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list-full',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wr_list-full', 
                wr_list_sql(os, false)
            )
            .then(
                success,
                db_error_handler(res, next)
            )
    }
});

setup('get', '/response_times', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('response_times(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    let wr_data = undefined;

    function handle_wrs(data, wr_cache_hit){
        if (data && data.rows && data.rows.length > 0){
            if (!wr_cache_hit){
                cache_put(cache_key('wr_list-limited',os), data);
            }
            wr_data = data;
            var c = cache_get(cache_key('timings',os));
            if (c){
                handle_timings(c, true);
            }else{
                db.query(
                    'timings',
                    `SELECT MIN(a.date) AS end,a.request_id,u.email
                     FROM request_activity a
                     JOIN usr u ON u.user_no=a.worker_id
                     WHERE a.request_id IN (${data.rows.map(row => { return row.request_id }).join(',')})
                       AND a.source='note'
                       AND u.email like '%@catalyst%'
                     GROUP BY a.request_id,u.email`.replace(/\s+/g, ' ')
                )
                .then(
                    handle_timings,
                    db_error_handler(res, next)
                )
            }
        }else{
            console.log('response_times: no WRs in list');
            res.json({result: []});
        }
    }

    function handle_timings(ts_data, cache_hit){
        let r = {result: []};
        if (ts_data && ts_data.rows && ts_data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('timings',os), ts_data);
            }
            let state = {};
            wr_data.rows.forEach(wrow => {
                state[wrow.request_id] = {
                    request_id: wrow.request_id,
                    brief: wrow.brief,
                    severity: map_severity(wrow.urgency).name,
                    start: new Date(wrow.request_on),
                    end: new Date()
                };
            });
            ts_data.rows.forEach(trow => {
                state[trow.request_id].end = new Date(trow.end);
                state[trow.request_id].who = trow.email;
            });

            let times = {
                Low: [],
                Medium: [],
                High: [],
                Critical: []
            };

            Object.keys(state).forEach(id => {
                let o = state[id];
                times[state[id].severity].push(o.end - o.start);
            });

            const percentile = 0.95;
            ['Low', 'Medium', 'High', 'Critical'].forEach(sev => {
                let arr = [sev, 0];
                if (times[sev].length){
                    let index = Math.round(times[sev].length*percentile);
                    console.log('sev=' + sev + ', rt=' + JSON.stringify(times[sev]) + ', ' + percentile + '%=' + index);
                    arr[1] = Math.round(times[sev][index-1]/HOURS*10)/10;
                }
                r.result.push(arr);
            });
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list-limited',os));
    if (c){
        handle_wrs(c, true);
    }else{
        db.query(
                'wr_list-limited',
                wr_list_sql(os, true)
            )
            .then(
                handle_wrs,
                db_error_handler(res, next)
            )
    }
});

setup('get', '/statuses', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('statuses(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            let o = {};
            if (!cache_hit){
                cache_put(cache_key('wr_list-full',os), data);
            }
            data.rows.forEach(row => {
                let x = o[row.status];
                if (!x){
                    x = 0;
                }
                ++x;
                o[row.status] = x;
            });
            Object.keys(o).forEach(stat => { r.push([stat, o[stat]]); });
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list-full',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wr_list-full', 
                wr_list_sql(os, false)
            )
            .then(
                success,
                db_error_handler(res, next)
            )
    }
    next && next(false);
});

function next_period(context){
    let p = context.period.split(/-/),
        y = parseInt(p[0]),
        m = parseInt(p[1]) + 1;
    if (m > 12){
        m = 1;
        y++;
    }
    return y + '-' + m;
}

setup('get', '/sla_hours', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('sla_hours(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let ts = {};
        if (data && data.rows && data.rows.length > 0){
            if (!cache_hit){
                cache_put(cache_key('timesheets',os), data);
            }
            data.rows.forEach(row => {
                ts[row.request_id] = row.hours;
            });
        }
        wait_for_cache(cache_key('approved_quotes',os), function(aq){
            let sla = 0,
                add = 0;
            aq.rows.forEach(row => {
                delete ts[row.request_id];
                console.log(JSON.stringify(row));
                if (is_sla_quote(row, os)){
                    sla += convert_quote_amount(row);
                }else if (!is_sla_quote(row, os, true)){
                    add += convert_quote_amount(row);
                }
            });
            let t = Object.keys(ts).reduce((acc, val) => {
                return acc + ts[val];
            }, 0);
            res.json({
                budget: 24,
                result: [
                    ['SLA quotes', sla],
                    ['SLA unquoted', t],
                    ['Additional quotes', add]
                ]
            });
            next && next(false);
        });
    }

    var c = cache_get(cache_key('timesheets',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'timesheets', 
                `SELECT r.request_id,SUM(t.work_quantity) AS hours
                 FROM request r
                 JOIN request_timesheet t ON r.request_id=t.request_id
                 JOIN usr u ON u.user_no=r.requester_id
                 WHERE u.org_code=${os.org}
                   AND r.system_id IN (${os.sys.join(',')})
                   AND t.work_on >= '${os.period + '-01'}'
                   AND t.work_on < '${next_period(os) + '-01'}'
                   AND t.work_units='hours'
                 GROUP BY r.request_id
                `.replace(/\s+/g, ' ')
            )
            .then(
                success,
                db_error_handler(res, next)
            )
    }
});

function wr_list_sql(context, this_period_only, exclude_statuses){
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

setup('get', '/wr_list', function(req, res, next){
    let os = get_dash_context(req);
    if (os.error){
        console.log(o.error);
        res.json({error: os.error});
        return;
    }
    console.log('wr_list(' + os.org + ', ' + JSON.stringify(os.sys) + ')');

    function success(data, cache_hit){
        let r = [];
        if (data && data.rows && data.rows.length > 0){
            r = data.rows;
            if (!cache_hit){
                cache_put(cache_key('wr_list-limited-allstat',os), data);
            }
        }
        res.json(r);
        next && next(false);
    }

    var c = cache_get(cache_key('wr_list-limited-allstat',os));
    if (c){
        success(c, true);
    }else{
        db.query(
                'wr_list-limited-allstat', 
                wr_list_sql(os, true, [])
            )
            .then(
                success,
                db_error_handler(res, next)
            )
    }
});

function main(port){
    server.listen(port, function(err){
        if (err){
            throw err;
        }
        console.log(_L('listen') + '%s listening at %s', server.name, server.url);
    });
}

if (require.main === module){
    main(config.get('server.listen_port'));
}

exports.run = main;

