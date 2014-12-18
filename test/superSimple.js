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
    3
));

console.log("sort: ", Protocol.sort([{address:"a", age:5},{address:"b", age:11},{address:"d",age:2},{address:"e",age:6}]));