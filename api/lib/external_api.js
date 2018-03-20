var https  = require('http'),
    cache = require('./cache'),
    util  = require('./util');

// args = {
//   label: string,
//   function check_config(org) => bool,
//   function get_path(org) => string
//   function get_hostnames(org) => [string, ...]
//   function get_result(response) => object
// }
module.exports = function(args){
    return function(key, ctx, next, error){
        let org = util.get_org(ctx);

        if (!args.check_config(org)){
            return error('No ' + args.label + ' config for ' + ctx.org);
        }

        let hosts = args.get_hostnames(org),
            results = {};

        hosts.forEach((h) => {
            const options = setOptions(args, h);
            let req = https.request(options, (res) => {
                checkStatusCode(res);
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    json = parseJson(data, key, args);
                    results = addResult(args, h, json, results);
                    if (Object.keys(results).length === hosts.length){
                        next(results);
                    }
                });
            });
            req.on('error', error);
            req.end();
        });
    };
};

function setOptions(args, h) {
    options = {
        path: args.get_path(h),
        protocol: 'http:',
        hostname: h.hostname
    };

    return options;
}

function checkStatusCode(res) {
    // This should only have a non-200 OK in pretty exceptional circumstances.
    if (res.statusCode !== 200) {
        let e = args.label + ': ' + options.hostname + ' => ' + res.statusCode;
        util.log(__filename, e);
        return error(e);
    }
}

function parseJson(data, key, args) {
    let json = {};
    try {
        json = JSON.parse(data);
        if (json.exception) {
            // Something went wrong with the WS request itself, eg bad token.
            let msg = json.message ? json.message : json.exception;
            util.log(__filename, msg);
            return error(msg);
        }
        cache.put(key, json);
        util.log_debug(__filename, args.label + ': ' + json.count);
    } catch (ex) {
        let e = args.label + ': ' + ex;
        util.log(__filename, e);
        return error(e);
    }

    return json;
}

function addResult(args, h, json, results) {
    results[h.hostname + '@' + h.token] = args.get_result(json);

    return results;
}
