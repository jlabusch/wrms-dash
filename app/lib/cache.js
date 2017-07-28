var cache = {};

const MINS = 60*1000,
    DEFAULT_CACHE_TIMELIMIT = 5*MINS;

function cache_key(name, context){
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
            //console.log('CACHE HIT [' + key + ']');
            return JSON.parse(JSON.stringify(item.val));
        }
    }
    console.log('CACHE MISS [' + key + ']');
    return null;
}

function setup_wait(key){
    let next = null,
        on_timeout = null;

    process.nextTick(() => { do_wait(key, next, on_timeout, 1); });

    let o = {
        then: function(good, bad){
            if (good) next = good;
            if (bad !== undefined) on_timeout = bad;
            return o;
        },
        timeout: function(bad){
            on_timeout = bad;
            return o;
        }
    }
    return o;
}

function do_wait(key, next, on_timeout, count){
    if (count > 15){
        console.log('CACHE WAIT: Giving up on ' + key);
        on_timeout && on_timeout();
        return;
    }
    let c = cache_get(key);
    if (c){
        console.log('CACHE WAIT -> HIT [' + key + ']');
        next && next(c, true);
    }else{
        setTimeout(function(){ do_wait(key, next, on_timeout, count+1); }, 50*count);
    }
}

module.exports = {
    get: cache_get,
    put: cache_put,
    key: cache_key,
    wait: setup_wait
}

