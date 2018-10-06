var util = require('wrms-dash-util');

'use strict';

// This grows indefinitely. If we had significant uptime, that could be a problem.
var cache = {};

const SECS = 1000,
    DEFAULT_CACHE_TIMELIMIT = 174*SECS,
    LAST_KNOWN_GOOD_LIMIT = 3*60*60*SECS, // 3 hours
    DEBUG = false;

function cache_key(name, context){
    if (context.error){
        return name;
    }
    return name + JSON.stringify(context);
}

function cache_put(key, val){
    var now = new Date().getTime();
    cache[key] = {ts: now, val: JSON.parse(JSON.stringify(val))};
    util.log_debug(__filename, 'CACHE PUT [' + key + ']', DEBUG);
}

function cache_get(key, limit){
    var now = new Date().getTime();
    var item = cache[key];
    if (item){
        if (!limit){
            limit = DEFAULT_CACHE_TIMELIMIT;
        }
        if (item.ts + limit > now){
            util.log_debug(__filename, 'CACHE HIT [' + key + ']', DEBUG);
            return JSON.parse(JSON.stringify(item.val));
        }
    }
    util.log_debug(__filename, 'CACHE MISS [' + key + ']', DEBUG);
    return null;
}

function setup_wait(key){
    let next = null,
        on_timeout = null,
        use_last_known_good = null,
        timeout_limit = 15;

    process.nextTick(() => { do_wait(key, next, on_timeout, 1, timeout_limit, use_last_known_good); });

    let o = {
        then: function(good, bad){
            if (good) next = good;
            if (bad !== undefined) on_timeout = bad;
            return o;
        },
        use_last_known_good: function(u){
            use_last_known_good = u;
            return o;
        },
        timeout: function(bad){
            on_timeout = bad;
            return o;
        },
        limit: function(n){
            timeout_limit = n;
            return o;
        }
    }
    return o;
}

function do_wait(key, next, on_timeout, count, limit, use_last_known_good){
    if (count > limit){
        util.log(__filename, 'CACHE WAIT: Giving up on ' + key);
        on_timeout && on_timeout();
        return;
    }
    let c = cache_get(key, use_last_known_good ? LAST_KNOWN_GOOD_LIMIT : undefined);
    if (c){
        util.log_debug(__filename, 'CACHE WAIT -> HIT [' + key + ']', DEBUG);
        next && next(c, true);
    }else{
        setTimeout(function(){ do_wait(key, next, on_timeout, count+1, limit); }, 50*count);
    }
}

module.exports = {
    __raw: cache,
    get: cache_get,
    put: cache_put,
    key: cache_key,
    wait: setup_wait,
    LAST_KNOWN_GOOD_LIMIT: LAST_KNOWN_GOOD_LIMIT
}

