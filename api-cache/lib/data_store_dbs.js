var util    = require('wrms-dash-util'),
    Swapper = util.swapper,
    sqlite3 = require('sqlite3').verbose();

module.exports = new Swapper(
    new sqlite3.Database(':memory:', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, db_startup_handler('active')),
    new sqlite3.Database(':memory:', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, db_startup_handler('syncing'))
);

function db_startup_handler(name){
    return function(err){
        util.log_debug(__filename, 'db_startup_handler(' + name + ')');
        if (err){
            util.log(__filename, 'ERROR creating ' + name + ' DB: ' + err);
        }else{
            util.log(__filename, name + ' DB created');
        }
    }
}

