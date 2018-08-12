var util = require('./util');

'use strict';

var orgs = {};

const DEBUG = false;

exports.__raw = function(){ return orgs }

exports.add_org = function(contract){
    util.log_debug(__filename, `add_org(${JSON.stringify(contract)})`, DEBUG);

    orgs[contract.name] = JSON.parse(JSON.stringify(contract));
}

exports.add_system = function(contract, system){
    util.log_debug(__filename, `add_system(${JSON.stringify(contract)}, ${system})`, DEBUG);

    let o = orgs[contract.name];

    if (o){
        let s = o.systems || [];
        if (!s.includes(system)){
            s.push(system);
        }
        o.systems = s;
    }else{
        throw new Error(`add_system(${system}) called before add_org(${contract.name})`);
    }
}

// Succeed if either argument is null, or if the arrays match exactly.
function systems_match(a, b){
    return !Array.isArray(a) ||
           !Array.isArray(b) ||
           a.sort().join(',') === b.sort().join(',');
}

function get_org_by_key(field, val, systems){
    let o = null;

    Object.values(orgs).forEach(org => {
        if (org[field] === val && systems_match(systems, org.systems)){
            o = org;
        }
    });

    return o;
}

// Input is either a context object or a bare value, where the values are one of
//  - contracts.org_id
//  - contracts.name
// and it may be either a bare value or part of a context object (i.e. id vs. id.org)
//
// Returns contracts.* or null
exports.get_org = function(id){
    if (id === undefined){
        throw new Error('get_org() with no ID specified');
    }

    let o = null,
        n = parseInt(id); // in case it's a bare number

    if (id.org || !isNaN(n)){
        // Numeric lookups may need to be disambiguated by system
        o = get_org_by_key('org_id', id.org || n, id.systems);
    }else{
        // Name lookups are already unique... Unless someone has messed up in the CRM,
        // in which case we'll just return the first match
        o = get_org_by_key('name', id);
    }

    util.log_debug(__filename, 'get_org(' + JSON.stringify({id:id}) + ') => ' + JSON.stringify(o), DEBUG);

    return o;
}

exports.get_all_orgs = function(){
    return Object.values(orgs).map(o => { return o.org_id });
}

