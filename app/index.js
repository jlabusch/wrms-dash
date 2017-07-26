var config  = require('config'),
    db      = require('./db').create(),
    http    = require('http'),
    restify = require('restify');

'use strict';

const GENERIC_ERROR = {error: 'Service interruption - please try again later'},
    MINS = 60*1000,
    HOURS = 60*MINS;

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
    DEFAULT_CACHE_TIMELIMIT = 5*MINS;

function cache_key(name, context){
    return name + JSON.stringify(context);
}

function cache_put(key, val){
    var now = new Date().getTime();
    cache[key] = {ts: now, val: JSON.parse(JSON.stringify(val))};
}

function cache_get(key, limit){
    var now = new Date().getTime();
    var item = cache[key];
    if (item){
        if (!limit){
            limit = DEFAULT_CACHE_TIMELIMIT;
        }
        if (item.ts + limit > now){
            console.log('CACHE HIT [' + key + ']');
            return JSON.parse(JSON.stringify(item.val));
        }
    }
    console.log('CACHE MISS [' + key + ']');
    return null;
}

function wait_for_cache(key, next, count, on_timeout){
    count = count || 1;
    if (count > 50){
        console.log('CACHE WAIT: Giving up on ' + key);
        on_timeout && on_timeout(next);
        return;
    }
    let c = cache_get(key);
    if (c){
        console.log('CACHE WAIT -> HIT [' + key + ']');
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

function prepare_query(label, cache_key_base, sql, process_data){
    return function(req, res, next){
        let ctx = get_dash_context(req);

        if (ctx.error){
            console.log(label + ctx.error);
            res.json({error: ctx.error});
            return;
        }

        let ck = cache_key(cache_key_base, ctx); 

        let success = function(data, cache_hit){
            if (!cache_hit){
                cache_put(ck, data);
            }
            process_data(data, ctx, (result) => {
                res.json(result);
                next && next(false);
            });
        }

        var c = cache_get(ck);
        if (c){
            success(c, true);
        }else{
            db.query(
                    cache_key_base,
                    sql(ctx).replace(/\s+/g, ' ')
                )
                .then(
                    success,
                    db_error_handler(res, next)
                )
        }
    }
}

function get_quotes(pred){
    return function(req, res, next){
        let ctx = get_dash_context(req);
        if (ctx.error){
            console.log(o.error);
            res.json({error: ctx.error});
            return;
        }

        function success(data, cache_hit){
            let r = { result: [ {wr: "None", result: 0} ] };
            if (data && data.rows && data.rows.length > 0){
                if (!cache_hit){
                    cache_put(cache_key('approved_quotes',ctx), data);
                }
                let quote_sum = {},
                    any = false;
                data.rows
                    .filter(pred(ctx))
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

        var c = cache_get(cache_key('approved_quotes',ctx));
        if (c){
            success(c, true);
        }else{
            db.query(
                    'approved_quotes', 
                    `SELECT r.request_id,
                            r.brief,
                            r.invoice_to,
                            r.last_status,
                            q.quote_id,
                            q.quote_amount,
                            q.quote_units
                    FROM request r
                    JOIN request_quote q ON q.request_id=r.request_id
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${ctx.org}
                      AND r.system_id IN (${ctx.sys.join(',')})
                      AND r.last_status NOT IN ('C')
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
    console.log('check WR ' + row.request_id + ' quote vs ' + (loose_match ? 'id ' : 'date ') + rs + ': ' + row.invoice_to + ' -> ' + JSON.stringify(m));
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
        }
    )
);

setup('get', '/additional_quotes',
    get_quotes(
        function(){
            return function(row){
                return ['F', 'H', 'M'].indexOf(row.last_status) < 0 &&
                    (!row.invoice_to || row.invoice_to.indexOf(row.quote_id) < 0);
            }
        }
    )
);

setup(
    'get',
    '/customer',
    prepare_query('customer', 'cust', 
        function(ctx){
            return `SELECT org_code,org_name,system_id,system_desc
                    FROM organisation,work_system
                    WHERE org_code=${ctx.org} AND system_id IN (${ctx.sys.join(',')})`;
        },
        function(data, ctx, next){
            let r = {
                result: 0,
                org: { id: ctx.org },
                system: { id: ctx.sys }
            };
            if (data && data.rows && data.rows.length > 0){
                r.org.name = data.rows[0].org_name;
                r.system.name = data.rows.map(row => { return row.system_desc }).join(', ');
            }
            next(r);
        }
    )
);


setup(
    'get',
    '/wrs_created_count',
    prepare_query('wrs_created_count', 'wcc',
        function(ctx){
            return `SELECT COUNT(*)
                    FROM request r
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${ctx.org}
                        AND r.system_id IN (${ctx.sys.join(',')})
                        AND r.request_on >= '${ctx.period + '-01'}'
                        AND r.request_on < '${next_period(ctx) + '-01'}'`;
        },
        function(data, ctx, next){
            let r = {
                result: 0
            }
            if (data && data.rows && data.rows.length > 0){
                r.result = parseInt(data.rows[0].count);
            }
            next(r);
        }
    )
);

setup('get', '/users', function(req, res, next){
    console.log('users()');
    res.json({
        result: 0
    });
    next && next(false);
});

setup('get', '/storage', function(req, res, next){
    console.log('storage()');
    res.json({
        result: 0
    });
    next && next(false);
});

setup('get', '/availability', function(req, res, next){
    console.log('availability()');
    res.json({
        result: 0
    });
    next && next(false);
});

setup(
    'get',
    '/severity',
    prepare_query('severity', 'sev',
        function(ctx){
            return wr_list_sql(ctx, false)
        },
        function(data, ctx, next){
            let r = [
                [ 'Low', 0 ],
                [ 'Medium', 0 ],
                [ 'High', 0 ],
                [ 'Critical', 0 ]
            ];
            if (data && data.rows && data.rows.length > 0){
                data.rows.forEach(row => {
                    r[map_severity(row.urgency).number][1]++;
                });
            }
            next(r);
        }
    )
);

setup(
    'get',
    '/response_times_PLACEHOLDER',
    prepare_query('response_times', 'rtt',
        function(ctx){
            return 'select 1';
        },
        function(data, ctx, next){
            next({result: []});
        }
    )
);

function calculate_response_duration(sev, start, end){
    if (sev === 'Critical'){
        return end - start;
    }
    const work_hours_per_day = 8,
        work_end_hour = 17,
        work_start_hour = work_end_hour - work_hours_per_day;
    // TODO
    return end - start;
}

setup('get', '/response_times', function(req, res, next){
    let ctx = get_dash_context(req);
    if (ctx.error){
        console.log(o.error);
        res.json({error: ctx.error});
        return;
    }
    console.log('response_times(' + ctx.org + ', ' + JSON.stringify(ctx.sys) + ')');

    let wr_data = undefined;

    function handle_wrs(data, wr_cache_hit){
        if (data && data.rows && data.rows.length > 0){
            if (!wr_cache_hit){
                cache_put(cache_key('wr_list-limited',ctx), data);
            }
            wr_data = data;
            var c = cache_get(cache_key('timings',ctx));
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
                cache_put(cache_key('timings',ctx), ts_data);
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
                times[state[id].severity].push(
                    calculate_response_duration(o.severity, o.start, o.end) // msec
                );
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

    var c = cache_get(cache_key('wr_list-limited',ctx));
    if (c){
        handle_wrs(c, true);
    }else{
        db.query(
                'wr_list-limited',
                wr_list_sql(ctx, true)
            )
            .then(
                handle_wrs,
                db_error_handler(res, next)
            )
    }
});

setup(
    'get',
    '/statuses',
    prepare_query('statuses', 'stat',
        function(ctx){
            return wr_list_sql(ctx, false)
        },
        function(data, ctx, next){
            let r = [];
            if (data && data.rows && data.rows.length > 0){
                let o = {};
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
            next(r);
        }
    )
);

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

setup(
    'get',
    '/sla_hours',
    prepare_query('sla_hours', 'sla_hours',
        function(ctx){
            return `SELECT r.request_id,SUM(t.work_quantity) AS hours
                    FROM request r
                    JOIN request_timesheet t ON r.request_id=t.request_id
                    JOIN usr u ON u.user_no=r.requester_id
                    WHERE u.org_code=${ctx.org}
                        AND r.system_id IN (${ctx.sys.join(',')})
                        AND t.work_on >= '${ctx.period + '-01'}'
                        AND t.work_on < '${next_period(ctx) + '-01'}'
                        AND t.work_units='hours'
                    GROUP BY r.request_id`;
        },
        function(data, ctx, next){
            let ts = {};
            if (data && data.rows && data.rows.length > 0){
                data.rows.forEach(row => {
                    ts[row.request_id] = row.hours;
                });
            }
            let budget = 0,
                sla_uri = config.get('sla_uri'),
                sla_config = cache_get('sla_config', 1*HOURS);
            if (sla_config){ // If we have cached SLA config, use that
                if (sla_config[ctx.org] && sla_config[ctx.org].monthly){
                    budget = sla_config[ctx.org].monthly;
                }
                produce_result();
            }else if (sla_uri){ // If we can get SLA config, do that
                let hrq = http.request(sla_uri, (hresp) => {
                    if (hresp.statusCode !== 200){
                        console.log('sla_hours: request to ' + sla_uri + ' failed: ' + hresp.statusCode);
                        produce_result();
                        return;
                    }
                    let d = '';
                    hresp.on('data', chunk => { d += chunk });
                    hresp.on('end', () => {
                        let json = {};
                        try{
                            json = JSON.parse(d);
                            cache_put('sla_config', json);
                        }catch(ex){
                            console.log('sla_hours: ' + ex);
                        }
                        if (json[ctx.org] && json[ctx.org].monthly){
                            budget = json[ctx.org].monthly;
                        }
                        produce_result();
                    });
                });
                hrq.on('error', err => {
                    console.log('sla_hours: ' + err);
                    produce_result();
                });
                hrq.end();
            }else{ // Oh well, no budget
                produce_result();
            }
            function produce_result(){
                wait_for_cache(cache_key('approved_quotes',ctx), function(aq){
                    let sla = 0,
                        add = 0;
                    aq.rows.forEach(row => {
                        delete ts[row.request_id];
                        console.log(JSON.stringify(row));
                        if (is_sla_quote(row, ctx)){
                            sla += convert_quote_amount(row);
                        }else if (!is_sla_quote(row, ctx, true)){
                            add += convert_quote_amount(row);
                        }
                    });
                    let t = Object.keys(ts).reduce((acc, val) => {
                        return acc + ts[val];
                    }, 0);
                    next({
                        budget: budget,
                        result: [
                            ['SLA quotes', sla],
                            ['SLA unquoted', t],
                            ['Additional quotes', add]
                        ]
                    });
                });
            }
        }
    )
);

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

setup(
    'get',
    '/wr_list',
    prepare_query('wr_list', 'wr_list-ltd-allstat',
        function(ctx){
            return wr_list_sql(ctx, true, [])
        },
        function(data, ctx, next){
            let r = [];
            if (data && data.rows && data.rows.length > 0){
                r = data.rows;
            }
            next(r);
        }
    )
);

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

