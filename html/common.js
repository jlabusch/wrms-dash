var default_colors = [
        // teal     red       yellow    purple    orange    mint      blue      green     lavender
        "#00bbde","#fe6672","#eeb058","#8a8ad6","#ff855c","#00cfbb","#5a9eed","#73d483","#c879bb",
        "#0099b6","#d74d58","#cb9141","#6b6bb6","#d86945","#00aa99","#4281c9","#57b566","#ac5c9e",
        "#27cceb","#ff818b","#f6bf71","#9b9be1","#ff9b79","#26dfcd","#73aff4","#87e096","#d88bcb"
        // Catalyst colors:
        // "#5b9aa9", "#e6ad30", "#889a3a", "#ba2025", "#c6b253", "#dd8545", "#50433c"
    ],
    URI_BASE_DEFAULT = 'http://mango.btn.catalyst-eu.net:8004',
    SECS = 1000;

var ORG = (function(s){ var a = s.match(/org=([^&]+)/); return a ? a[1] : 1137; })(window.location.search),
    SYS = (function(s){ var a = s.match(/sys=([^&]+)/); return a ? a[1] : 'default'; })(window.location.search),
    DEFAULT_PERIOD = (function(){
        var now     = new Date(),
            YEAR    = now.getFullYear(),
            MONTH   = (now.getMonth()+1)%12;
        return YEAR + '-' + MONTH;
    })(),
    PERIOD = (function(s){ var a = s.match(/period=(\d\d\d\d-\d\d?)/); return a ? a[1] : DEFAULT_PERIOD; })(window.location.search),
    URI_EXT = ORG + '/' + SYS + '/' + PERIOD;

function query(path, next, override_uri, refresh_interval_secs){
    let xhr = new XMLHttpRequest();
    if (refresh_interval_secs === undefined){
        refresh_interval_secs = 60;
    }
    xhr.open('GET', (override_uri ? override_uri : URI_BASE_DEFAULT) + path + '/' + URI_EXT, true);
    xhr.onreadystatechange = function(){
        if (xhr.readyState !== 4){
            return;
        }
        if (xhr.status !== 200){
            next(new Error('' + xhr.status));
            return;
        }
        if (refresh_interval_secs){
            setTimeout(function(){
                query(path, next, override_uri, refresh_interval_secs);
            }, refresh_interval_secs*SECS);
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
            chart.data(data).render();
        }
    }
}
