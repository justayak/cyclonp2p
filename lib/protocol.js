/**
 * Created by Julian on 12/17/2014.
 */

var Utils = require("yutils");
var _ = require('underscore');

/**
 *
 * @param partialView
 * @returns {*}
 */
exports.increaseAge = function (partialView) {
    var i = 0, L = partialView.length;
    for (; i < L; i++) {
        partialView[i].age += 1;
    }
    return partialView;
};

/**
 *
 * @param partialView
 * @returns {Handshake.Peer}
 */
exports.oldest = function (partialView) {
    var i = 0, L = partialView.length;
    var oldest = {
        age:-1
    };
    for (; i < L; i++) {
        current = partialView[i];
        if (current.age > oldest.age) {
            oldest = current;
        }
    }
    return oldest;
};

/**
 * TODO: improve performance of this function
 * @param partialView: local partial view
 * @param otherList: subset sent from the other node
 * @param subset: the subset we are sending to the other node
 * @param c {Number} delimiter
 */
exports.merge = function (partialView, otherList, subset, c, ownAddress) {
    Utils.assertLength(arguments,5);

    otherList = deleteElement(otherList, ownAddress);
    subset = deleteElement(subset, ownAddress);

    otherList = exclude(otherList, partialView);
    otherList = exclude(otherList, subset);
    partialView = exclude(partialView, subset);
    var result = [], removed = [];
    var i = 0, L = Math.min(c, otherList.length + partialView.length + subset.length);
    for (; i < partialView.length; i++) {
        result.push(partialView[i]);
    }

    otherList = sort(otherList);
    for (; i < L; i++) {
        if (otherList.length === 0) break;
        result.push(otherList.shift());
    }

    subset = sort(subset);
    for (; i < L; i++) {
        if (subset.length === 0) break;
        result.push(subset.shift());
    }

    for (i = 0, L = otherList.length; i < L; i++) {
        removed.push(otherList[i]);
    }

    for (i = 0, L = subset.length; i < L; i++) {
        removed.push(subset[i]);
    }

    if(removed.length > 0) {
        console.log('removed:' , removed);
    }

    return {
        result: result,
        removed: removed
    };
};

/**
 *
 * @param partialView
 * @param excludedPeer
 * @param L
 * @returns {Array}
 */
exports.sample = function (partialView, excludedPeer, l) {
    if (arguments.length === 2) {
        // method overloading is crazy ugly...
        l = excludedPeer;
        excludedPeer = [];
    }
    if (partialView.length < 1) return [];
    var subset = exclude(partialView, excludedPeer);
    return Utils.sample(subset, l);
};

/**
 * reduces a view to its minimum so that it can be
 * transformed easier
 * @param view
 */
exports.clean = function (view) {
    var i = 0, L = view.length, current;
    var result = [];
    for (; i < L; i++) {
        current = view[i];
        result.push({
            address: current.address,
            age: current.age
        });
    }
    return result;
};

var deleteElement = exports.delete = function (partialView, node) {
    var i = 0, L = partialView.length, current, nothing = true;
    node = Utils.isString(node) ? node : node.address;
    for (; i < L; i++) {
        current = partialView[i];
        if (current.address === node) {
            nothing = false;
            break;
        }
    }
    if (nothing) {
        return partialView;
    } else {
        return Utils.deletePosition(partialView, i);
    }
};

/**
 * Exclude elements from a list
 * @param list
 * @param excluded
 * @returns {Array}
 */
var exclude = exports.exclude = function (list, excluded) {
    var excludedLookup = {}, i, L, current, result = [];
    if (Array.isArray(excluded)) {
        i = 0, L = excluded.length;
        // LIST
        for (; i < L; i++) {
            current = excluded[i];
            if (Utils.isString(current)) {
                excludedLookup[current] = true;
            } else {
                excludedLookup[current.address] = true;
            }
        }
    } else {
        // SINGLE
        if (Utils.isString(excluded)) {
            excludedLookup[excluded] = true;
        } else {
            excludedLookup[excluded.address] = true;
        }
    }
    for (i = 0, L = list.length; i < L; i++) {
        current = list[i];
        if (!(current.address in excludedLookup)) {
            result.push(current);
        }
    }
    return result;
};

exports.stringify = function (partialView) {
    function replacer(key, value) {
        if (key === "peer") return undefined;
        else return value;
    }

    return JSON.stringify(partialView, replacer);
};

exports.parse = function (str) {
    if (Utils.isString(str)) {
        return JSON.parse(str);
    } else {
        return str;
    }
};

// ===============================
// H E L P E R  F U N C T I O N S
// ===============================
function sort(partialView) {
    return partialView.sort(function (a, b) {
        return a.age - b.age;
    });
};

exports.sort = sort;