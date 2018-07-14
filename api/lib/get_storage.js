var store   = require('./data_store'),
    https   = require('https'),
    cache   = require('./cache'),
    config  = require('config'),
    meta    = require('./metadata'),
    util    = require('./util');

const DEBUG = false;

module.exports = function(req, res, next, ctx){
    function finish(result_list){
        // result_list is [{host, service, result[{disk, result}, ...]}, ...]
        cache.put(cache.key('storage', ctx), result_list);
        res.charSet('utf-8');
        res.json(result_list);
        next && next(false);
    }

    let c = cache.get(cache.key('storage', ctx), 60*60*1000 /* 1 hour */);

    if (c){
        finish(c);
        return;
    }

    meta(ctx.org).then(metadata => {
        let list = get_storage_config(metadata);

        if (list.length < 1){
            finish([]);
            return;
        }

        process_next_key(list, ctx, finish);
    }).catch(err => {
        util.log(__filename, 'ERROR fetching metadata: ' + (err.message || err));
        res.json({error: err});
        next && next(false);
        return;
    });
}

function get_storage_config(metadata){
    let r = [];

    if (!metadata.sites){
        return r;
    }

    Object.values(metadata.sites).forEach(site => {
        if (site.environments &&
            site.environments.production &&
            site.environments.production.stats_storage)
        {
            r.push({
                name: site.environments.production.stats_storage,
                pattern: site.environments.production.stats_storage_pattern
            });
        }
    });

    return r;
}

function process_next_key(key_list, ctx, next, result_list = []){
    let k = key_list.shift();
    if (k){
        poll_icinga(k.name, ctx).then(icinga_json => {
            let s = format_storage(icinga_json, k.pattern);
            if (s){
                result_list.push(s);
            }
            process_next_key(key_list, ctx, next, result_list);
        });
    }else{
        next && next(result_list);
    }
}

function poll_icinga(storage_key, ctx){
    return new Promise((resolve, reject) => {

        const icinga_path_template = '/cgi-bin/icinga/extinfo.cgi?type=2&HOST_AND_SERVICE&jsonoutput';

        const options = {
            auth: process.env['ICINGA_BASIC_AUTH'], // export ICINGA_BASIC_AUTH=user:pass
            protocol: 'https:',
            hostname: config.get('icinga_uri'),
            path: icinga_path_template.replace('HOST_AND_SERVICE', storage_key)
        }

        let req = https.request(options, (res) => {
            if (res.statusCode !== 200){
                let e = 'ERROR: poll_icinga(' + options.path + ') => ' + res.statusCode;
                util.log(__filename, e);
                reject(new Error(e));
                return;
            }

            let data = '';

            res.on('data', chunk => { data += chunk });

            res.on('end', () => {
                let json = {};
                try{
                    json = JSON.parse(data);
                    util.log_debug(__filename, options.hostname + options.path + ' => ' + data.length + ' bytes', DEBUG);
                }catch(ex){
                    util.log(__filename, 'ERROR: poll_icinga(' + options.path + '): ' + (ex.message || ex));
                    reject(ex);
                    return;
                }
                resolve(json);
            });
        });

        req.on('error', reject);

        req.end();
    });
}

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

