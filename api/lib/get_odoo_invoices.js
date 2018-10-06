var cache = require('./cache'),
    fs = require('fs'),
    config = require('config'),
    util  = require('wrms-dash-util');

// This requires that some other magic script has created a file called ./api/invoices.json
// in the format of an Odoo search_read API call.
// Notes:
//   * this is ONLY open/paid invoices, not drafts or refunds
//   * currency is converted to hours at our default hourly rates
//     because it's not easy to match these client names to the CRM (yuck)
//
// Result is of the form
// {
//   <YYYY-MM>: {
//     month: <YYYY-MM>,
//     clients: {
//         <client>: {
//           name: string,
//           currency: string,
//           invoiced: number,
//           hours_equiv: number
//         },
//         ...
//     },
//     total: { hours_equiv: number }
//   },
//   ...
// }
module.exports = function(req, res, next, ctx){
    if (util.send_err_if_not_vendor(req, res, next, ctx, __filename)){
        return;
    }

    let resp = {};

    try{
        let raw = fs.readFileSync('./invoices.json', {encoding: 'utf8'}),
            json = JSON.parse(raw);

        // Input format is
        // {
        //   result: {
        //     records: [
        //       {
        //         amount_total_signed: 123,
        //         currency_id: [ 123, "GBP.EU" ] (or "EUR.EU" or "USD.EU")
        //         partner_id: [ 123, "Company Name" ],
        //         date_invoice: "2018-08-17",
        //         state: "draft" (or "open" or "paid")
        //       }
        //     ]
        //   }
        // }

        if (json && json.result && Array.isArray(json.result.records)){
            json.result.records.forEach(i => {
                if (i.state !== 'open' && i.state !== 'paid'){
                    return;
                }

                let month = i.date_invoice.match(/(\d\d\d\d-\d?\d)/);
                if (month){
                    month = month[1].replace(/-0/, '-');
                }

                let rm = resp[month] || {month: month, clients: {}, total: {hours_equiv:0}};

                let rp = rm.clients[i.partner_id[1]] || {currency: i.currency_id[1], name: i.partner_id[1], invoiced: 0, hours_equiv: 0};
                rp.invoiced += i.amount_total_signed;
                rm.clients[i.partner_id[1]] = rp;

                resp[month] = rm;
            });
        }

        const rates = config.get('default_rates');

        Object.values(resp).forEach(rm => {
            let total = 0;
            Object.values(rm.clients).forEach(client => {
                client.hours_equiv = Math.round((client.invoiced/rates[client.currency])*10)/10;
                total += client.hours_equiv;
            });
        });
    }catch(ex){
        util.log(__filename, 'ERROR: ' + ex);
    }

    res.charSet('utf-8');
    res.json(resp);
    next && next(false);
};


