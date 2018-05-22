var cache = require('./cache'),
    fs = require('fs'),
    util  = require('./util');

// This requires that some other magic script has created a file called ./api/mis.json
// in the format of an Odoo MIS report.
module.exports = function(req, res, next, ctx){
    let resp = {result: []};

    try{
        let raw = fs.readFileSync('./mis.json', {encoding: 'utf8'}),
            json = JSON.parse(raw);

        let months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
        if (json.result.header.length > 0){
            months = json.result.header[0].cols.map(col => { return col.date.replace(' (EU)', '') }).slice(0, 12).reverse();
        }

        json.result.content.forEach(obj => {
            if (obj.kpi_name === 'Sales Revenue'){
                resp.result = obj.cols.slice(0, 12).reverse().map(col => { return [months.shift(), col.val]; });
            }
        });
    }catch(ex){
        util.log(__filename, 'ERROR: ' + ex);
    }

    res.charSet('utf-8');
    res.json(resp);
    next && next(false);
};


