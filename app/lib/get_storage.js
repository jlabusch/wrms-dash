var config= require('config'),
    query = require('./query'),
    https = require('https'),
    cache = require('./cache'),
    util  = require('./util');

module.exports = query.prepare(
    'storage',
    'storage',
    null,
    (data, ctx, next) => {
        let r = {
            result: 0,
            host: 'unknown',
            service: 'unknown'
        };
        if (data &&
            data.extinfo &&
            data.extinfo.service_info)
        {
            let o = util.orgs[ctx.org];
            o.storage_pattern = o.storage_pattern || 'sitedata=(\\d+)MB';
            r.result  = 0;
            r.host    = data.extinfo.service_info.host_display_name;
            r.service = data.extinfo.service_info.service_display_name;

            // console.log('storage => ' + data.extinfo.service_info.performance_data);

            let sz = data.extinfo.service_info.performance_data.match(new RegExp(o.storage_pattern))
            if (sz){
                r.result = parseInt(sz[1]);
            }

            // console.log(ctx.org + ' storage => ' + r.result);
        }
        next(r);
    },
    (key, ctx, next, error) => {
        if (!util.orgs[ctx.org] || !util.orgs[ctx.org].storage){
            return error('No storage lookup configured for ' + ctx.org);
        }

        const icinga_path_template = '/cgi-bin/icinga/extinfo.cgi?type=2&HOST_AND_SERVICE&jsonoutput';
        const options = {
            auth: process.env['ICINGA_BASIC_AUTH'], // export ICINGA_BASIC_AUTH=user:pass
            protocol: 'https:',
            hostname: config.get('icinga_uri'),
            path: icinga_path_template.replace('HOST_AND_SERVICE', util.orgs[ctx.org].storage)
        }

        let req = https.request(options, (res) => {
            if (res.statusCode !== 200){
                let e = 'storage: ' + options.path + ' => ' + res.statusCode;
                console.log(e);
                return error(e);
            }
            let data = '';
            res.on('data', chunk => { data += chunk });
            res.on('end', () => {
                let json = {};
                try{
                    json = JSON.parse(data);
                    cache.put(key, json);
                    console.log('storage: ' + options.path);
                }catch(ex){
                    let e = 'storage: ' + ex;
                    console.log(e);
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
