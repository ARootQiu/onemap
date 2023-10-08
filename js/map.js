var map = null;
var region = null;
var dmList = null;
var drawControl = null;
var drawTool = null;
var styleMap = {};
var curSelectedNodeData = null;
var selectDate = null;
function loadmap() {
    GeowinSetRTLTextPlugin();

    map = new CMap({
        container: "map",
        center: [105.09338, 33.1348],
        style: "data/streets.json",
        zoom: 0.6,
        minZoom: 0,
        maxZoom: 17,
        // projection:'globe'
    });
    map.addControl(new CGeowinLanguage({ defaultLanguage: 'zh' }));
    map.on("load", function () {
        map.addSky();

    });

    map.addControl(new CNavigationControl());

    map.addControl(new CScaleControl());




    initializeZQTree();


    region = new CRegion(map);
    region.getCenterPlace(function (data) {
        if (data == null) return;
        document.getElementsByClassName("curr-city__text")[0].textContent = data.name;
    });

    drawTool = new GeowinDraw({ displayControlsDefault: false });
    map.addControl(drawTool);

}
function test() {
    for (i = 0; i < map.getStyle().layers.length; i++) {
        console.log(map.getStyle().layers[i].id);
    }
}



function checkLayerTreeNode(nodedata, checked) {
    curSelectedNodeData = nodedata;

    if (!nodedata.layerid) return;
    nodedata.id = nodedata.id + '';
    if (checked) {
        loadLayer(nodedata);
        this.vue.screenageList.push(nodedata);
    } else {
        removeLayer(nodedata);
        if (nodedata.special == 'times.sate') $('.bottom-panel').addClass('hide')
        this.vue.screenageList = this.vue.screenageList.filter(obj => obj.id != nodedata.id);
    }


}

function loadLayer(nodedata, beforceId) {
    if (nodedata.style && nodedata.type == 'vector') {
        map.setStyle(nodedata.style);
        return;
    }
    if (nodedata.type == 'dem') {
        map.addTerrain();
        return;
    }
    if (nodedata.special == 'times.sate') {
        map.on("moveend", getHistoryRasterDates);
        map.on("zoomend", getHistoryRasterDates);
        $('.bottom-panel').removeClass('hide')
        getHistoryRasterDates();
        return;
    }

    if (nodedata.layerid.indexOf(',') == -1)
        return addLayer(nodedata, beforceId);
    var lids = nodedata.layerid.split(',');
    for (var i = 0; i < lids.length; i++) {
        var ndata = Object.assign({}, nodedata);
        ndata.layerid = lids[i];
        ndata.id = ndata.id + "_" + i;
        addLayer(ndata, beforceId);
    }
}
function removeLayer(nodedata) {
    if (nodedata.style && nodedata.type == 'vector') {
        setDefaultStyle();
        return;
    }
    if (nodedata.type == 'dem') {
        map.removeTerrain();
        return;
    }
    if (map.getLayer(nodedata.id))
        map.removeLayer(nodedata.id);
}
function addLayer(nodedata, beforceId) {
    var options = {
        id: nodedata.id,
        type: nodedata.type,
        tileSize: 256
    };
    if (nodedata.layerid)
        options.tiles = getServerUrl(nodedata);
    if (nodedata.url) {
        if (Array.isArray(nodedata.url))
            options.tiles = nodedata.url;
        else
            options.tiles = [nodedata.url];
    }

    if (map.getSource(options.id)) {
        if (map.getLayer(options.id)) map.removeLayer(options.id);
        map.removeSource(nodedata.id);
    }
    map.addSource(nodedata.id, options);
    if (!map.getStyle())
        setDefaultStyle();

    options.source = options.id;
    options.minzoom = 0;
    options.maxzoom = 18;

    if (map.getLayer(options.id)) map.removeLayer(options.id);
    return map.addLayer(options, beforceId);

}
function getServerUrl(nodedata) {
    if (nodedata.layerid.toLowerCase().endsWith('.arcmxd')) {
        return getAEUrl({ mxd: CEncode(nodedata.layerid), url: nodedata.url });
    }
    if (nodedata.tableinfo != null) {
        var tableinfostr = CEncodeSpecialChar(CJsonToStringify(nodedata.tableinfo));
        var opts = { serviceproviderid: 'map.tablepointlayerserviceprovider', serviceid: 'gettileformess', tableinfo: tableinfostr, color: CEncode('#ff0000') };
        var strparams = CGetAttrsStr(opts);
        var list = [];
        for (var i = 0; i < CGeowin.BaseMapServer.length; i++) {
            list.push(CGeowin.BaseMapServer[i] + '/ds?requesttype=img&srs=epsg:900913&' + strparams + '&x={x}&y={y}&z={z}&wrap=false');
        }
        return list;
    }
    return CGetMapUrl({ tilename: nodedata.layerid });
}


function getAEUrl(options) {
    options = CMergeObj({ x: '{x}', y: '{y}', z: '{z}' }, options);
    if (options.url) return [options.url];

    var str = CGetAttrsStr(options);
    var list = [];
    for (var i = 0; i < CGeowin.BaseMapServer.length; i++) {
        list.push(CGeowin.AEServer[i] + "/arccommon/gettile?" + str);
    }
    return list;
}
function CGetMapUrl(options) {
    options = CMergeObj({ x: '{x}', y: '{y}', z: '{z}' }, options);
    if (options.url) return [options.url];
    var tilename = options.tilename;
    delete options.tilename;
    var str = CGetAttrsStr(options);
    var list = [];
    for (var i = 0; i < CGeowin.BaseMapServer.length; i++) {
        list.push(CGeowin.BaseMapServer[i] + "/geowin/cachedwtms/services/" + tilename + "/gettile?" + str);
    }
    return list;
}

function setDefaultStyle() {
    var style = {
        "version": 8,
        "name": "defaultstyle",
        "sources": {},
        "layers": [
            {
                "id": "background",
                "type": "background",
                "paint": {
                    "background-color": "rgb(40,60,31)"
                }
            }
        ],
        "visibility": "public",
        "id": "sate",
        "draft": false
    }

    map.setStyle(style);
}


var selectDate = null;
function getHistoryRasterDates() {

    var url = CGeowin.AbrPath + "/gee/getcentertiledates.it?l=" + Math.round(map.getZoom()) + "&center=" + map.getCenter().lng.toFixed(5) + "," + map.getCenter().lat.toFixed(5);
    CGetData(url, function (data) {
        data = CParseObj(data);
        var dates = [], legend = '';
        for (var i = 1; i < data.length; i++) {
            dates.push(new Date(Date.parse(data[i])))
        }
        var appE = document.querySelector('[ng-controller=MainCtrl]');
        var $scope = angular.element(appE).scope();
        if (selectDate == null)
            selectDate = dates[dates.length - 1];
        addHistoryRaster(selectDate);
        $scope.slider_dates = {
            value: selectDate,
            options: {
                stepsArray: dates,
                showTicks: true,
                showTicksValues: dates.length > 50 ? 8 : 5,
                ticksValuesTooltip: function (v) {

                },
                onChange: function (id, newValue, highValue, pointerType) {
                    selectDate = newValue;
                    addHistoryRaster(newValue);
                },
                translate: function (date) {
                    return getYearMonth(date);
                },
            }
        };
        $scope.$apply();

    })
}

function getYearMonth(date) {
    if (date != null) return date.getFullYear() + "-" + add2Length(date.getMonth() + 1);
    return '';
}

function add2Length(num) {
    var str = num.toString();
    if (str.length == 1) return '0' + str;
    return str;
}

function addHistoryRaster(date) {
    var date = selectDate.getFullYear() + "-" + add2Length(selectDate.getMonth() + 1) + "-" + add2Length(selectDate.getDate());

    curSelectedNodeData.url = CGeowin.AbrPath + "/gee/gethistorytile.it?x={x}&y={y}&l={z}&date=" + date;

    addLayer(curSelectedNodeData);
}




function initializeZQTree() {
    CGetData("data/admin.json", function (data) {
        var obj = JSON.parse(data);
        var continent = obj.continent,
            province = obj.province;

        var prov_str = "",
            cont_str = "";
        //州
        for (var i in continent) {
            cont_str +=
                '<div class="city_tit"><a class="zq" href="javascript:void(0)" onclick="listSubCountry(this);" code="' +
                continent[i].code + '" title="' + continent[i].fullname + '" bunds="' + continent[i].bunds + '">' + continent[i].name + "</a></div>";
        }
        //省
        for (var i in province) {
            prov_str +=
                '<div class="city_tit"><a class="zq" href="javascript:void(0)" onclick="listSub(this);" code="' +
                province[i].code + '" title="' + province[i].fullname + '">' + province[i].name + "</a></div>";
        }
        $("#continent-list").text();
        $("#province-list").text();
        $("#continent-list").append(cont_str);
        $("#province-list").append(prov_str);
    });
}

function setSearchSuggest() {
    $("#txtsearch").autocomplete({
        minLength: 1,
        autoFocus: false,
        delay: 0,
        source: function (request, response) {
            var transObj = {};
            transObj.serviceProviderId = "search.dmserviceprovider";
            transObj.serviceId = "dminputsuggest";
            transObj.params = { name: CEncode($CV("txtsearch")) };

            var url = CRequestUrl(transObj);
            $.ajax({
                url: url,
                dataType: "json",
                data: request,
                success: function (data) {
                    response(data);
                },
            });
        },
    });
}


function calLength() {
    drawTool.calLength();
}

function calArea() {
    drawTool.calArea();
}
function drawPoint() {
    drawTool.changeMode(drawTool.modes.DRAW_POINT);
}
function drawLine() {
    drawTool.changeMode(drawTool.modes.DRAW_LINE_STRING);
}
function drawPoly() {
    drawTool.changeMode(drawTool.modes.DRAW_POLYGON);
}

function allMap() {
    map.getMap().returnToSavedPosition();
}


function listSub(obj) {
    hasResult = true;
    $("#resultlist").show();
    var code = obj.getAttribute("code");
    lastName = obj.innerHTML;
    region.addBoundary(code, function (data) {
        if (code == "110000" || code == "120000" || code == "310000" || code == "460000") {
            $('.city_content').hide()
            region.addBoundary(code, function (data) {
                setZQBounds(code, data);
            });
        }
        else
            listZQAndSetBounds(code, data);
    });
}


function wenben(code) {
    code = code.toString();
    if (code.length == 6)
        window.open("/zhengwu/china/" + code + ".html", "_blank");
    else
        window.open("/zhengwu/world/" + code + ".html", "_blank");
}

function clearMap() {
    $("#resultlist").hide();
    $("#txtSearchZQ").val("");
    hasResult = false;
    region.removeAll();
    drawTool.removeAll();
}

function listZQAndSetBounds(code, data) {
    if (data == null) return;
    map.fitBounds([[data.bunds[0], data.bunds[1]], [data.bunds[2], data.bunds[3]]]);
    var htm =
        "<div class='city_content clearfix'><div class='ever_tit clearfix'><div class='text'>" +
        data.name +
        "</div><div class='detail' onclick='wenben(" + code + ")'>简介</div></div>";
    for (var i = 0; i < data.sub.length; i++) {
        htm +=
            "<div class='ever_city'><div><a class='sblue' href='javascript:void(0)' onclick='listXian(this)' code='" +
            data.sub[i].code +
            "'>" +
            data.sub[i].name +
            "</a></div></div>";
    }
    htm +=
        "</div><div class='ever_regin_content  clearfix' id='xian'></div>";
    $C("resultlist").innerHTML = htm; //  zqsublist

}

var lastName = "";

function listXian(obj) {
    var code = obj.getAttribute("code");
    lastName = obj.innerHTML;
    region.addBoundary(code, function (data) {
        setZQBounds(code, data);
    });
}
function setZQBounds(code, data) {
    if (data == null) return;
    map.fitBounds([[data.bunds[0], data.bunds[1]], [data.bunds[2], data.bunds[3]]]);
    if (data.sub == null || data.sub.length == 0) return;
    var htm =
        "<div class='ever_tit clearfix'><div class='text'>" +
        data.name +
        "</div><div class='detail' onclick='wenben(" + code + ")'>简介</div></div><div class='ever_regin_list auScroll'>";
    for (var j = 0; j < data.sub.length; j++) {
        var wenben = "<a class='sblue' href='javascript:void(0)' onclick='wenben(" + data.sub[j].code + ")'>简介 </a>";

        htm += "<div class='ever_regin clearfix'><div class='ever_regin_text' ><a class='sblue' href='javascript:void(0)' onclick='listXian(this)' code='" + data.sub[j].code + "'>" +
            data.sub[j].name + "</a></div><div class='ever_regin_detail'>" + wenben + "</div></div>";
    }
    htm += "</div>";
    if ($C("xian"))
        $C("xian").innerHTML = htm;
    else
        $C("resultlist").innerHTML = htm;
    // $(".auScroll").scrollBar();
}
function search() {
    var value = $CV("txtSearch");
    if (value == "") {
        return;
    }
    hasResult = true;

    $("#resultlist").show();

    region.searchDM(value, listDM);
}

function listDM(list) {
    if (list == null) {
        $C("resultlist").innerHTML = "无查询结果"; // zqsublist
        return;
    }
    dmList = list;
    var htm =
        "<ul class='result_tit'><li>查询结果如下:<li></ul><div class='result_list auScroll' >";
    for (var j = 0; j < list.length; j++) {
        if (list[j].code) {
            var wenben = "<span class='st'>简介</span>";
            wenben =
                "<a class='sblues' href='javascript:void(0)' onclick='wenben(" +
                list[j].code +
                ")'>简介 </a>";
            htm +=
                "<div class='ever_regin clearfix'><div class='ever_regin_text'><a class='sblues' href='javascript:void(0)' code='" +
                list[j].code +
                "' onclick='showZQBounds(this)'>" +
                list[j].name +
                "</a></div><div class='ever_regin_detail'><span class='detail'>" +
                wenben +
                "</span></div></div>";
        } else {
            htm +=
                "<div class='ever_result'><div class='sort_line'><span class='sort'>" +
                (j + 1) +
                "." +
                "</span><a class='sblue' href='javascript:void(0)' title='" +
                list[j].detailname +
                "'  onclick='selDM(" +
                j +
                ")'>" +
                list[j].detailname +
                "</a></div></div>";
        }
    }
    htm += "</div>";
    $C("resultlist").innerHTML = htm;
    // $(".auScroll").scrollBar();

}

function showZQBounds(obj) {
    var code = obj.getAttribute("code");
    lastName = obj.innerHTML;
    region.addBoundary(code, function (data) {
        if (data == null) return;
        listSubZQAndSetBounds(data);
    });
}

function listSubZQAndSetBounds(data) {
    if (data == null) return;

    map.fitBounds([
        [data.bunds[0], data.bunds[1]],
        [data.bunds[2], data.bunds[3]],
    ]);
    region.drawPoly(data);
}

function searchDM(page) {
    hasResult = true;
    $("#resultlist").show();

    var name = $CV("txtsearch");
    if (name == "") {
        return;
    }
    searchCurPage = 0;
    region.searchDM(name, 10, page, true, listDM);
}

function selDM(idx) {
    if (idx > dmList.length - 1) return;
    region.goToDM(dmList[idx]);
}

function showZQBoundsExt(code, data) {
    if (data == null) return;
    map.fitBounds([
        [data.bunds[0], data.bunds[1]],
        [data.bunds[2], data.bunds[3]],
    ]);
    region.drawPoly(data, map.getZoom() + 3);
}

function listSubCountry(obj) {
    hasResult = true;
    $("#resultlist").show();
    var code = obj.getAttribute("code");
    var bunds = obj.getAttribute("bunds").split(",");
    map.fitBounds([
        [parseFloat(bunds[0]), parseFloat(bunds[1])],
        [parseFloat(bunds[2]), parseFloat(bunds[3])],
    ]);

    region.addBoundary(code, function (data) {
        listCountry(code, data);
    });
}

function listCountry(code, data) {
    var htm = "<div class='country_list auScroll' >";
    for (var i = 0; i < data.length; i++) {
        var bm =
            "setCountryBounds(" +
            data[i].bunds[0] +
            "," +
            data[i].bunds[1] +
            "," +
            data[i].bunds[2] +
            "," +
            data[i].bunds[3] +
            "," +
            data[i].code +
            ")";
        htm +=
            "<div class='ever_country clearfix'><div class='text'><a class='sblue' href='javascript:void(0)' onclick='" +
            bm +
            "'>" +
            data[i].name +
            "</a></div><div class='detail'><a class='sblue' href='javascript:void(0)' onclick='wenben(" +
            data[i].code +
            ")'>简介 </a></div></div>";
    }
    htm += "</div>";
    $C("resultlist").innerHTML = htm; //countrylist
    // $(".auScroll").scrollBar();
}

function setCountryBounds(xmin, ymin, xmax, ymax, code) {
    map.fitBounds([
        [xmin, ymin],
        [xmax, ymax],
    ]);

    if (map.getZoom() > 12) map.setZoom(12);

    region.addBoundary(code, null, true);
}

