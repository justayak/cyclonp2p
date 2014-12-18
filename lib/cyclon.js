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
var DELTA_T = 10000; // In Millis
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

/**
 * Tries to connect to all elements in the view (if a connection is not yet established)
 * @param view {Array}
 * @param peer {Handshake.Peer}
 * @param callback {function}
 */
function connectToAll(view, peer, callback) {
    var newConnections = 0, i = 0, L = view.length, p, current;
    function check() {
        newConnections -= 1;
        if (newConnections === 0) {
            callback.call(peer);
        }
    }
    for(;i<L;i++) {
        current = view[i];
        if (!("peer" in current)) {
            newConnections += 1;
            p = peer.attemptToConnect(current.address);
            current.peer = p;
            p.onopen(check);
            p.oncannotfindpeer(check); // TODO Error handling
        }
    }
}

// =================================
// S H U F F L E  P R O T O C O L
// =================================

var currentSubset = null;

/**
 * A C T I V E (#1)
 */
function shuffle(){
    var oldest, rand;
    if (partialView.length > 0) {
        partialView = Protocol.increaseAge(partialView);
        oldest = Protocol.oldest(partialView);
        rand = Protocol.sample(partialView, oldest, l-1);
        rand.push({age:0, address: Handshake.address()});
        currentSubset = rand;
        oldest.send({type: MESSAGE_TYPE.SHUFFLE, payload:Protocol.stringify(rand)});
    }
}

/**
 * A C T I V E (#2)
 */
function shuffleResponse(peer, subset) {
    if (currentSubset === null) throw new Error("Out of order!");

    var merge = Protocol.merge(partialView,currentSubset,subset,c);

    connectToAll(merge.result, peer, function () {
        partialView = merge.result;
    });

    currentSubset = null;
}

/**
 * P A S S I V E
 * @param peer
 * @param subset
 */
function passiveShuffle(peer, subset) {
    var mySubset = Protocol.sample(partialView, [], l);
    peer.send({type: MESSAGE_TYPE.SHUFFLE_RESPONSE, payload:Protocol.stringify(mySubset)});

    var merge = Protocol.merge(partialView,subset,mySubset,c);

    connectToAll(merge.result, peer, function () {
        partialView = merge.result;
    });

    //TODO handle the elements that got removed!
}

// =================================
// M E S S A G E  H A N D L I N G
// =================================

Handshake.onmessage(function(peer, message){
    message = Utils.isString(message) ? JSON.parse(message) : message;
    switch (message.type) {
        case MESSAGE_TYPE.SHUFFLE:
            passiveShuffle(peer, Protocol.parse(message.payload));
            break;
        case MESSAGE_TYPE.SHUFFLE_RESPONSE:
            shuffleResponse(peer, Protocol.parse(message.payload));
            break;
    }
});

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

exports.Cyclon = Cyclon;

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

    setInterval(shuffle, DELTA_T);

    /**
     *
     */
    return function (answer) {
        clearTimeout(timeout);
        Handshake.handleAnswer(peer, answer);
    };
};