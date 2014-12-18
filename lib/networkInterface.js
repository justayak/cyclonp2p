/**
 * Created by Julian on 12/18/2014.
 */


Cyclon.broadcast("blaa");

Cyclon.getPeer().send("qqq");



Scamp.broadcast("qqq");


// ___________

var TYPES = {
    HOPS : 1|0,
    PROBABILITY: 2|0,
    USER_VECTOR: 4|0,
    NAIVE: 8|0
};

var type = TYPES.HOPS & TYPES.PROBABILITY;

Network.init({

});

Network.initNaive({});

Network.initVV({});



Network.broadcast({type: 5, payload: "qqqweeew"});
Network.broadcast("Hello world");

Network.getPeer().send("qqq");

Network.getPeers(n);
//
// type.toRebroacast(message) : bool

function NetworkInterface(){

};

NetworkInterface.prototype.rebroadcast = function (message) {
    return false;
};

Network.onReceive(function () {
   // do stuff
});

Nework.on("receive", function () {

});

// ALICE
Network.launch = function(onOffer){

    //
    var peer = webRTC.createOffer(function() {
        onOffer.call();
    });


    return function (answer) {
        peer.finalHandshake(answer);
    };
};


var handshake = Network.launch(function onOffer(offer){

    WebSocket.sendToServer(offer, function (answer) {

        handshake(answer);

    });

});


// alternative
Network.launch(function(offer){ // only once!

    WebSocket.sendToServer(offer, function (answer) {

        Network.handshake(answer);

    });

});

// only once

// BOB

//   ****           Define functionality    apply def       Membership
// IDE/Editor ->    [BroadcastDef] ->         Network ->      Scamp/Cycon       -> IMP

//                                              broadcast
//                                              membership()
//                                              on("receive", func(..){})

//                                                          launch
//                                                          answer
//                                                          handshake
//                                                          getPeers(n)
//                                                          events (on("...")
//                                                              "offerCreated"
//                                                              "statechange":
//                                                               [
//                                                                "disconnect"
//                                                                "partial"
//                                                                "connect"
//                                                               ]

//                                                                              Dirty Implementation