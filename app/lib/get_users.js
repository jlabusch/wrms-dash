var config= require('config'),
    query = require('./query'),
    http  = require('http'),
    cache = require('./cache'),
    util  = require('./util');

module.exports = query.prepare(
    'users',
    'users',
    null,
    function(data, ctx, next){
        let r = {
            result: data
        };
        next(r);
    },
    (key, ctx, next, error) => {
        if (!util.orgs[ctx.org] || !util.orgs[ctx.org].users_hostname || !util.orgs[ctx.org].users_token){
            return error('No user lookup configured for ' + ctx.org);
        }

        const template = '/webservice/rest/server.php?wsfunction=local_user_count_api_count&' + 
                'moodlewsrestformat=json&' +
                'wstoken=USER_TOKEN&' + 
                'duration=1&' +
                'duration_unit=year';

        const options = {
            path: template
                .replace('USER_TOKEN', util.orgs[ctx.org].users_token),
            protocol: util.orgs[ctx.org].users_protocol ? util.orgs[ctx.org].users_protocol : 'https:',
            hostname: util.orgs[ctx.org].users_hostname
        }

        let req = http.request(options, (res) => {
            // This will only have a non-200 OK in pretty exceptional circumstances.
            if (res.statusCode !== 200) {
                let e = 'users: ' + options.base_uri + ' => ' + res.statusCode;
                util.log(__filename, e);
                return error(e);
            }

            let data = '';
            res.on('data', chunk => { data += chunk });
            res.on('end', () => {
                let json = {};
                try {
                    json = JSON.parse(data);
                    if (json.exception) {
                        // Something went wrong with the WS request itself, eg bad token.
                        throw json.message ? json.message : json.exception;
                    }
                    cache.put(key, json);
                    util.log(__filename, 'users: ' + json.count);
                } catch (ex) {
                    let e = 'users: ' + ex;
                    util.log(__filename, e);
                    return error(e);
                }
                next(json.count);
            });
        });
        req.on('error', error);
        req.end();
    },
    60*60*1000 // cache TTL 1 hour
);
