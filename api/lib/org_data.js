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
    return __orgs[id.org ? id.org : id];
}

