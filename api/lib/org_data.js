var util = require('./util');

var orgs = {};

exports.__raw = function(){ return orgs }

exports.add_org = function(contract){
    util.log_debug(__filename, `add_org(${JSON.stringify(contract)})`);

    orgs[contract.name] = JSON.parse(JSON.stringify(contract));
}

exports.add_system = function(contract, system){
    util.log_debug(__filename, `add_system(${JSON.stringify(contract)}, ${system})`);

    let o = orgs[contract.name];

    if (o){
        let s = o.systems || [];
        s.push(system);
        orgs[contract.name].systems = s;
    }else{
        throw new Error(`add_system(${system}) called before add_org(${contract.name})`);
    }
}

function get_org_by_key(field, val){
    let o = null;

    Object.values(orgs).forEach(org => {
        if (org[field] === val){
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
    util.log_debug(__filename, 'get_org(' + JSON.stringify({id:id}) + ')');

    if (id === undefined){
        throw new Error('get_org() with no ID specified');
    }

    let o = null,
        n = parseInt(id); // in case it's a bare number

    if (id.org || !isNaN(n)){
        o = get_org_by_key('org_id', id.org || n);
    }else{
        o = get_org_by_key('name', id);
    }

    return o;
}


/*
var config = require('config'),
    fs     = require('fs');

var __orgs = (function(cfg){
    let o = JSON.parse(JSON.stringify(cfg));
    Object.keys(o).forEach(name => {
        o[name].name = name;
        o[ o[name].id ] = o[name];
    });
    return o;
})(config.get('orgs'));

exports.get_org = function(id){
    if (id === undefined){
        return null;
    }
    return __orgs[id.org ? id.org : id];
}

exports.get_all_orgs = function(){
    // not using __orgs because it doubles up ID and name keys
    let o = JSON.parse(JSON.stringify(config.get('orgs')));
    return Object.keys(o).map(name => {
        return o[name].id;
    });
}

exports.get_all_systems = function(){
    let arr = [];
    // not using __orgs because it doubles up ID and name keys
    let o = JSON.parse(JSON.stringify(config.get('orgs')));
    Object.keys(o).forEach(name => {
        let s = o[name].default_system;
        if (s && s.match(/^[0-9,]+$/)){
            arr = arr.concat(s.split(/,/));
        }
    });
    return arr;
}
*/
