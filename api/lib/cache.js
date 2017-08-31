var util = require('./util');

var cache = {};

const MINS = 60*1000,
    DEFAULT_CACHE_TIMELIMIT = 1.5*MINS,
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
        timeout_limit = 15;

    process.nextTick(() => { do_wait(key, next, on_timeout, 1, timeout_limit); });

    let o = {
        then: function(good, bad){
            if (good) next = good;
            if (bad !== undefined) on_timeout = bad;
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

function do_wait(key, next, on_timeout, count, limit){
    if (count > limit){
        util.log(__filename, 'CACHE WAIT: Giving up on ' + key);
        on_timeout && on_timeout();
        return;
    }
    let c = cache_get(key);
    if (c){
        util.log_debug(__filename, 'CACHE WAIT -> HIT [' + key + ']', DEBUG);
        next && next(c, true);
    }else{
        setTimeout(function(){ do_wait(key, next, on_timeout, count+1, limit); }, 50*count);
    }
}

module.exports = {
    get: cache_get,
    put: cache_put,
    key: cache_key,
    wait: setup_wait
}

