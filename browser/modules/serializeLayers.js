var cloud;
module.exports = module.exports = {
    set: function (o) {
        cloud = o.cloud;
        return this;
    },
    init: function (str) {

    },
    serialize: function(filters){
        var e = _encodeLayers(cloud.map);
        $.each(e, function (i, v) {
            if (typeof v.geoJson !== "undefined") {
                // Loop backwards
                for (var key = v.geoJson.features.length -1 ; key > -1 ; key--) {
                    if (filters[v.geoJson.features[key]._vidi_type]) {
                        v.geoJson.features.splice(key, 1);
                    }
                }
            }
        });
        return e;
    }
};

var _encodeLayers = function (map) {
    var enc = [],
        vectors = [],
        layer,
        i;

    var layers = _getLayers(map);
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];
        if (layer instanceof L.TileLayer.WMS) {
            enc.push(_encoders.layers.tilelayerwms.call(this, layer));
        } else if (L.mapbox && layer instanceof L.mapbox.TileLayer) {
            enc.push(_encoders.layers.tilelayermapbox.call(this, layer));
        } else if (layer instanceof L.TileLayer) {
            enc.push(_encoders.layers.tilelayer.call(this, layer));
        } else if (layer instanceof L.ImageOverlay) {
            enc.push(_encoders.layers.image.call(this, layer));
        } else if (layer instanceof L.Marker || (layer instanceof L.Path && layer.toGeoJSON)) {
            vectors.push(layer);
        }
    }
    if (vectors.length) {
        enc.push(_encoders.layers.vector.call(this, vectors));
    }
    return enc;
};
var _encoders = {
    layers: {
        httprequest: function (layer) {
            var baseUrl = layer._url;

            if (baseUrl.indexOf('{s}') !== -1) {
                baseUrl = baseUrl.replace('{s}', layer.options.subdomains[0]);
            }
            baseUrl = _getAbsoluteUrl(baseUrl);

            return {
                baseURL: baseUrl,
                opacity: layer.options.opacity
            };
        },
        tilelayer: function (layer) {
            var enc = _encoders.layers.httprequest.call(this, layer),
                baseUrl = layer._url.substring(0, layer._url.indexOf('{z}')),
                resolutions = [],
                zoom, split, layerName;

            // If using multiple subdomains, replace the subdomain placeholder
            if (baseUrl.indexOf('{s}') !== -1) {
                baseUrl = baseUrl.replace('{s}', layer.options.subdomains[0]);
            }

            for (zoom = 0; zoom <= layer.options.maxZoom; ++zoom) {
                resolutions.push(L.print.Provider.MAX_RESOLUTION / Math.pow(2, zoom));
            }


            if (layer.options.tms) {
                split = baseUrl.split("/");
                layerName = split[split.length - 2];
                split.splice(-3);
                baseUrl = split.join("/") + "/";
                return L.extend(enc, {
                    type: 'TMS',
                    baseURL: baseUrl,
                    layer: layerName,
                    format: 'png',
                    tileSize: [layer.options.tileSize, layer.options.tileSize],
                    maxExtent: L.print.Provider.MAX_EXTENT,
                    resolutions: resolutions,
                    tileOrigin: {x: L.print.Provider.MAX_EXTENT[0], y: L.print.Provider.MAX_EXTENT[0]},
                    singleTile: false
                });
            } else {
                return L.extend(enc, {
                    // XYZ layer type would be a better fit but is not supported in mapfish plugin for GeoServer
                    // See https://github.com/mapfish/mapfish-print/pull/38
                    type: 'OSM',
                    baseURL: baseUrl,
                    extension: 'png',
                    tileSize: [layer.options.tileSize, layer.options.tileSize],
                    maxExtent: L.print.Provider.MAX_EXTENT,
                    resolutions: resolutions,
                    tileOrigin: {x: L.print.Provider.MAX_EXTENT[0], y: L.print.Provider.MAX_EXTENT[0]},
                    singleTile: false
                });
            }
        },
        tilelayerwms: function (layer) {
            var enc = _encoders.layers.httprequest.call(this, layer),
                layerOpts = layer.options,
                p;

            L.extend(enc, {
                type: 'WMS',
                layers: [layerOpts.layers].join(',').split(',').filter(function (x) {
                    return x !== "";
                }), //filter out empty strings from the array
                format: layerOpts.format,
                styles: [layerOpts.styles].join(',').split(',').filter(function (x) {
                    return x !== "";
                }),

                singleTile: false
            });

            for (p in layer.wmsParams) {
                if (layer.wmsParams.hasOwnProperty(p)) {
                    if ('detectretina,format,height,layers,request,service,srs,styles,version,width'.indexOf(p.toLowerCase()) === -1) {
                        if (!enc.customParams) {
                            enc.customParams = {};
                        }
                        enc.customParams[p] = layer.wmsParams[p];
                    }
                }
            }
            return enc;
        },
        tilelayermapbox: function (layer) {
            var resolutions = [], zoom;

            for (zoom = 0; zoom <= layer.options.maxZoom; ++zoom) {
                resolutions.push(L.print.Provider.MAX_RESOLUTION / Math.pow(2, zoom));
            }

            var customParams = {};
            if (typeof layer.options.access_token === 'string' && layer.options.access_token.length > 0) {
                customParams.access_token = layer.options.access_token;
            }

            return {
                // XYZ layer type would be a better fit but is not supported in mapfish plugin for GeoServer
                // See https://github.com/mapfish/mapfish-print/pull/38
                type: 'OSM',
                baseURL: layer.options.tiles[0].substring(0, layer.options.tiles[0].indexOf('{z}')),
                opacity: layer.options.opacity,
                extension: 'png',
                tileSize: [layer.options.tileSize, layer.options.tileSize],
                maxExtent: L.print.Provider.MAX_EXTENT,
                resolutions: resolutions,
                singleTile: false,
                customParams: customParams
            };
        },
        image: function (layer) {
            return {
                type: 'Image',
                opacity: layer.options.opacity,
                name: 'image',
                baseURL: _getAbsoluteUrl(layer._url),
                extent: _projectBounds(L.print.Provider.SRS, layer._bounds)
            };
        },
        vector: function (features) {
            var encFeatures = [],
                encStyles = {},
                opacity,
                feature,
                style,
                dictKey,
                dictItem = {},
                styleDict = {},
                styleName,
                nextId = 1,
                featureGeoJson,
                i, l;

            for (i = 0, l = features.length; i < l; i++) {
                feature = features[i];

                if (feature instanceof L.Marker) {
                    var icon = feature.options.icon,
                        iconUrl = icon.options.iconUrl || L.Icon.Default.imagePath + '/marker-icon.png',
                        iconSize = L.Util.isArray(icon.options.iconSize) ? new L.Point(icon.options.iconSize[0], icon.options.iconSize[1]) : icon.options.iconSize,
                        iconAnchor = L.Util.isArray(icon.options.iconAnchor) ? new L.Point(icon.options.iconAnchor[0], icon.options.iconAnchor[1]) : icon.options.iconAnchor,
                        scaleFactor = (72 / L.print.Provider.DPI); // TODO set dpi

                    style = {
                        externalGraphic: _getAbsoluteUrl(iconUrl),
                        graphicWidth: (iconSize.x / scaleFactor),
                        graphicHeight: (iconSize.y / scaleFactor),
                        graphicXOffset: (-iconAnchor.x / scaleFactor),
                        graphicYOffset: (-iconAnchor.y / scaleFactor)
                    };
                } else {
                    style = _extractFeatureStyle(feature);
                }

                dictKey = JSON.stringify(style);
                dictItem = styleDict[dictKey];
                if (dictItem) {
                    styleName = dictItem;
                } else {
                    styleDict[dictKey] = styleName = nextId++;
                    encStyles[styleName] = style;
                }

                featureGeoJson = (feature instanceof L.Circle) ? _circleGeoJSON(feature) : feature.toGeoJSON();
                featureGeoJson.geometry.coordinates = _projectCoords(L.print.Provider.SRS, featureGeoJson.geometry.coordinates);
                //featureGeoJson.properties._leaflet_style = styleName;
                featureGeoJson.type = "Feature";
                featureGeoJson.style = style;
                featureGeoJson._vidi_type = feature._vidi_type;

                // All markers will use the same opacity as the first marker found
                if (opacity === null) {
                    opacity = feature.options.opacity || 1.0;
                }

                encFeatures.push(featureGeoJson);
            }

            return {
                type: 'Vector',
                styles: encStyles,
                opacity: opacity,
                styleProperty: '_leaflet_style',
                geoJson: {
                    type: 'FeatureCollection',
                    features: encFeatures
                }
            };
        }
    }
};

var _getLayers = function (map) {
    var markers = [],
        vectors = [],
        tiles = [],
        imageOverlays = [],
        imageNodes,
        pathNodes,
        id;

    for (id in map._layers) {
        if (map._layers.hasOwnProperty(id)) {

            if (!map._layers.hasOwnProperty(id)) {
                continue;
            }

            var lyr = map._layers[id];

            if (lyr instanceof L.TileLayer.WMS || lyr instanceof L.TileLayer) {
                tiles.push(lyr);
            } else if (lyr instanceof L.ImageOverlay) {
                imageOverlays.push(lyr);
            } else if (lyr instanceof L.Marker) {
                markers.push(lyr);
            } else if (lyr instanceof L.Path && lyr.toGeoJSON) {
                vectors.push(lyr);
            }
        }
    }
    markers.sort(function (a, b) {
        return a._icon.style.zIndex - b._icon.style.zIndex;
    });

    var i;
    // Layers with equal zIndexes can cause problems with mapfish print
    for (i = 1; i < markers.length; i++) {
        if (markers[i]._icon.style.zIndex <= markers[i - 1]._icon.style.zIndex) {
            markers[i]._icon.style.zIndex = markers[i - 1].icons.style.zIndex + 1;
        }
    }

    tiles.sort(function (a, b) {
        return a._container.style.zIndex - b._container.style.zIndex;
    });

    // Layers with equal zIndexes can cause problems with mapfish print
    for (i = 1; i < tiles.length; i++) {
        if (tiles[i]._container.style.zIndex <= tiles[i - 1]._container.style.zIndex) {
            tiles[i]._container.style.zIndex = tiles[i - 1]._container.style.zIndex + 1;
        }
    }

    imageNodes = [].slice.call(this, map._panes.overlayPane.childNodes);
    imageOverlays.sort(function (a, b) {
        return imageNodes.indexOf(a._image) - imageNodes.indexOf(b._image);
    });

    if (map._pathRoot) {
        pathNodes = [].slice.call(this, map._pathRoot.childNodes);
        vectors.sort(function (a, b) {
            return pathNodes.indexOf(a._container) - pathNodes.indexOf(b._container);
        });
    }

    return tiles.concat(vectors).concat(imageOverlays).concat(markers);
};

var _getAbsoluteUrl = function (url) {
    var a;

    if (L.Browser.ie) {
        a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.href = url;
        document.body.removeChild(a);
    } else {
        a = document.createElement('a');
        a.href = url;
    }
    return a.href;
};

var _circleGeoJSON = function (circle) {
    var projection = circle._map.options.crs.projection;
    var earthRadius = 1, i;

    if (projection === L.Projection.SphericalMercator) {
        earthRadius = 6378137;
    } else if (projection === L.Projection.Mercator) {
        earthRadius = projection.R_MAJOR;
    }
    var cnt = projection.project(circle.getLatLng());
    var scale = 1.0 / Math.cos(circle.getLatLng().lat * Math.PI / 180.0);
    var points = [];
    for (i = 0; i < 64; i++) {
        var radian = i * 2.0 * Math.PI / 64.0;
        var shift = L.point(Math.cos(radian), Math.sin(radian));
        points.push(projection.unproject(cnt.add(shift.multiplyBy(circle.getRadius() * scale / earthRadius))));
    }
    return L.polygon(points).toGeoJSON();
};

var _extractFeatureStyle = function (feature) {
    var options = feature.options;

    return {
        color: options.color,
        stroke: options.stroke,
        strokeColor: options.color,
        strokeWidth: options.weight,
        weight: options.weight,
        strokeOpacity: options.opacity,
        strokeLinecap: 'round',
        fill: options.fill,
        fillColor: options.fillColor || options.color,
        fillOpacity: options.fillOpacity,
        dashArray: options.dashArray
    };
};

var _projectCoords = function (crs, coords) {
    var crsKey = crs.toUpperCase().replace(':', ''),
        crsClass = L.CRS[crsKey];

    if (!crsClass) {
        throw 'Unsupported coordinate reference system: ' + crs;
    }

    //return _project(crsClass, coords);
    return coords;
};

var _project = function (crsClass, coords) {
    var projected,
        pt,
        i, l;

    if (typeof coords[0] === 'number') {
        coords = new L.LatLng(coords[1], coords[0]);
    }

    if (coords instanceof L.LatLng) {
        pt = crsClass.project(coords);
        return [pt.x, pt.y];
    } else {
        projected = [];
        for (i = 0, l = coords.length; i < l; i++) {
            projected.push(_project(crsClass, coords[i]));
        }
        return projected;
    }
};