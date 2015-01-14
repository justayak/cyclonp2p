/**
 * Remark:
 * The API for this class is defined in the library {p2pnetwork} - {interface/membership.js}
 * Created by Julian on 12/18/2014.
 */
var EventEmitter = require('events').EventEmitter;
var Utils = require("yutils");
//var _ = require("underscore");
var Handshake = require("handshake-webrtc");

/********************************************************************
 *                          A P I                                   *
 *  The code below is the implementation of them {membership}       *
 *  Interface that is defined in the library {p2pnetwork}           *
 *  https://github.com/justayak/network                             *
 ********************************************************************/

var delta_t = 10000; // 10 sec
var c = 10;
var l = 5;

/**
 *
 * @constructor
 */
function Cyclon(options) {
    EventEmitter.call(this);
    this.isReady = false;
    this.readyCallbacks = [];

    /**
     *
     * @type {Array}
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
    Utils.assertLength(arguments, 1);
    this.peer = Handshake.createOffer(onOffer);
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
Cyclon.prototype.answer = function (onAnswer) {
    Utils.assertLength(arguments, 1);

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

// TODO implement me!

/********************************************************************
 *                       H E L P E R S                              *
 ********************************************************************/

function addToPartialView(cyclon, peer, callback) {
    cyclon.partialView.push({ peer: peer, age: 0, address: peer.address});
    callback.call(peer);
};