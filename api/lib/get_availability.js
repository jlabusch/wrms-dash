var config= require('config'),
    query = require('./query'),
    https = require('https'),
    cache = require('./cache'),
    util  = require('./util');

module.exports = query.prepare(
    'availability',
    'availability',
    null,
    (data, ctx, next) => {
        let r = {
            result: 0,
            host: 'unknown',
            service: 'unknown'
        };
        if (data &&
            data.avail &&
            data.avail.service_availability &&
            data.avail.service_availability.services &&
            data.avail.service_availability.services.length > 0)
        {
            let x = data.avail.service_availability.services[0];
            r.result  = x.percent_total_time_ok;
            r.host    = x.host_display_name;
            r.service = x.service_display_name;
            //util.log(__filename, ctx.org + ' availability => ' + r.result + '%');
        }
        next(r);
    },
    (key, ctx, next, error) => {
        if (!util.orgs[ctx.org] || !util.orgs[ctx.org].availability){
            return error('No availability lookup configured for ' + ctx.org);
        }

        let now = new Date(),
            start = new Date(ctx.period + '-1'),
            end = new Date(start.getTime());

        if (ctx.month === now.getMonth() + 1){
            // If this is for the current month, end date is yesterday
            end.setDate(now.getDate() - 1);
        }else{
            // otherwise, last day of the month
            end.setMonth(end.getMonth()+1);
            end.setDate(end.getDate()-1);
        }

        const icinga_path_template =
                '/cgi-bin/icinga/avail.cgi?show_log_entries=&hostservice=SERVICE&timeperiod=thismonth&' +
                'smon=START_MONTH&sday=START_DAY&syear=START_YEAR&shour=0&smin=0&ssec=0&' +
                'emon=END_MONTH&eday=END_DAY&eyear=END_YEAR&ehour=24&emin=0&esec=0&' +
                'rpttimeperiod=&assumeinitialstates=yes&assumestateretention=yes&assumestatesduringnotrunning=yes&' +
                'includesoftstates=no&initialassumedservicestate=0&backtrack=4&content_type=html&jsonoutput';
        const options = {
            auth: process.env['ICINGA_BASIC_AUTH'], // e.g. user:pass
            protocol: 'https:',
            hostname: config.get('icinga_uri'),
            path: icinga_path_template
                    .replace('SERVICE', util.orgs[ctx.org].availability)
                    .replace('START_YEAR', start.getFullYear())
                    .replace('START_MONTH', start.getMonth()+1)
                    .replace('START_DAY', start.getDate())
                    .replace('END_YEAR', end.getFullYear())
                    .replace('END_MONTH', end.getMonth()+1)
                    .replace('END_DAY', end.getDate())
        }

        let req = https.request(options, (res) => {
            if (res.statusCode !== 200){
                let e = 'availability: ' + options.path + ' => ' + res.statusCode;
                util.log(__filename, e);
                return error(e);
            }
            let data = '';
            res.on('data', chunk => { data += chunk });
            res.on('end', () => {
                let json = {};
                try{
                    json = JSON.parse(data);
                    cache.put(key, json);
                    util.log(__filename, 'availability: ' + options.path);
                }catch(ex){
                    let e = 'availability: ' + ex;
                    util.log(__filename, e);
                    return error(e);
                }
                next(json);
            });
        });
        req.on('error', error);
        req.end();
    },
    60*60*1000 // cache TTL 1 hour
);
