var default_colors = [
        // teal     red       yellow    purple    orange    mint      blue      green     lavender
        "#00bbde","#fe6672","#eeb058","#8a8ad6","#ff855c","#00cfbb","#5a9eed","#73d483","#c879bb",
        "#0099b6","#d74d58","#cb9141","#6b6bb6","#d86945","#00aa99","#4281c9","#57b566","#ac5c9e",
        "#27cceb","#ff818b","#f6bf71","#9b9be1","#ff9b79","#26dfcd","#73aff4","#87e096","#d88bcb"
        // Catalyst colors:
        // "#5b9aa9", "#e6ad30", "#889a3a", "#ba2025", "#c6b253", "#dd8545", "#50433c"
    ],
    URI_BASE_DEFAULT = '/api',
    SECS = 1000;

var ORG = $("body").data("client"),
    PERIOD = $('body').data('month'),
    URI_EXT = ORG + '/default/' + PERIOD;

function query(path, next, override_uri, refresh_interval_secs, override_uri_ext){
    let xhr = new XMLHttpRequest();
    if (refresh_interval_secs === undefined){
        refresh_interval_secs = 60;
    }
    let uri_ext = override_uri_ext ? override_uri_ext : URI_EXT;
    xhr.open('GET', (override_uri ? override_uri : URI_BASE_DEFAULT) + path + '/' + uri_ext, true);
    xhr.onreadystatechange = function(){
        if (xhr.readyState !== 4){
            return;
        }
        if (refresh_interval_secs){
            setTimeout(function(){
                query(path, next, override_uri, refresh_interval_secs, override_uri_ext);
            }, refresh_interval_secs*SECS);
        }
        if (xhr.status !== 200){
            next(new Error('' + xhr.status));
            return;
        }
        var json = undefined;
        try{
            json = JSON.parse(xhr.responseText);
        }catch(ex){
            console.log(ex);
        }
        next(null, json || xhr.responseText);
    }
    xhr.send();
}

function render(chart, pre){
    return function(err, data){
        if (err){
            chart.message(err.message);
        }else{
            if (pre){
                pre(chart, data);
            }
            //console.log('render() ' + JSON.stringify(data, null, 2));
            if (!data.__skip_render){
                chart.data(data).render();
            }
        }
    }
}
