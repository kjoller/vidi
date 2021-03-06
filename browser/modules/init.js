/**
 * @fileoverview Description of file, its uses and information
 * about its dependencies.
 */

'use strict';

var cloud;
var baseLayer;
var meta;
var setting;
var state;
var anchor;
var infoClick;
var search;
var bindEvent;
var draw;
var print;
var advancedInfo;
var pushState;
var extensions;
module.exports = {
    set: function (o) {
        cloud = o.cloud;
        baseLayer = o.baseLayer;
        meta = o.meta;
        setting = o.setting;
        state = o.state;
        anchor = o.anchor;
        infoClick = o.infoClick;
        search = o.search;
        bindEvent = o.bindEvent;
        draw = o.draw;
        print = o.print;
        pushState = o.pushState;
        advancedInfo = o.advancedInfo;
        extensions = o.extensions;
        return this;
    },
    init: function () {
        bindEvent.init();
        meta.init();
        baseLayer.init();
        setting.init();
        state.init();
        infoClick.init();
        search.init();
        draw.init();
        advancedInfo.init();
        print.init();

        var moveEndCallBack = function () {
            pushState.init();
        };
        cloud.on("dragend", moveEndCallBack);
        cloud.on("moveend", moveEndCallBack);
        $.material.init();

        touchScroll(".tab-pane");
        touchScroll("#info-modal-body-wrapper");
    }
};