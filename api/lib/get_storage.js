var config  = require('config'),
    icinga  = require('./icinga'),
    util    = require('./util');

const DEBUG = false;

let poller = icinga.poller((storage_key, ctx) => {
    const icinga_path_template = '/cgi-bin/icinga/extinfo.cgi?type=2&HOST_AND_SERVICE&jsonoutput';

    return {
        auth: process.env['ICINGA_BASIC_AUTH'], // export ICINGA_BASIC_AUTH=user:pass
        protocol: 'https:',
        hostname: config.get('icinga_uri'),
        path: icinga_path_template.replace('HOST_AND_SERVICE', storage_key)
    }
});

// Output JSON is
// [
//   {
//     host:string, service:string, result: [
//       {disk:string, result:number},
//       ...
//     ]
//   },
//   ...
// ]
function format_storage(data, pattern = 'sitedata'){
    let r = null;

    if (data &&
        data.extinfo &&
        data.extinfo.service_info)
    {
        r = {
            host:   data.extinfo.service_info.host_display_name,
            service:data.extinfo.service_info.service_display_name,
            result: []
        };

        if (data.extinfo.service_info.performance_data){
            let stats = data.extinfo.service_info.performance_data.split(' ');
                keys = pattern.split(/,\s*/),
                re = new RegExp('(' + keys.join('|') + ')=(\\d+)MB');

            stats.forEach(stat => {
                let match = stat.match(re);
                if (match){
                    r.result.push({
                        disk: match[1],
                        result: parseInt(match[2])
                    });
                }
            });
        }else{
            r.error = r.service + ': ' + data.extinfo.service_info.status;
        }
    }
    return r;
}

module.exports = icinga.main(
    'storage',
    __filename,
    icinga.get_config('stats_storage', 'stats_storage_pattern'),
   icinga.process_next_key(poller, format_storage)
);

