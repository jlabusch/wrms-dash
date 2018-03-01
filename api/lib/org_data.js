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

