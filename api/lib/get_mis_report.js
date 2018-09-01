var cache = require('./cache'),
    fs = require('fs'),
    util  = require('./util');

// This requires that some other magic script has created a file called ./api/mis.json
// in the format of an Odoo MIS report.
//
// Result is of the form
// {
//   <YYYY-MM>: {
//     month: <YYYY-MM>,
//     sales: nnn
//   },
//   ...
// }
module.exports = function(req, res, next, ctx){
    let resp = {};

    try{
        let raw = fs.readFileSync('./mis.json', {encoding: 'utf8'}),
            json = JSON.parse(raw);

        const month_lookup = [null, 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        let months = [];

        if (json.result.header.length > 0){
            months = json.result.header[0].cols
                .map(col => {
                    // MIS date format is "Jul 2018 (EU)". Turn that into "2018-7"
                    let parts = col.date.match(/(\w+)\s+(\d\d\d\d)/);
                    return parts[2] + '-' + month_lookup.indexOf(parts[1]);
                })
                .slice(0, 12)
                .reverse();
        }

        json.result.content.forEach(obj => {
            if (obj.kpi_name === 'Sales Revenue'){
                obj.cols
                    .slice(0, 12)
                    .reverse()
                    .forEach(col => {
                        let m = months.shift();
                        resp[m] = {
                            month: m,
                            sales: col.val
                        };
                    });
            }
        });
    }catch(ex){
        util.log(__filename, 'ERROR: ' + ex);
    }

    res.charSet('utf-8');
    res.json(resp);
    next && next(false);
};


