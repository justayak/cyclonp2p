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

var delta_t = 4000; // 10 sec
var c = 5;
var l = 3;

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

    this._pendingSendView = null;

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
    this.peer.verbose = false;
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
    this.peer.verbose = false;
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
 * +++ A L I C E +++
 * Each peer knows a small, continuously changing set of other peers and
 * occasionally contacts a random one to exchange some of their neighbors
 */
function shuffle(cyclon) {
    setInterval(function () {
        var Q, randomNeighbors, partialView = cyclon.partialView, l = cyclon.l, c = cyclon.c;
        if (partialView.length > 0) {

            // increase age of all neighbors
            partialView = Protocol.increaseAge(partialView);

            // select oldest node + l-1 random ones
            Q = Protocol.oldest(partialView);
            randomNeighbors = Protocol.clean(
                Protocol.sample(partialView,Q,l-1)
            );

            randomNeighbors.push({address:cyclon.address, age:0});

            // send to neighbor
            Q.peer.send({type: MESSAGE_TYPE.SHUFFLE, view:randomNeighbors, sender: cyclon.address});
            cyclon._pendingSendView = randomNeighbors; // primitive...

        }
    }, cyclon.delta_t);
}

/**
 * +++ A L I C E +++
 * @param cyclon
 * @param Q
 * @param view
 */
function receiveShuffleResponse(cyclon, Q, view) {
    if (cyclon._pendingSendView === null) throw new Error('Out-of-order!');
    var partialView = cyclon.partialView, l = cyclon.l, c = cyclon.c;

    // we safe the subset that we sent to Q previously
    var sentViewToQ = Protocol.exclude(cyclon._pendingSendView, cyclon.address);
    view = Protocol.exclude(view, cyclon.address);
    view = Protocol.exclude(view, partialView);
    merge = Protocol.merge(partialView, view, sentViewToQ, c, cyclon.address);
    putPartialView(cyclon, merge, Q);
    cyclon._pendingSendView = null;
}

/**
 * +++ B O B +++
 * @param cyclon local cyclon object
 * @param P remote peer object
 * @param view [Nodes] that P send
 */
function receiveShuffle(cyclon, P, view) {
    var partialView = cyclon.partialView, l = cyclon.l, c = cyclon.c;
    var randomNeighbors = Protocol.clean(
        Protocol.sample(partialView, l)
    );
    P.send({type:MESSAGE_TYPE.SHUFFLE_RESPONSE, view:randomNeighbors,sender:cyclon.address});
    var merge = Protocol.merge(partialView, view, randomNeighbors, c, cyclon.address);
    putPartialView(cyclon, merge, P);
}

/********************************************************************
 *                       H E L P E R S                              *
 ********************************************************************/

function handleMessage(cyclon) {
    return function (msg) {
        var P,Q;
        switch (msg.type) {
            case MESSAGE_TYPE.SHUFFLE:
                /* =============================================== *
                 *  S H U F F L E
                 * =============================================== */
                P = Handshake.getPeer(msg.sender);
                receiveShuffle(cyclon, P, msg.view);
                break;
            case MESSAGE_TYPE.SHUFFLE_RESPONSE:
                /* =============================================== *
                 *  S H U F F L E _ R E S P O N S E
                 * =============================================== */
                Q = Handshake.getPeer(msg.sender);
                receiveShuffleResponse(cyclon, Q, msg.view);
                break;
        }
    };
}

function not(booleanValue) {
    return !booleanValue;
}

/**
 * This function must be called from both P and Q to set up their new partial views.
 * When there is no direct connection between two nodes we must hoist the connection
 * over the intermediate node
 * @param merge {result:[Nodes], removed:[Nodes]} list of nodes
 * @param sender {Node} the sender of a subset of the partial view
 */
function putPartialView(cyclon, merge, sender) {
    var partialView = merge.result, peer;
    var i = 0, L = partialView.length, current;
    for(;i<L;i++) {
        current = partialView[i];
        if (not('peer' in current)) {
            // First, try to find the peer locally
            peer = Handshake.getPeer(sender.address);
            if (peer === null) {
                current.peer = sender.attemptToConnect(current.address);
                current.peer.oncannotfindpeer(onCannotFindPeer(cyclon,current));
            } else {
                current.peer = peer;
            }

        }
    }
    cyclon.partialView = partialView;

    // we must get rid of all those nodes that got removed
    disconnect(merge.removed);

}

function onCannotFindPeer(cyclon, node) {
    return function () {
        cyclon.partialView = Protocol.delete(cyclon.partialView, node);
    }
}

/**
 * disconnect all nodes that are in the list
 * @param list
 */
function disconnect(list) {
    var i = 0, L = list.length;
    for(;i<L;i++) {
        //list[i].peer.disconnect();
    }
}