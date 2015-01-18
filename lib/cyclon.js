/**
 * Created by julian on 18/01/15.
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
var c = 4;
var l = 3;

/**
 *
 * @param options {Object}
 * @constructor
 */
function Cyclon(options) {
    EventEmitter.call(this);

    // This is not a canonical function! Not defined in the interface!!
    this.address = Handshake.address();

    this._readyCallbacks = [];

    if (Utils.isDefined(options)) {
        this.delta_t = options.delta_t || delta_t;
        this.c = options.c || c;
        this.l = options.l || l;
    } else {
        this.delta_t = delta_t;
        this.c = c;
        this.l = l;
    }

    this.partialView = [];
}
Utils.inherit(Cyclon, EventEmitter);

/**
 * +++ A L I C E +++
 *
 * Starts the Handshaking. This must be done once to connect to the network. {launch} takes a callback
 * as parameter that gets called when the ICE-Candidates are gathered.
 * The {offer} that is created must be transmitted to the other peer (How this is done is out of the scope
 * of this library) in order to initiate the handshake.
 * @param onOffer {function} (offer {String})
 */
Cyclon.prototype.launch = function (onOffer) {
    Utils.assertLength(arguments, 1);

    // make sure that we only request once!
    if (this.isReady) throw new Error("Cannot launch Cyclon twice!");

    var self = this,
        peer = Handshake.createOffer(onOffer);
    peer.onopen(function () {
        var readyCallbacks = self._readyCallbacks, i = 0, L = readyCallbacks.length;
        self.isReady = true;
        self.partialView[0].address = peer.address;
        for (;i<L;i++) {
            readyCallbacks[i].call(self);
        }
        shuffle(self);
    });
    this.partialView.push({
        address: 'dummy', // this will be filled in 'onopen' !!!
        age: 0,
        peer: peer
    });
    peer.onmessage(handleMessage(this));
    peer.ondisconnect(handleDisconnect(this, peer));

};

/**
 * +++ A L I C E +++
 *
 * This is the final handshake-function that gets called after an answer is received
 * @param answer {String} remote answer
 */
Cyclon.prototype.handshake = function(answer){
    Utils.assertLength(arguments, 1);

    if (this.partialView.length !== 1 || this.partialView[0].address !== 'dummy' ) {
        throw new Error('Cyclon must be launched before it can handshake!');
    }

    Handshake.handleAnswer(this.partialView[0].peer, answer);
};

/**
 * +++ B O B +++
 *
 * Upon receiving an offer from {launch} through the signaling service the peer creates a fitting answer.
 * This answer is propagated to the application with a callback that must be provided to this function.
 * The answer must be send back to the communication initiator.
 * @param onAnswer {function} (answer {String})
 */
Cyclon.prototype.answer = function (offer, onAnswer) {
    Utils.assertLength(arguments, 2);

    var peer = Handshake.createAnswer(offer, onAnswer), self = this;
    peer.onmessage(handleMessage(this));
    peer.onopen(function () {
        // TODO figure out if this is valid! as now the partialView might sometimes
        // TODO exceed the maximum size of 'c' (c+1)
        // TODO This issue fixes itself in the next shuffle iteration as it will align itself
        self.partialView.push({
            address: peer.address,
            peer: peer,
            age: 0
        });
        console.log('on open ', self.partialView);
        if (not(self.isReady)) {
            var readyCallbacks = self._readyCallbacks, i = 0, L = readyCallbacks.length;
            self.isReady = true;
            for (;i<L;i++) {
                readyCallbacks[i].call(self);
            }
            shuffle(self);
        }
    });
    peer.ondisconnect(handleDisconnect(this, peer));
};

/**
 * Peer-Sampling-Service-function. When provided with a parameter n, a given number of randomly
 * sampled peers is returned, otherwise the whole PartialView of the RPS is returned.
 * @param n {Number}
 */
Cyclon.prototype.getPeers = function(n){

    // handle the 'launch' case in which the partial view is used to carry the first peer object over to
    // the 'handshake' function.
    if (this.partialView.length === 1 && this.partialView[0].address === 'dummy') {
        return [];
    }

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
        this._readyCallbacks.push(callback);
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
            console.log('oldest:', Q);
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

/**
 * Handle incoming messages
 * @param cyclon
 * @returns {Function}
 */
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
 *
 * @param cyclon
 * @param peer
 */
function handleDisconnect(cyclon, peer) {
    //TODO IMPLEMENT!
    return function () {
        console.warn('DISCONNECT FROM ', peer);
        Protocol.delete(cyclon.partialView,peer);
    }
}

/**
 *
 * @type {Object} {
 *      address1: 0,
 *      address2: 0,
 *      ...
 * }
 */
var pendingConnections = { };

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
            peer = Handshake.getPeer(current.address);
            if (peer === null) {
                if (not(current.address in pendingConnections)) {
                    pendingConnections[current.address] = 0;
                    console.log('pending? ', pendingConnections);
                    current.peer = sender.attemptToConnect(current.address);
                    current.peer.oncannotfindpeer(onCannotFindPeer(cyclon,current));
                    current.peer.ondisconnect(handleDisconnect(cyclon, current.peer));
                    current.peer.onopen(function () {
                        delete(pendingConnections[current.address]);
                        console.log('yay open!', current.address);
                    });
                }
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
        console.error('could not connect to node {' + node.address + '}');
        delete(pendingConnections[node.address]);
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