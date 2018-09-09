var request = require('request'),
    config = require('config'),
    org_data = require('./org_data'),
    util = require('./util');

'use strict';

var auth_username = undefined,
    auth_token = undefined;

const DEBUG = false;

exports.fetch_contracts = function(){
    return new Promise((resolve, reject) => {
        log_in().then(query_espo_contracts)
                .then(query_espo_accounts)
                .then(merge_espo_data)
                .then(
                    resolve,
                    reject
                );
    });
}

function make_handler(resolve, reject, label, process){
    return function(err, res, body){
        if (err){
            reject(err);
            return;
        }
        if (res.statusCode >= 400){
            let reason = res.headers['x-status-reason'] || 'unknown';
            reject(new Error(`CRM ${label} query (${res.statusCode} reason ${reason})`));
            return;
        }
        if (res.statusCode == 200){
            try{
                resolve(process(JSON.parse(body)));
            }catch(ex){
                reject(ex);
            }
            return;
        }
        reject(new Error(`CRM ${label} query got unhandled HTTP status code ${res.statusCode}`));
    }
}

// returns {"user":{"id":"5900af1c7206dafeb","userName":"jacques","isActive":true,"token":"0d5bceacb976ec7d6c89d4e7f8ce4100",...
function log_in(){
    return new Promise((resolve, reject) => {
        let auth = config.get('espo.auth'),
            options = {
                url: config.get('espo.host') + '/espo/api/v1/App/user',
                strictSSL: false,
                headers: {
                    'Espo-Authorization': auth,
                    'Espo-Authorization-By-Token': 'false',
                    'Authorization': 'Basic ' + auth,
                    'Accept': 'application/json'
                }
            };

        util.log_debug(__filename, `log_in(): curl -sik '${options.url}' -H 'Espo-Authorization: ${auth}' -H 'Espo-Authorization-By-Token: false' -H 'Authorization: Basic ${auth}' -H 'Accept: application/json'`, DEBUG);

        request(
            options,
            make_handler(resolve, reject, 'login', json => {
                auth_username = json.user.userName;
                auth_token = json.user.token;
                return {username: json.user.userName, token: json.user.token};
            })
        );
    });
}

// returns {
//   list: [
//     {
//       accountName: "University Of Bath",
//       name: "2018 SLA",
//       accountId: "58e4fc5d455da125a",
//       startDate: "2018-06-17",
//       endrenewalDate: "2020-06-16",
//       invoicingFrequency: "Monthly",
//       sLAFrequency: "Monthly ",
//       sLAHours: 30,
//       systemID: null,
//       status: "Active",
//       type: "Service Level Agreement",
//       sLASupportFee: 123,
//       hourlyRate: 456,
//       sLASupportFeeCurrency: "GBP",
//       ...
//     }
//   ]
// }
function query_espo_contracts(context){
    return new Promise((resolve, reject) => {
        let token = new Buffer(context.username + ':' + context.token).toString('base64');
            // TODO: increase offset until list.size is 0
            options = {
                url: config.get('espo.host') + '/espo/api/v1/Case?maxSize=200&offset=0&sortBy=type&asc=false',
                strictSSL: false,
                headers: {
                    'Espo-Authorization': token,
                    'Espo-Authorization-By-Token': 'true',
                    'Authorization': 'Basic ' + token,
                    'Accept': 'application/json',
                    'Cookie': 'auth-username=' + context.username + '; auth-token=' + context.token
                }
            };

        util.log_debug(__filename, `query_espo_conracts(): curl -sik '${options.url}' -H 'Espo-Authorization: ${token}' -H 'Espo-Authorization-By-Token: true' -H 'Authorization: Basic ${token}' -H 'Accept: application/json' -H 'Cookie: auth-username=${context.username}; auth-token=${context.token}'`, DEBUG);

        request(
            options,
            make_handler(resolve, reject, 'login', json => {
                context.contracts = json;
                return context;
            })
        );
    });
}

// returns {
//   list: [
//     {
//       id: "58e4fc5d455da125a",
//       orgID: 1757,
//       ...
//     }
//   ]
// }
function query_espo_accounts(context){
    return new Promise((resolve, reject) => {
        let token = new Buffer(auth_username + ':' + auth_token).toString('base64'),
            // TODO: increase offset until list.size is 0
            options = {
                url: config.get('espo.host') + '/espo/api/v1/Account?maxSize=200&offset=0&sortBy=createdAt&asc=false',
                strictSSL: false,
                headers: {
                    'Espo-Authorization': token,
                    'Espo-Authorization-By-Token': 'true',
                    'Authorization': 'Basic ' + token,
                    'Accept': 'application/json',
                    'Cookie': 'auth-username=' + auth_username + '; auth-token=' + auth_token
                }
            };

        util.log_debug(__filename, `query_espo_accounts(): curl -sik '${options.url}' -H 'Espo-Authorization: ${token}' -H 'Espo-Authorization-By-Token: true' -H 'Authorization: Basic ${token}' -H 'Accept: application/json' -H 'Cookie: auth-username=${context.username}; auth-token=${context.token}'`, DEBUG);

        request(
            options,
            make_handler(resolve, reject, 'account', json => {
                context.accounts = json;
                return context;
            })
        );
    });
}

function normalise_billing(value, frequency){
    switch(frequency){
        case 'Annually':    return value/12;
        case '6 Monthly':   return value/6;
        case 'Quarterly':   return value/4;
        case 'Monthly':     return value;
        default:
            util.log(__filename, 'WARNING: unsupported invoicing frequency"' + frequency + '", treating as Monthly');
    }
    return value;
}

// Link contracts and accounts based on account ID, and select only contracts with:
//      status: "Active"
//      type: "Service Level Agreement"
function merge_espo_data(context){
    let active = {};

    util.log_debug(__filename, '==================== Raw contracts: ', DEBUG);
    context.contracts.list.forEach(c => {
        if (['Active', 'Draft'].includes(c.status) && c.type === 'Service Level Agreement'){
            util.log_debug(__filename, `${c.name} ${c.type} [${c.status}] worth ${c.sLASupportFee} ${c.sLASupportFeeCurrency} (billed ${c.invoicingFrequency})`, DEBUG);
            if (!active[c.accountId]){
                active[c.accountId] = [];
            }
            active[c.accountId].push({
                name: c.name,
                org_name: c.accountName,
                cash_value: normalise_billing(c.sLASupportFee, c.invoicingFrequency),
                cash_rate: c.hourlyRate,
                cash_currency: c.sLASupportFeeCurrency,
                type: (c.sLAFrequency || 'unknown').toLowerCase().trim(),
                hours: (c.sLAHours || 0),
                start_date: util.date_fmt(new Date(c.startDate)),
                end_date: util.date_fmt(new Date(c.endrenewalDate)),
                systems: (c.systemID ? c.systemID.split(/,\s*/).map(n => parseInt(n)).filter(n => n !== null && !isNaN(n)) : [])
            });
        }
    });

    let result = [];

    util.log_debug(__filename, '==================== Raw accounts: ', DEBUG);
    context.accounts.list.forEach(acc => {
        if (acc.type !== 'Customer' || acc.deleted || !acc.orgID){
            return;
        }

        util.log_debug(__filename, acc.id + ': ' + acc.name + ' (' + acc.orgID + ')', DEBUG);

        // Create an org record whether there's an active contract or not. data_sync's
        // add_new_contract_and_systems() will add more detail as necessary.
        // If there's no active contract it'll never touch our DB, just be noted in org_data.
        org_data.syncing().add_org({
            org_id: acc.orgID,
            org_name: acc.name,
            name: acc.name,
            hours: 0,
            cash_value: 0,
            cash_rate: acc.hourlyRateConverted || 85,
            cash_currency: 'GBP',
            start_date: null,
            end_date: null,
            systems: []
        });

        if (active[acc.id]){
            active[acc.id].forEach(a => {
                a.org_id = acc.orgID;
                result.push(a);
            });
        }
    });
    return Object.values(result);
}

