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

module.exports = {
    init: init,
    internal_query: function(/*stmt, arg, ..., next(err,rows)*/){
        let a = dbs.active();
        util.log_debug(__filename, 'db_' + dbs.identify(a) + ': ' + JSON.stringify(Array.prototype.slice.call(arguments, 0)));
        a.all.apply(a, arguments);
    }
}

