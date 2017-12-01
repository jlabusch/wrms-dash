var query = require('./query'),
    cache   = require('./cache'),
    db      = require('./db').get(),
    util = require('./util');

const hours = 60*60*1000,
    work_hours_per_day = 8,
    work_end_hour = 17;

const DEBUG = false;

function to_hours(ms){
    return Math.round(ms/hours*10)/10;
}

function same_day(a, b){
    return  a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
}

function log(wr, sev, start, end, elapsed){
    util.log_debug(__filename, 'calculate_response_duration(' + wr + '/' + sev + ',\t' + start.toISOString() + ', ' + end.toISOString() + ') => ' + to_hours(elapsed) + ' hrs', DEBUG);
}

function is_not_weekend(d){
    return d.getDay() !== 0 && d.getDay() !== 6;
}

function calculate_response_duration(wr, sev, orig_start, end, tz){
    let tz_start = new Date(orig_start.toLocaleString('en-NZ', { timeZone: tz })),
        tz_end   = new Date(end.toLocaleString('en-NZ', { timeZone: tz }));

    if (sev === 'Critical'){
        log(wr, sev, tz_start, tz_end, tz_end - tz_start);
        return tz_end - tz_start;
    }

    const work_start_hour = work_end_hour - work_hours_per_day;

    let d = new Date(tz_start.getTime()),
        amended_start = new Date(tz_start.getTime());

    d.setHours(work_end_hour, 0, 0, 0);
    if (d < tz_start){
        // Handle the case when it's raised and resolved out of hours, before next business day
        amended_start = d;
    }

    if (tz_start.getHours() < work_start_hour){
        // Handle issues logged before start of day
        amended_start.setHours(work_start_hour, 0, 0, 0);
        util.log_debug(__filename, 'calculate_response_duration(' + wr + '/' + sev + ',\t' + "Resetting start to hour " + work_start_hour + ': ' + amended_start, DEBUG);
    }

    let elapsed = 0;
    if (amended_start < d && is_not_weekend(amended_start)){ // if it starts within business hours
        elapsed =
            tz_end < d // did it end before 5pm?
            ? tz_end - amended_start // yes, count start..end
            : d - amended_start; // no, count start..5pm
    }
    util.log_debug(__filename, 'calculate_response_duration(' + wr + '/' + sev + ',\t' + 'initial elapsed = ' + elapsed, DEBUG);

    if (!same_day(amended_start, tz_end)){
        while (true){
            d.setDate(d.getDate()+1);
            if (same_day(d, tz_end)){
                break;
            }else{
                if (is_not_weekend(d)){
                    util.log_debug(__filename, 'calculate_response_duration(' + wr + '/' + sev + ',\t' + `adding ${work_hours_per_day}h for ${d}`, DEBUG);
                    elapsed += work_hours_per_day * hours;
                }
            }
        }
        // Reached end day
        d = new Date(tz_end.getTime());
        d.setHours(work_start_hour, 0, 0, 0);
        if (tz_end > d){
            elapsed += (tz_end - d);
        }
    }
    log(wr, sev, tz_start, tz_end, elapsed);
    return elapsed;
}

module.exports = function(req, res, next, ctx){
    let wr_data = undefined;

    function handle_wrs(data, wr_cache_hit){
        if (data && data.rows && data.rows.length > 0){
            if (!wr_cache_hit){
                cache.put(cache.key('wr_list-limited',ctx), data);
            }
            wr_data = data;
            var c = cache.get(cache.key('timings',ctx));
            if (c){
                handle_timings(c, true);
            }else{
                db.query(
                    'timings',
                    `SELECT MIN(a.date) AS end,a.request_id
                     FROM request_activity a
                     JOIN usr u ON u.user_no=a.worker_id
                     WHERE a.request_id IN (${data.rows.map(row => { return row.request_id }).join(',')})
                       AND a.source IN ('note', 'status')
                       AND u.email like '%@catalyst%'
                     GROUP BY a.request_id`.replace(/\s+/g, ' '),
                     ctx
                )
                .then(
                    handle_timings,
                    query.error(res, next)
                )
            }
        }else{
            util.log(__filename, 'no WRs in list');
            res.json({result: []});
        }
    }

    function handle_timings(ts_data, cache_hit){
        let r = {result: []};
        if (!cache_hit){
            cache.put(cache.key('timings',ctx), ts_data);
        }
        let state = {};
        if (wr_data && wr_data.rows){
            wr_data.rows.forEach(wrow => {
                state[wrow.request_id] = {
                    request_id: wrow.request_id,
                    brief: wrow.brief,
                    severity: util.map_severity(wrow.urgency, wrow.importance).name,
                    start: new Date(wrow.request_on),
                    end: new Date()
                };
            });
        }
        if (ts_data && ts_data.rows){
            ts_data.rows.forEach(trow => {
                state[trow.request_id].end = new Date(trow.end);
                state[trow.request_id].who = trow.email;
            });
        }

        let times = {
            Low: [],
            Medium: [],
            High: [],
            Critical: []
        };

        Object.keys(state).forEach(id => {
            let o = state[id];
            times[state[id].severity].push(
                calculate_response_duration(o.request_id, o.severity, o.start, o.end, ctx.tz) // msec
            );
        });

        const percentile = 0.95;
        ['Low', 'Medium', 'High', 'Critical'].forEach(sev => {
            let arr = [sev, 0];
            if (times[sev].length){
                times[sev].sort((a,b)=>{ return a-b });
                let index = Math.round(times[sev].length*percentile) - 1;
                util.log_debug(__filename, 'sev=' + sev + ',\trt=' + JSON.stringify(times[sev]) + ', ' + percentile + '%=' + index, DEBUG);
                arr[1] = to_hours(times[sev][index]);
            }
            r.result.push(arr);
        });
        res.json(r);
        next && next(false);
    }

    var c = cache.get(cache.key('wr_list-limited',ctx));
    if (c){
        handle_wrs(c, true);
    }else{
        db.query(
                'wr_list-limited',
                util.wr_list_sql(ctx, true, ["'C'", "'M'", "'H'"]),
                ctx
            )
            .then(
                handle_wrs,
                query.error(res, next)
            )
    }
}
