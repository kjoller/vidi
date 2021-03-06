var express = require('express');
var router = express.Router();
var http = require('http');
var config = require('../../config/config.js').gc2;

router.get('/api/legend/:db', function (req, response) {
    var l = req.query.l, db = req.params.db, url, jsfile;
    url = config.host + "/api/v1/legend/json/" + db + "?l=" + l;
    http.get(url, function (res) {
        var chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });
        res.on("end", function () {
            jsfile = new Buffer.concat(chunks);
            response.header('content-type', 'application/json');
            response.send(jsfile);
        });
    }).on("error", function () {
        callback(null);
    });

});
module.exports = router;