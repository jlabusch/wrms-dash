var util    = require('./util'),
    cache   = require('./cache'),
    https   = require('https'),
    meta    = require('./metadata'),
    config  = require('config'),
    store   = require('./data_store');

const DEBUG = true;

exports.main = function(cache_label, file_label, get_config, process_next_key){
    return function(req, res, next, ctx){
        function finish(result_list){
            cache.put(cache.key(cache_label, ctx), result_list);
            store.query_send_data(res, next, result_list, file_label);
        }

        let c = cache.get(cache.key(cache_label, ctx), 60*60*1000 /* 1 hour */);

        if (c){
            finish(c);
            return;
        }

        meta(ctx.org).then(metadata => {
            let list = get_config(metadata);

            if (list.length < 1){
                finish([]);
                return;
            }

            process_next_key(list, ctx, finish);
        }).catch(err => {
            store.query_send_error(res, next, err, file_label);
        });
    }
}

exports.get_config = function(name_field, pattern_field){
    return function(metadata){
        let r = [];

        if (!metadata.sites){
            return r;
        }

        Object.values(metadata.sites).forEach(site => {
            if (site.environments &&
                site.environments.production &&
                site.environments.production[name_field])
            {
                r.push({
                    name: site.environments.production[name_field],
                    pattern: pattern_field ? site.environments.production[pattern_field] : undefined
                });
            }
        });

        return r;
    }
}

exports.process_next_key = function(poller, formatter){
    function process(key_list, ctx, next, result_list = []){
        let k = key_list.shift();
        if (k){
            poller(k.name, ctx).then(icinga_json => {
                let s = formatter(icinga_json, k.pattern);
                if (s){
                    result_list.push(s);
                }
                process(key_list, ctx, next, result_list);
            });
        }else{
            next && next(result_list);
        }
    }

    return process;
}

exports.poller = function(get_options){
    return function(stat_key, ctx){
        return new Promise((resolve, reject) => {
            const options = get_options(stat_key, ctx);

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
                        util.log_debug(__filename, '' + options.hostname + options.path + ' => ' + data.length + ' bytes', DEBUG);
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
}

