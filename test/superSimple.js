/**
 * Created by Julian on 12/18/2014.
 */
//TODO replace this with jasmine asap!
var Protocol = require("./../lib/protocol.js");

console.log(Protocol.exclude([{address:"a"},{address:"b"},{address:"c"}], ["b","c"]));

console.log("merge:", Protocol.merge(
    [{address:"a", age:2},{address:"b", age:3},{address:"c", age:1}],
    [{address:"a", age:5},{address:"b", age:11},{address:"d",age:2},{address:"e",age:6}],
    [{address:"b", age:3}],
    4
));

console.log("sort: ", Protocol.sort([{address:"a", age:5},{address:"b", age:11},{address:"d",age:2},{address:"e",age:6}]));

console.log("stringify: " + Protocol.stringify({age:3, address: "a", peer: {demo:33, lol: 111, qq: "Hallo welt"}}));