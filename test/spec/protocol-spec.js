/**
 * Created by Julian on 1/14/2015.
 */
var Protocol = require("./../../lib/protocol.js");

describe("init", function () {

    /**
     * [Nodes] = Protocol.exclude([Nodes], [ExclusionItems])
     *
     */
    it("should exclude", function () {
        var result = Protocol.exclude(
            [{address:"a"},{address:"b"},{address:"c"}],
            ["b","c"]);
        expect(result).toEqual([{address:"a"}]);
    });
    it("should exclude objects", function () {
        var result = Protocol.exclude(
            [{address:"a"},{address:"b"},{address:"c"}],
            [{address:"b"},{address:"c"}]);
        expect(result).toEqual([{address:"a"}]);
    });

    it("should sample (2)", function () {
        var result = Protocol.sample([
            {address:"a"},{address:"b"},{address:"c"}],2);
        expect(result.length).toEqual(2);
    });

    it("should sample (3)", function () {
        var result = Protocol.sample([
            {address:"a"},{address:"b"},{address:"c"}],["b","c"],2);
        expect(result.length).toEqual(1);
    });

    /**
     * {result:[Nodes|c],removed:[Nodes]} = Protocol.merge(
     *      partialView [Nodes],
     *      incomingView [Nodes],
     *      sentView \in partialView [Nodes],
     *      c {Number} indicating partialViews maximum size
     * );
     */
    it("should merge correctly", function () {
         var result = Protocol.merge(
             [{address:"a", age:2},{address:"b", age:3},{address:"c", age:1}],
             [{address:"a", age:5},{address:"b", age:11},{address:"d",age:2},{address:"e",age:6}],
             [{address:"b", age:3}],
             4
         );
        //console.log(result);
        expect(result.result).toEqual([
            {address:"a",age:2},
            {address:"c",age:1},
            {address:"d",age:2},
            {address:"e",age:6}
        ]);
        expect(result.removed).toEqual([
            {address:"b",age:3}
        ]);
    });
    it("should merge empty correctly", function () {
        var result = Protocol.merge([], [{address:'a', age:2}],[],4);
        expect(result.result).toEqual([{address:'a', age:2}]);
    });

    /**
     * Sort a list of Nodes by age (descending):
     * [{address:"a",age:1},{address:"c",age:3},...]
     */
    it("should sort correctly", function () {
        var result = Protocol.sort([{address:"a", age:5},{address:"b", age:11},{address:"d",age:2},{address:"e",age:6}]);
        expect(result).toEqual([
            {address:"d",age:2},
            {address:"a",age:5},
            {address:"e",age:6},
            {address:"b",age:11}
        ]);
    });


    it("should parse correctly", function () {
        var list = [
            {address:"a",age:12},
            {address:"c",age:1},
            {address:"d",age:2},
            {address:"b",age:2}
        ];
        var str = Protocol.stringify(list);
        var obj = Protocol.parse(str);
        expect(obj).toEqual(list);
    });

    it("should find the oldest element", function () {
        var list = [
            {address:"a",age:12},
            {address:"c",age:1},
            {address:"d",age:2},
            {address:"b",age:2}
        ];
        var oldest = Protocol.oldest(list);
        expect(oldest).toEqual({address:"a",age:12});
    });

    it("should increase the age", function () {
        var result = Protocol.increaseAge([
            {address:"a",age:12},
            {address:"c",age:1},
            {address:"d",age:2},
            {address:"b",age:2}
        ]);
        expect(result).toEqual([
            {address:"a",age:13},
            {address:"c",age:2},
            {address:"d",age:3},
            {address:"b",age:3}
        ]);
    });

});