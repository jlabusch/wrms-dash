var config= require('config'),
    query = require('./query'),
    https = require('https'),
    cache = require('./cache'),
    util  = require('./util');

const DEBUG = false;

function fetch_stat(stat, ctx, start, end, next){
    const icinga_path_template =
            '/cgi-bin/icinga/avail.cgi?t1=START_TS&t2=END_TS&show_log_entries=&SERVICE&' +
            'assumeinitialstates=yes&assumestateretention=yes&assumestatesduringnotrunning=yes&' +
            'includesoftstates=no&initialassumedhoststate=0&initialassumedservicestate=0&' +
            'timeperiod=%5B+Current+time+range+%5D&backtrack=4&jsonoutput'
    const options = {
        auth: process.env['ICINGA_BASIC_AUTH'], // e.g. user:pass
        protocol: 'https:',
        hostname: config.get('icinga_uri'),
        path: icinga_path_template
                .replace('SERVICE', stat)
                .replace('START_TS', Math.round(start.getTime()/1000))
                .replace('END_TS', Math.round(end.getTime()/1000))
    }

    let req = https.request(options, (res) => {
        if (res.statusCode !== 200){
            let e = 'availability: ' + options.path + ' => ' + res.statusCode;
            util.log(__filename, e);
            return next(e, null);
        }
        let data = '';
        res.on('data', chunk => { data += chunk });
        res.on('end', () => {
            let json = {};
            try{
                json = JSON.parse(data);
                // Don't cache yet
                util.log(__filename, 'request:  ' + options.hostname + options.path);
                util.log_debug(__filename, 'response: ' + JSON.stringify(json, null, 2), DEBUG);
            }catch(ex){
                let e = 'availability: ' + ex;
                util.log(__filename, e);
                return next(e, null);
            }
            next(null, json);
        });
    });
    req.on('error', e => { next(e, null) });
    req.end();
}

function format_icinga_note(host, service){
    if (service.indexOf(host) > -1){
        return service;
    }else{
        return host + '/' + service;
    }
}

module.exports = query.prepare(
    'availability',
    'availability',
    null,
    (data, ctx, next) => {
        let rs = [];

        data.forEach(kv => {
            let r = [ 'unknown', 0 ];

            if (kv.val &&
                kv.val.avail &&
                kv.val.avail.service_availability &&
                kv.val.avail.service_availability.services &&
                kv.val.avail.service_availability.services.length > 0)
            {
                let x = kv.val.avail.service_availability.services[0];
                r[0] = format_icinga_note(x.host_display_name, x.service_display_name);
                r[1] = x.percent_total_time_ok + x.percent_total_time_undetermined;
                util.log(__filename, ctx.org + ' availability => ' + x.percent_total_time_ok + ' + ' + x.percent_total_time_undetermined + ' = ' + JSON.stringify(r));
            }

            rs.push(r);
        });

        next(rs);
    },
    (key, ctx, next, error) => {
        if (!util.orgs[ctx.org] || !util.orgs[ctx.org].availability){
            return error('No availability lookup configured for ' + ctx.org);
        }

        let now = new Date(),
            start = new Date(ctx.period + '-1'),
            end = new Date(start.getTime());

        if (ctx.month === now.getMonth() + 1){
            // If this is for the current month, end date is today
            end.setDate(now.getDate());
        }else{
            // otherwise, last day of the month
            end.setMonth(end.getMonth()+1);
            end.setDate(end.getDate()-1);
        }

        let stat_names = util.orgs[ctx.org].availability;
        if (Array.isArray(stat_names)){
            // Clone it so that shift() doesn't destroy util.orgs.
            stat_names = stat_names.slice(0);
        }else{
            stat_names = [stat_names];
        }

        function fetcher(s, ss, values, callback){
            if (!s){
                callback(values);
                return;
            }
            fetch_stat(s, ctx, start, end, (err, json) => {
                if (err){
                    // already logged
                }else{
                    values.push({key: s, val: json});
                }
                fetcher(ss.shift(), ss, values, callback);
            });
        }

        fetcher(stat_names.shift(), stat_names, [], (values) => {
            cache.put(key, values);
            next(values);
        });
    },
    60*60*1000 // cache TTL 1 hour
);
