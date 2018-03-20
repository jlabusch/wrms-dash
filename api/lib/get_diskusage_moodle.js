var query = require('./query'),
    external_api = require('./external_api');

const label = 'diskusage_moodle';

module.exports = query.prepare({
    label: label,
    process_data: function(data, ctx, next){
        next({result: data});
    },
    db_query_override: external_api({
        label: label,
        check_config: function(org){
            return org &&
                   org.diskusage_moodle;
        },
        get_hostnames: function(org){
            return Array.isArray(org.diskusage_moodle) ? org.diskusage_moodle : [org.diskusage_moodle];
        },
        get_path: function(h){
            const template = '/webservice/rest/server.php?' +
                             'wsfunction=tool_diskusage_api&' +
                             'moodlewsrestformat=json&' +
                             'wstoken=USER_TOKEN';

            return template.replace('USER_TOKEN', h.token);
        },
        get_result: function(json){
            return {
                result: json.filessize + json.dbsize
            };
        }
    }),
    cache_timelimit_override: 60*60*1000 // cache TTL 1 hour
});
