var request = require('request'),
    util    = require('wrms-dash-util'),
    cache   = require('wrms-dash-db').cache,
    config = require('config');

'use strict';

module.exports = function(org_id){
    return new Promise((resolve, reject) => {
        let key = `/metadata/${org_id}.json`,
            json = cache.get(key, 15*60*1000);

        if (json){
            resolve(json);
            return;
        }

        const opt = {
            url: config.get('metadata.host') + key,
            strictSSL: false
        }

        function handler(err, res, body){
            if (err){
                reject(err);
                return;
            }
            if (res.statusCode >= 400){
                reject(new Error(`Metadata fetch failed (${res.statusCode} for org ${org_id})`));
            }
            if (res.statusCode == 200){
                try{
                    json = JSON.parse(body);
                    cache.put(key, json);
                }catch(ex){
                    reject(ex);
                }
                resolve(json);
            }
        }

        util.log_debug(__filename, opt.url, true);

        request(opt, handler);
    });
}

