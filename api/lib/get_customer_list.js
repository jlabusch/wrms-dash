var store = require('./data_store'),
    util = require('./util');

module.exports = function(req, res, next, ctx){
    store.query(
        util.trim  `SELECT  c.id,
                            c.org_name,
                            c.org_id
                    FROM    contracts c
                    ORDER BY c.org_name,c.id`,
        (err, data) => {
            if (err){
                util.log(__filename, 'ERROR: ' + (err.message || err));
                res.json({error: err.message});
                next && next(false);
                return;
            }

            if (!Array.isArray(data)){
                data = [];
            }

            let r = {};

            data.forEach(row => {
                r[row.id] = row.org_id;
            })

            res.charSet('utf-8');
            res.json(r);

            next && next(false);
        }
    );
}

