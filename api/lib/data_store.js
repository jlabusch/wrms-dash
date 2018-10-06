var util    = require('wrms-dash-util'),
    Swapper = util.swapper,
    sqlite_promise = require('./data_store_promise').promise,
    generate_sqlite_promise = require('./data_store_promise').generate,
    sqlite3 = require('sqlite3').verbose();

const DEBUG = false;

'use strict';

let sql = require('./data_store_sql'),
    dbs = require('./data_store_dbs');

function init(){
    util.log_debug(__filename, 'init()', DEBUG);
    return Promise.all([
        create_schema(dbs.active()).catch(err => {
            util.log(__filename, 'FATAL ERROR creating active DB: ' + err);
            util.log(__filename, err.stack);
            process.exit(1);
        }),
        create_schema(dbs.syncing()).catch(err => {
            util.log(__filename, 'FATAL ERROR creating syncing DB: ' + err);
            util.log(__filename, err.stack);
            process.exit(1);
        })
    ]);
}
 
function create_schema(db){
    util.log_debug(__filename, 'create_schema()');

    db.run('PRAGMA foreign_keys = ON');
    return util.promise_sequence(sql.create_schema, generate_sqlite_promise(db));
}

function make_handler(req, res, next, ctx, label = __filename){
    return function(transform){
        return handler(req, res, next, ctx, transform, label);
    }
}

function handler_send_data(res, next, data, label){
    res.charSet('utf-8');
    res.json(data);
    next && next(false);
}

function handler_send_error(res, next, err, label){
    let e = err.message || err;
    util.log(label, 'ERROR: ' + e);
    handler_send_data(res, next, {error: e}, label);
}

function handler(req, res, next, ctx, transform, label = __filename){
    return function(err, data){
        if (err){
            handler_send_error(res, next, err, label);
            return;
        }

        if (transform){
            try{
                data = transform(data);
            }catch(ex){
                handler_send_error(res, next, ex, label);
                return;
            }
        }

        handler_send_data(res, next, data, label);
    }
}

module.exports = {
    init: init,
    dbs: dbs,
    sql: sql,
    sqlite_promise: sqlite_promise,
    generate_sqlite_promise: generate_sqlite_promise,
    query: function(/*stmt, arg, ..., next(err,rows)*/){
        let a = dbs.active();
        util.log_debug(__filename, 'db_' + dbs.identify(a) + ': ' + JSON.stringify(Array.prototype.slice.call(arguments, 0)));
        a.all.apply(a, arguments);
    },
    query_handler: handler,
    make_query_handler: make_handler,
    query_send_error: handler_send_error,
    query_send_data: handler_send_data
}

