/**
 * Remark:
 * The API for this class is defined in the library {p2pnetwork} - {interface/membership.js}
 * Created by Julian on 12/18/2014.
 */
var EventEmitter = require('events').EventEmitter;
var Utils = require("yutils");
var _ = require("underscore");
var Handshake = require("handshake-webrtc");
var Protocol = require("./protocol");
var MESSAGE_TYPE = require("./MESSAGE_TYPE");

/********************************************************************
 *                          A P I                                   *
 *  The code below is the implementation of the {membership}        *
 *  Interface that is defined in the library {p2pnetwork}           *
 *  https://github.com/justayak/network                             *
 ********************************************************************/

var delta_t = 1000; // 10 sec
var c = 10;
var l = 5;

/**
 * Cyclon
 * @constructor
 */
function Cyclon(options) {
    EventEmitter.call(this);

    // This is not a canonical function! Not defined in
    // the interface!!
    this.address = Handshake.address();

    this.isReady = false;
    this.readyCallbacks = [];

    /**
     * @type {Array} [
     *      { address: "a", age:2, peer:{WebRTCInterface} },
     *      { address: "b", age:4, peer:{WebRTCInterface} }
     * ]
     */
    this.partialView = [];
    if (Utils.isDefined(options)) {
        this.delta_t = options.delta_t || delta_t;
        this.c = options.c || c;
        this.l = options.l || l;
    } else {
        this.delta_t = delta_t;
        this.c = c;
        this.l = l;
    }
    this.peer = null;

};
Utils.inherit(Cyclon, EventEmitter);

/**
 * Starts the Handshaking. This must be done once to connect to the network. {launch} takes a callback
 * as parameter that gets called when the ICE-Candidates are gathered.
 * The {offer} that is created must be transmitted to the other peer (How this is done is out of the scope
 * of this library) in order to initiate the handshake.
 * @param onOffer {function} (offer {String})
 */
Cyclon.prototype.launch = function (onOffer) {
    var self = this;
    if (this.isReady) throw new Error("Cannot launch Cyclon twice!");
    Utils.assertLength(arguments, 1);
    this.peer = Handshake.createOffer(onOffer);

    this.peer.onopen(function () {
        var peer = self.peer;
        self.isReady = true;
        var i = 0, L = self.readyCallbacks.length;
        for(;i<L;i++) {
            self.readyCallbacks[i].call(self);
        }

        // put the peer into our partialView
        self.partialView.push({
            address: peer.address,
            age: 0,
            peer: peer
        });
        // start shuffle
        shuffle(self);
    });
    this.peer.onmessage(handleMessage(this));
};

/**
 * This is the final handshake-function that gets called after an answer is received
 * @param answer {String} remote answer
 */
Cyclon.prototype.handshake = function(answer){
    Utils.assertLength(arguments, 1);
    Handshake.handleAnswer(this.peer, answer);
};

/**
 * Upon receiving an offer from {launch} through the signaling service the peer creates a fitting answer.
 * This answer is propagated to the application with a callback that must be provided to this function.
 * The answer must be send back to the communication initiator.
 * @param onAnswer {function} (answer {String})
 */
Cyclon.prototype.answer = function (offer, onAnswer) {
    Utils.assertLength(arguments, 2);
    this.peer = Handshake.createAnswer(offer, onAnswer);
    this.peer.onmessage(handleMessage(this));
};

/**
 * Peer-Sampling-Service-function. When provided with a parameter n, a given number of randomly
 * sampled peers is returned, otherwise the whole PartialView of the RPS is returned.
 * @param n {Number}
 */
Cyclon.prototype.getPeers = function(n){
    if (Utils.isDefined(n)) {
        return _.pluck(Utils.sample(this.partialView, n), "peer");
    } else {
        return _.pluck(this.partialView, "peer");
    }
};

/**
 * This function checks if the membership protocol is already connected to the network and is "ready" or if
 * the handshake is still pending.
 * The parameter is a callback that gets called as soon as the peer is connected to the network.
 * @param callback {function}
 */
Cyclon.prototype.ready = function (callback) {
    if (this.isReady){
        callback.call(this);
    } else {
        this.readyCallbacks.push(callback);
    }
};

exports.Class = Cyclon;

/********************************************************************
 *                       C Y C L O N  F U N C                       *
 ********************************************************************/

/**
 * Each peer knows a small, continuously changing set of other peers and
 * occasionally contacts a random one to exchange some of their neighbors
 */
function shuffle(cyclon) {
    setInterval(function () {
        var Q, randomNeighbors, partialView = cyclon.partialView;
        if (partialView.length > 0) {

            Q = Protocol.oldest(partialView);
            randomNeighbors = Protocol.clean(
                Protocol.sample(partialView,Q,l-1)
            );
            randomNeighbors.push([{address:cyclon.address, age:0}]);

            // send to neighbor
            Q.peer.send({type: MESSAGE_TYPE.SHUFFLE, view:partialView});

        }
    }, cyclon.delta_t);
}

function receiveShuffle(cyclon, P, view) {

}

/********************************************************************
 *                       H E L P E R S                              *
 ********************************************************************/

function handleMessage(cyclon) {
    return function (msg) {
        switch (msg.type) {
            case MESSAGE_TYPE.SHUFFLE:
                //receiveShuffle(cyclon, )
                break;
            case MESSAGE_TYPE.SHUFFLE_RESPONSE:
                break;
        }
    };
}