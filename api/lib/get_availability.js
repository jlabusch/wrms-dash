var config  = require('config'),
    icinga  = require('./icinga'),
    util    = require('./util');

const DEBUG = false;

let poller = icinga.poller((avail_key, ctx) => {
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

    const icinga_path_template =
            '/cgi-bin/icinga/avail.cgi?t1=START_TS&t2=END_TS&show_log_entries=&SERVICE&' +
            'assumeinitialstates=yes&assumestateretention=yes&assumestatesduringnotrunning=yes&' +
            'includesoftstates=no&initialassumedhoststate=0&initialassumedservicestate=0&' +
            'timeperiod=%5B+Current+time+range+%5D&backtrack=4&jsonoutput'

    return {
        auth: process.env['ICINGA_BASIC_AUTH'],
        protocol: 'https:',
        hostname: config.get('icinga_uri'),
        path: icinga_path_template
                .replace('SERVICE', avail_key)
                .replace('START_TS', Math.round(start.getTime()/1000))
                .replace('END_TS', Math.round(end.getTime()/1000))
    }
});

// Output JSON is
// [
//   [sitename, percentage],
//   ...
// ]
function format_availability(data){
    let r = null;

    if (data &&
        data.avail &&
        data.avail.service_availability &&
        Array.isArray(data.avail.service_availability.services) &&
        data.avail.service_availability.services.length > 0)
    {
        let x = data.avail.service_availability.services[0];
        r = [
            format_icinga_note(x.host_display_name, x.service_display_name),
            x.percent_total_time_ok + x.percent_total_time_undetermined
        ];
        util.log_debug(__filename, 'availability => ' + x.percent_total_time_ok + ' + ' + x.percent_total_time_undetermined + ' = ' + JSON.stringify(r), DEBUG);
    }
    return r;
}

function format_icinga_note(host, service){
    if (service.indexOf(host) > -1){
        return service;
    }else{
        return host + '/' + service;
    }
}

module.exports = icinga.main(
    'availability',
    __filename,
    icinga.get_config('stats_availability'),
    icinga.process_next_key(poller, format_availability)
);

