/**
 * Created by Julian on 12/17/2014.
 */
var Handshake = require("handshake-webrtc");
var Utils = require("yutils");
var Protocol = require("./protocol.js");
var MESSAGE_TYPE = require("./MESSAGE_TYPE.js");

/**
 * This is usually only relevant for the first node of the network (as it cannot connect to any other node)
 * @type {number}
 */
var BOOTSTRAP_TIMEOUT = 60000; // In Millis (1 Min)

// PARAMS - can be overwritten in the init function
var DELTA_T = 5000; // In Millis
var c = 10;
var l = 5;

var partialView = [];

/**
 * Helper
 * @param peer
 * @returns {Function}
 */
function addToPartialView(peer) {
    return function () {
        partialView.push({peer: peer, age: 0, address: peer.address});
    }
}

// =================================
// P R O T O C O L
// =================================

function active(){
    var oldest, rand;
    if (partialView.length > 0) {
        partialView = Protocol.increaseAge(partialView);
        oldest = Protocol.oldest(partialView);
        rand = Protocol.sample(partialView, oldest, l-1);
        rand.push({age:0, address: Handshake.address()});

        oldest.send(MESSAGE_TYPE.EXCHANGE, Protocol.stringify(rand));
    }

}

function passive() {

}

// =================================
// A P I
// =================================

/**
 * Cyclon p2p
 * @type {Object}
 */
var Cyclon = {
    broadcast: function (msg) {
        for(var i = 0; i < partialView.length; i++) {
            partialView[i].peer.send(msg);
        }
    }
};

/**
 * Must be called once to bootstrap CYCLON
 * @param options
 * {
 *      delta_t: {Number}
 *      c: {Number} > l
 *      l: {Number} < c
 * }
 * @param onOffer {function}
 * @returns {Function}
 */
exports.bootstrap = function(options, onOffer){
    Utils.assertLength(arguments, 2);
    if (Utils.isDefined(options)) {
        DELTA_T = options.delta_t || DELTA_T;
        c = options.c || c;
        l = options.l || l;
    }
    if (l > c) throw new Error("Cyclon: {l} must be smaller than {c}!");

    partialView = []; // reset

    var peer = Handshake.createOffer(onOffer);
    peer.onopen(addToPartialView(peer));

    var timeout = setTimeout(function () {
        console.log("Cyclon: not bootstraped");
        //TODO do more meaningful stuff
    }, BOOTSTRAP_TIMEOUT);

    setInterval(active, DELTA_T);

    /**
     *
     */
    return function (answer) {
        clearTimeout(timeout);
        Handshake.handleAnswer(peer, answer);
    };
};

exports.Cyclon = Cyclon;