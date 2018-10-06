var query = require('./query'),
    https  = require('https'),
    cache = require('./cache'),
    util  = require('wrms-dash-util');

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
        // TODO: decide where to fetch tokens from now that the config no longer exists.
        if (true ||
            !util.get_org(ctx) ||
            !util.get_org(ctx).users ||
            !util.get_org(ctx).users.hostname ||
            !util.get_org(ctx).users.token)
        {
            return error('No user lookup configured for ' + ctx.org);
        }

        let u = util.get_org(ctx).users;

        const template = '/webservice/rest/server.php?wsfunction=local_user_count_api_count&' + 
                'moodlewsrestformat=json&' +
                'wstoken=USER_TOKEN&' + 
                'duration=1&' +
                'duration_unit=year';

        const options = {
            path: template.replace('USER_TOKEN', u.token),
            protocol: 'https:',
            hostname: u.hostname
        }

        let req = https.request(options, (res) => {
            // This will only have a non-200 OK in pretty exceptional circumstances.
            if (res.statusCode !== 200) {
                let e = 'users: ' + options.hostname + ' => ' + res.statusCode;
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
                        let msg = json.message ? json.message : json.exception;
                        util.log(__filename, msg);
                        return error(msg);
                    }
                    cache.put(key, json);
                    util.log_debug(__filename, 'users: ' + json.count);
                } catch (ex) {
                    let e = 'users: ' + ex;
                    util.log(__filename, e);
                    return error(e);
                }
                next({result: json.count});
            });
        });
        req.on('error', error);
        req.end();
    },
    60*60*1000 // cache TTL 1 hour
);
