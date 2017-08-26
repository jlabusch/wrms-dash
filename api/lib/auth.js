var util    = require('./util'),
    config  = require('config');

function parse_auth(s){
    if (!s){
        return null;
    }

    let parts = s.match(/([^:\/]+).(.+)/);
    if (!parts){
        return null;
    }

    return {user: parts[1], pass: parts[2]};
}

var configured_open = false;

function check_auth(header, ctx){
    if (configured_open){
        return true;
    }

    if (!ctx){
        util.log(__filename, 'Bad context, no access granted.');
        return false;
    }

    let server_creds = parse_auth(config.get('server.password'), ctx);

    // Special case: empty server.password means no auth needed
    if (!server_creds){
        util.log(__filename, 'server.password invalid or not set, granting access');
        configured_open = true;
        return true;
    }
    // regular 401
    if (!header){
        return false;
    }

    let o = util.orgs[ctx.org],
        parts = header.match(/basic\s+([^ ]+)/i),
        req_creds = parse_auth(new Buffer(parts[1], 'base64').toString()),
        org_creds = o && o.password ? parse_auth(o.password) : null,
        result = false;

    if (parts){
        if (req_creds){
            if (server_creds && req_creds.user === server_creds.user){
                result = req_creds.pass === server_creds.pass;
            }else if (org_creds && req_creds.user === org_creds.user){
                result = req_creds.pass === org_creds.pass;
            }
            util.log(__filename, req_creds.user + ' access for org ' + ctx.org + ' -> ' + result);
        }
    }
    return result;
}

module.exports = check_auth;

