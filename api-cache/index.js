var config  = require('config'),
    cache   = require('wrms-dash-db').cache,
    db      = require('wrms-dash-db').db.create(),
    store   = require('./lib/data_store'),
    util    = require('wrms-dash-util'),
    restify = require('restify');

'use strict';

var server = util.server.create('wrms-dash-api-cache', [config.get('api-cache.server.version')]);

server.post('/query', (req, res, next) => {
    util.log_debug(__filename, '/query ' + JSON.stringify(req.body));

    let json = typeof(req.body) === 'string' ? JSON.parse(req.body) : req.body;

    json.query.push(function(err, data){
        let r = {error: err, result: data};
        util.log_debug(__filename, '/query response is ' + JSON.stringify(r));
        res.json(r);
        next && next(false);
    });

    try{
        res.charSet('utf-8');
        store.internal_query.apply(null, json.query);
    }catch(ex){
        util.log(__filename, `ERROR: couldn't perform internal query - ${ex}`);
        res.json({error: ex});
        next && next(false);
    }
});


util.server.main(
    config.get('api-cache.server.listen_port'),
    () => { require('./lib/data_sync').unpause() }
);

