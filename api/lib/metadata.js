var request = require('request'),
    util    = require('./util'),
    config = require('config');

module.exports = function(org_id){
    return new Promise((resolve, reject) => {
        const opt = {
            url: config.get('metadata.host') + `/metadata/${org_id}.json`,
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
                let json = null;
                try{
                    json = JSON.parse(body);
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

