var config= require('config'),
    query = require('./query'),
    https = require('https'),
    cache = require('./cache'),
    util  = require('./util');

var DEBUG = false;

module.exports = query.prepare(
    'storage',
    'storage',
    null,
    (data, ctx, next) => {
        let r = {
            result: [/* [{disk: 'unknown', result: 0}] */]
        }

        if (data &&
            data.extinfo &&
            data.extinfo.service_info)
        {
            let o = util.get_org(ctx);
            o.storage_pattern = o.storage_pattern || '(sitedata)=(\\d+)MB';
            r.host    = data.extinfo.service_info.host_display_name;
            r.service = data.extinfo.service_info.service_display_name;

            util.log_debug(__filename, 'storage => ' + JSON.stringify(data, null, 2), DEBUG);

            if (data.extinfo.service_info.performance_data){
                let arr = data.extinfo.service_info.performance_data.match(new RegExp(o.storage_pattern))

                if (arr){
                    arr.shift();
                    for (let i = 0; i < arr.length/2; ++i){
                        r.result.push([{
                            disk: arr[i*2],
                            result: parseInt(arr[i*2 + 1])
                        }]);
                    }
                }
            }else{
                r.error = 'Check ' + data.extinfo.service_info.status;
            }

            util.log(__filename, ctx.org + ' storage => ' + JSON.stringify(r));
        }
        next(r);
    },
    (key, ctx, next, error) => {
        if (!util.get_org(ctx) || !util.get_org(ctx).storage){
            return error('No storage lookup configured for ' + ctx.org);
        }

        const icinga_path_template = '/cgi-bin/icinga/extinfo.cgi?type=2&HOST_AND_SERVICE&jsonoutput';
        const options = {
            auth: process.env['ICINGA_BASIC_AUTH'], // export ICINGA_BASIC_AUTH=user:pass
            protocol: 'https:',
            hostname: config.get('icinga_uri'),
            path: icinga_path_template.replace('HOST_AND_SERVICE', util.get_org(ctx).storage)
        }

        let req = https.request(options, (res) => {
            if (res.statusCode !== 200){
                let e = 'storage: ' + options.path + ' => ' + res.statusCode;
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
                    util.log(__filename, 'request:  ' + options.hostname + options.path);
                }catch(ex){
                    let e = 'storage: ' + ex;
                    util.log(__filename, e);
                    return error(e);
                }
                next(json);
            });
        });
        req.on('error', error);
        req.end();
    },
    60*60*1000, // cache TTL 1 hour
    (ctx) => { return 'storage-' + ctx.org }
);
