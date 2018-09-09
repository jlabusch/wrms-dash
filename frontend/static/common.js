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

var sev_colors = [
    default_colors[7],
    default_colors[0],
    default_colors[2],
    default_colors[10]
];

var ORG = $("body").data("client"),
    SYSTEMS= $("body").data("systems"),
    PERIOD = $('body').data('month'),
    URI_EXT = ORG + '/' + SYSTEMS + '/' + PERIOD;

var donut_options = {
    donut: {
        label: {
            format: function(value, ratio, id){ return value + ' hours'; }
        }
    },
    chartArea: {
        height: "85%",
        left: "5%",
        top: "5%",
        width: "100%"
    }
}

var std_gchart_options = {
    titlePosition: 'none',
    legend: {position: 'none'},
    chartArea: {height: 200, left: '10%', width: '90%' },
    height: 250,
    orientation: 'horizontal',
    annotations: {
        alwaysOutside: true,
        textStyle: {
            fontSize: 12,
            auraColor: 'none',
            color: '#555'
        },
        boxStyle: {
            stroke: '#ccc',
            strokeWidth: 1,
            gradient: {
                color1: '#f3e5f5',
                color2: '#f3e5f5',
                x1: '0%', y1: '0%',
                x2: '100%', y2: '100%'
            }
        }
    },
    hAxis: {
        title: 'Category'
    },
    vAxis: {
        title: 'Number of WRs',
        minValue: 0
    },
    axisTitlesPosition: 'none'
};

function sum_sla_hours(sum, x){
    if (x[0].match(/SLA/)){
        return sum + x[1];
    }
    return sum;
}

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

function render(chart, pre, label){
    return function(err, data){
        if (err){
            chart.message(err.message);
        }else{
            if (typeof(pre) === 'function'){
                pre(chart, data);
            }else if (Array.isArray(pre)){
                pre.forEach(f => {
                    f(chart, data);
                });
            }
            if (label){
                console.log('render() ' + label + ': ' + JSON.stringify(data, null, 2));
            }
            if (!data.__skip_render){
                chart.data(data).render();
            }
        }
    }
}

function handle_empty_data(chart, data){
    if (data.result.length < 1 ||
        data.result.length === 1 && data.result[0].wr === 'None')
    {
        chart.type('message')
            .message('No data');
        data.__skip_render = true;
    }
}

