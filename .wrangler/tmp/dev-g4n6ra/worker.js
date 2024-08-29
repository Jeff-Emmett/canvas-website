var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// .wrangler/tmp/bundle-fO5AAb/checked-fetch.js
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
var urls;
var init_checked_fetch = __esm({
  ".wrangler/tmp/bundle-fO5AAb/checked-fetch.js"() {
    "use strict";
    urls = /* @__PURE__ */ new Set();
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_checked_fetch();
    init_modules_watch_stub();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// node_modules/lodash.throttle/index.js
var require_lodash = __commonJS({
  "node_modules/lodash.throttle/index.js"(exports, module) {
    init_checked_fetch();
    init_modules_watch_stub();
    var FUNC_ERROR_TEXT = "Expected a function";
    var NAN = 0 / 0;
    var symbolTag = "[object Symbol]";
    var reTrim = /^\s+|\s+$/g;
    var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
    var reIsBinary = /^0b[01]+$/i;
    var reIsOctal = /^0o[0-7]+$/i;
    var freeParseInt = parseInt;
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    var objectProto = Object.prototype;
    var objectToString = objectProto.toString;
    var nativeMax = Math.max;
    var nativeMin = Math.min;
    var now = function() {
      return root.Date.now();
    };
    function debounce2(func, wait, options) {
      var lastArgs, lastThis, maxWait, result, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      wait = toNumber(wait) || 0;
      if (isObject(options)) {
        leading = !!options.leading;
        maxing = "maxWait" in options;
        maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      function invokeFunc(time) {
        var args = lastArgs, thisArg = lastThis;
        lastArgs = lastThis = void 0;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
      }
      function leadingEdge(time) {
        lastInvokeTime = time;
        timerId = setTimeout(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
      }
      function remainingWait(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, result2 = wait - timeSinceLastCall;
        return maxing ? nativeMin(result2, maxWait - timeSinceLastInvoke) : result2;
      }
      function shouldInvoke(time) {
        var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
        return lastCallTime === void 0 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
      }
      function timerExpired() {
        var time = now();
        if (shouldInvoke(time)) {
          return trailingEdge(time);
        }
        timerId = setTimeout(timerExpired, remainingWait(time));
      }
      function trailingEdge(time) {
        timerId = void 0;
        if (trailing && lastArgs) {
          return invokeFunc(time);
        }
        lastArgs = lastThis = void 0;
        return result;
      }
      function cancel() {
        if (timerId !== void 0) {
          clearTimeout(timerId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timerId = void 0;
      }
      function flush() {
        return timerId === void 0 ? result : trailingEdge(now());
      }
      function debounced() {
        var time = now(), isInvoking = shouldInvoke(time);
        lastArgs = arguments;
        lastThis = this;
        lastCallTime = time;
        if (isInvoking) {
          if (timerId === void 0) {
            return leadingEdge(lastCallTime);
          }
          if (maxing) {
            timerId = setTimeout(timerExpired, wait);
            return invokeFunc(lastCallTime);
          }
        }
        if (timerId === void 0) {
          timerId = setTimeout(timerExpired, wait);
        }
        return result;
      }
      debounced.cancel = cancel;
      debounced.flush = flush;
      return debounced;
    }
    function throttle2(func, wait, options) {
      var leading = true, trailing = true;
      if (typeof func != "function") {
        throw new TypeError(FUNC_ERROR_TEXT);
      }
      if (isObject(options)) {
        leading = "leading" in options ? !!options.leading : leading;
        trailing = "trailing" in options ? !!options.trailing : trailing;
      }
      return debounce2(func, wait, {
        "leading": leading,
        "maxWait": wait,
        "trailing": trailing
      });
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return !!value && typeof value == "object";
    }
    function isSymbol(value) {
      return typeof value == "symbol" || isObjectLike(value) && objectToString.call(value) == symbolTag;
    }
    function toNumber(value) {
      if (typeof value == "number") {
        return value;
      }
      if (isSymbol(value)) {
        return NAN;
      }
      if (isObject(value)) {
        var other = typeof value.valueOf == "function" ? value.valueOf() : value;
        value = isObject(other) ? other + "" : other;
      }
      if (typeof value != "string") {
        return value === 0 ? value : +value;
      }
      value = value.replace(reTrim, "");
      var isBinary = reIsBinary.test(value);
      return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
    }
    module.exports = throttle2;
  }
});

// node_modules/lodash.uniq/index.js
var require_lodash2 = __commonJS({
  "node_modules/lodash.uniq/index.js"(exports, module) {
    init_checked_fetch();
    init_modules_watch_stub();
    var LARGE_ARRAY_SIZE = 200;
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    var INFINITY = 1 / 0;
    var funcTag = "[object Function]";
    var genTag = "[object GeneratorFunction]";
    var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
    var reIsHostCtor = /^\[object .+?Constructor\]$/;
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    function arrayIncludes(array2, value) {
      var length = array2 ? array2.length : 0;
      return !!length && baseIndexOf(array2, value, 0) > -1;
    }
    function arrayIncludesWith(array2, value, comparator) {
      var index = -1, length = array2 ? array2.length : 0;
      while (++index < length) {
        if (comparator(value, array2[index])) {
          return true;
        }
      }
      return false;
    }
    function baseFindIndex(array2, predicate, fromIndex, fromRight) {
      var length = array2.length, index = fromIndex + (fromRight ? 1 : -1);
      while (fromRight ? index-- : ++index < length) {
        if (predicate(array2[index], index, array2)) {
          return index;
        }
      }
      return -1;
    }
    function baseIndexOf(array2, value, fromIndex) {
      if (value !== value) {
        return baseFindIndex(array2, baseIsNaN, fromIndex);
      }
      var index = fromIndex - 1, length = array2.length;
      while (++index < length) {
        if (array2[index] === value) {
          return index;
        }
      }
      return -1;
    }
    function baseIsNaN(value) {
      return value !== value;
    }
    function cacheHas(cache, key) {
      return cache.has(key);
    }
    function getValue(object2, key) {
      return object2 == null ? void 0 : object2[key];
    }
    function isHostObject(value) {
      var result = false;
      if (value != null && typeof value.toString != "function") {
        try {
          result = !!(value + "");
        } catch (e) {
        }
      }
      return result;
    }
    function setToArray(set) {
      var index = -1, result = Array(set.size);
      set.forEach(function(value) {
        result[++index] = value;
      });
      return result;
    }
    var arrayProto = Array.prototype;
    var funcProto = Function.prototype;
    var objectProto = Object.prototype;
    var coreJsData = root["__core-js_shared__"];
    var maskSrcKey = function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    }();
    var funcToString = funcProto.toString;
    var hasOwnProperty2 = objectProto.hasOwnProperty;
    var objectToString = objectProto.toString;
    var reIsNative = RegExp(
      "^" + funcToString.call(hasOwnProperty2).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    );
    var splice = arrayProto.splice;
    var Map2 = getNative(root, "Map");
    var Set2 = getNative(root, "Set");
    var nativeCreate = getNative(Object, "create");
    function Hash(entries) {
      var index = -1, length = entries ? entries.length : 0;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
    }
    function hashDelete(key) {
      return this.has(key) && delete this.__data__[key];
    }
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? void 0 : result;
      }
      return hasOwnProperty2.call(data, key) ? data[key] : void 0;
    }
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty2.call(data, key);
    }
    function hashSet(key, value) {
      var data = this.__data__;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    Hash.prototype.clear = hashClear;
    Hash.prototype["delete"] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;
    function ListCache(entries) {
      var index = -1, length = entries ? entries.length : 0;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function listCacheClear() {
      this.__data__ = [];
    }
    function listCacheDelete(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index, 1);
      }
      return true;
    }
    function listCacheGet(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      return index < 0 ? void 0 : data[index][1];
    }
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    function listCacheSet(key, value) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        data.push([key, value]);
      } else {
        data[index][1] = value;
      }
      return this;
    }
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype["delete"] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;
    function MapCache(entries) {
      var index = -1, length = entries ? entries.length : 0;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function mapCacheClear() {
      this.__data__ = {
        "hash": new Hash(),
        "map": new (Map2 || ListCache)(),
        "string": new Hash()
      };
    }
    function mapCacheDelete(key) {
      return getMapData(this, key)["delete"](key);
    }
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    function mapCacheSet(key, value) {
      getMapData(this, key).set(key, value);
      return this;
    }
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype["delete"] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;
    function SetCache(values) {
      var index = -1, length = values ? values.length : 0;
      this.__data__ = new MapCache();
      while (++index < length) {
        this.add(values[index]);
      }
    }
    function setCacheAdd(value) {
      this.__data__.set(value, HASH_UNDEFINED);
      return this;
    }
    function setCacheHas(value) {
      return this.__data__.has(value);
    }
    SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
    SetCache.prototype.has = setCacheHas;
    function assocIndexOf(array2, key) {
      var length = array2.length;
      while (length--) {
        if (eq(array2[length][0], key)) {
          return length;
        }
      }
      return -1;
    }
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) || isHostObject(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }
    function baseUniq(array2, iteratee, comparator) {
      var index = -1, includes = arrayIncludes, length = array2.length, isCommon = true, result = [], seen = result;
      if (comparator) {
        isCommon = false;
        includes = arrayIncludesWith;
      } else if (length >= LARGE_ARRAY_SIZE) {
        var set = iteratee ? null : createSet(array2);
        if (set) {
          return setToArray(set);
        }
        isCommon = false;
        includes = cacheHas;
        seen = new SetCache();
      } else {
        seen = iteratee ? [] : result;
      }
      outer:
        while (++index < length) {
          var value = array2[index], computed2 = iteratee ? iteratee(value) : value;
          value = comparator || value !== 0 ? value : 0;
          if (isCommon && computed2 === computed2) {
            var seenIndex = seen.length;
            while (seenIndex--) {
              if (seen[seenIndex] === computed2) {
                continue outer;
              }
            }
            if (iteratee) {
              seen.push(computed2);
            }
            result.push(value);
          } else if (!includes(seen, computed2, comparator)) {
            if (seen !== result) {
              seen.push(computed2);
            }
            result.push(value);
          }
        }
      return result;
    }
    var createSet = !(Set2 && 1 / setToArray(new Set2([, -0]))[1] == INFINITY) ? noop2 : function(values) {
      return new Set2(values);
    };
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    function getNative(object2, key) {
      var value = getValue(object2, key);
      return baseIsNative(value) ? value : void 0;
    }
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {
        }
        try {
          return func + "";
        } catch (e) {
        }
      }
      return "";
    }
    function uniq(array2) {
      return array2 && array2.length ? baseUniq(array2) : [];
    }
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    function isFunction(value) {
      var tag = isObject(value) ? objectToString.call(value) : "";
      return tag == funcTag || tag == genTag;
    }
    function isObject(value) {
      var type = typeof value;
      return !!value && (type == "object" || type == "function");
    }
    function noop2() {
    }
    module.exports = uniq;
  }
});

// node_modules/lodash.isequal/index.js
var require_lodash3 = __commonJS({
  "node_modules/lodash.isequal/index.js"(exports, module) {
    init_checked_fetch();
    init_modules_watch_stub();
    var LARGE_ARRAY_SIZE = 200;
    var HASH_UNDEFINED = "__lodash_hash_undefined__";
    var COMPARE_PARTIAL_FLAG = 1;
    var COMPARE_UNORDERED_FLAG = 2;
    var MAX_SAFE_INTEGER = 9007199254740991;
    var argsTag = "[object Arguments]";
    var arrayTag = "[object Array]";
    var asyncTag = "[object AsyncFunction]";
    var boolTag = "[object Boolean]";
    var dateTag = "[object Date]";
    var errorTag = "[object Error]";
    var funcTag = "[object Function]";
    var genTag = "[object GeneratorFunction]";
    var mapTag = "[object Map]";
    var numberTag = "[object Number]";
    var nullTag = "[object Null]";
    var objectTag = "[object Object]";
    var promiseTag = "[object Promise]";
    var proxyTag = "[object Proxy]";
    var regexpTag = "[object RegExp]";
    var setTag = "[object Set]";
    var stringTag = "[object String]";
    var symbolTag = "[object Symbol]";
    var undefinedTag = "[object Undefined]";
    var weakMapTag = "[object WeakMap]";
    var arrayBufferTag = "[object ArrayBuffer]";
    var dataViewTag = "[object DataView]";
    var float32Tag = "[object Float32Array]";
    var float64Tag = "[object Float64Array]";
    var int8Tag = "[object Int8Array]";
    var int16Tag = "[object Int16Array]";
    var int32Tag = "[object Int32Array]";
    var uint8Tag = "[object Uint8Array]";
    var uint8ClampedTag = "[object Uint8ClampedArray]";
    var uint16Tag = "[object Uint16Array]";
    var uint32Tag = "[object Uint32Array]";
    var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
    var reIsHostCtor = /^\[object .+?Constructor\]$/;
    var reIsUint = /^(?:0|[1-9]\d*)$/;
    var typedArrayTags = {};
    typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
    typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
    var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
    var freeSelf = typeof self == "object" && self && self.Object === Object && self;
    var root = freeGlobal || freeSelf || Function("return this")();
    var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
    var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
    var moduleExports = freeModule && freeModule.exports === freeExports;
    var freeProcess = moduleExports && freeGlobal.process;
    var nodeUtil = function() {
      try {
        return freeProcess && freeProcess.binding && freeProcess.binding("util");
      } catch (e) {
      }
    }();
    var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
    function arrayFilter(array2, predicate) {
      var index = -1, length = array2 == null ? 0 : array2.length, resIndex = 0, result = [];
      while (++index < length) {
        var value = array2[index];
        if (predicate(value, index, array2)) {
          result[resIndex++] = value;
        }
      }
      return result;
    }
    function arrayPush(array2, values) {
      var index = -1, length = values.length, offset = array2.length;
      while (++index < length) {
        array2[offset + index] = values[index];
      }
      return array2;
    }
    function arraySome(array2, predicate) {
      var index = -1, length = array2 == null ? 0 : array2.length;
      while (++index < length) {
        if (predicate(array2[index], index, array2)) {
          return true;
        }
      }
      return false;
    }
    function baseTimes(n2, iteratee) {
      var index = -1, result = Array(n2);
      while (++index < n2) {
        result[index] = iteratee(index);
      }
      return result;
    }
    function baseUnary(func) {
      return function(value) {
        return func(value);
      };
    }
    function cacheHas(cache, key) {
      return cache.has(key);
    }
    function getValue(object2, key) {
      return object2 == null ? void 0 : object2[key];
    }
    function mapToArray(map) {
      var index = -1, result = Array(map.size);
      map.forEach(function(value, key) {
        result[++index] = [key, value];
      });
      return result;
    }
    function overArg(func, transform) {
      return function(arg) {
        return func(transform(arg));
      };
    }
    function setToArray(set) {
      var index = -1, result = Array(set.size);
      set.forEach(function(value) {
        result[++index] = value;
      });
      return result;
    }
    var arrayProto = Array.prototype;
    var funcProto = Function.prototype;
    var objectProto = Object.prototype;
    var coreJsData = root["__core-js_shared__"];
    var funcToString = funcProto.toString;
    var hasOwnProperty2 = objectProto.hasOwnProperty;
    var maskSrcKey = function() {
      var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
      return uid ? "Symbol(src)_1." + uid : "";
    }();
    var nativeObjectToString = objectProto.toString;
    var reIsNative = RegExp(
      "^" + funcToString.call(hasOwnProperty2).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
    );
    var Buffer2 = moduleExports ? root.Buffer : void 0;
    var Symbol2 = root.Symbol;
    var Uint8Array2 = root.Uint8Array;
    var propertyIsEnumerable = objectProto.propertyIsEnumerable;
    var splice = arrayProto.splice;
    var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
    var nativeGetSymbols = Object.getOwnPropertySymbols;
    var nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : void 0;
    var nativeKeys = overArg(Object.keys, Object);
    var DataView2 = getNative(root, "DataView");
    var Map2 = getNative(root, "Map");
    var Promise2 = getNative(root, "Promise");
    var Set2 = getNative(root, "Set");
    var WeakMap2 = getNative(root, "WeakMap");
    var nativeCreate = getNative(Object, "create");
    var dataViewCtorString = toSource(DataView2);
    var mapCtorString = toSource(Map2);
    var promiseCtorString = toSource(Promise2);
    var setCtorString = toSource(Set2);
    var weakMapCtorString = toSource(WeakMap2);
    var symbolProto = Symbol2 ? Symbol2.prototype : void 0;
    var symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
    function Hash(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function hashClear() {
      this.__data__ = nativeCreate ? nativeCreate(null) : {};
      this.size = 0;
    }
    function hashDelete(key) {
      var result = this.has(key) && delete this.__data__[key];
      this.size -= result ? 1 : 0;
      return result;
    }
    function hashGet(key) {
      var data = this.__data__;
      if (nativeCreate) {
        var result = data[key];
        return result === HASH_UNDEFINED ? void 0 : result;
      }
      return hasOwnProperty2.call(data, key) ? data[key] : void 0;
    }
    function hashHas(key) {
      var data = this.__data__;
      return nativeCreate ? data[key] !== void 0 : hasOwnProperty2.call(data, key);
    }
    function hashSet(key, value) {
      var data = this.__data__;
      this.size += this.has(key) ? 0 : 1;
      data[key] = nativeCreate && value === void 0 ? HASH_UNDEFINED : value;
      return this;
    }
    Hash.prototype.clear = hashClear;
    Hash.prototype["delete"] = hashDelete;
    Hash.prototype.get = hashGet;
    Hash.prototype.has = hashHas;
    Hash.prototype.set = hashSet;
    function ListCache(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function listCacheClear() {
      this.__data__ = [];
      this.size = 0;
    }
    function listCacheDelete(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        return false;
      }
      var lastIndex = data.length - 1;
      if (index == lastIndex) {
        data.pop();
      } else {
        splice.call(data, index, 1);
      }
      --this.size;
      return true;
    }
    function listCacheGet(key) {
      var data = this.__data__, index = assocIndexOf(data, key);
      return index < 0 ? void 0 : data[index][1];
    }
    function listCacheHas(key) {
      return assocIndexOf(this.__data__, key) > -1;
    }
    function listCacheSet(key, value) {
      var data = this.__data__, index = assocIndexOf(data, key);
      if (index < 0) {
        ++this.size;
        data.push([key, value]);
      } else {
        data[index][1] = value;
      }
      return this;
    }
    ListCache.prototype.clear = listCacheClear;
    ListCache.prototype["delete"] = listCacheDelete;
    ListCache.prototype.get = listCacheGet;
    ListCache.prototype.has = listCacheHas;
    ListCache.prototype.set = listCacheSet;
    function MapCache(entries) {
      var index = -1, length = entries == null ? 0 : entries.length;
      this.clear();
      while (++index < length) {
        var entry = entries[index];
        this.set(entry[0], entry[1]);
      }
    }
    function mapCacheClear() {
      this.size = 0;
      this.__data__ = {
        "hash": new Hash(),
        "map": new (Map2 || ListCache)(),
        "string": new Hash()
      };
    }
    function mapCacheDelete(key) {
      var result = getMapData(this, key)["delete"](key);
      this.size -= result ? 1 : 0;
      return result;
    }
    function mapCacheGet(key) {
      return getMapData(this, key).get(key);
    }
    function mapCacheHas(key) {
      return getMapData(this, key).has(key);
    }
    function mapCacheSet(key, value) {
      var data = getMapData(this, key), size = data.size;
      data.set(key, value);
      this.size += data.size == size ? 0 : 1;
      return this;
    }
    MapCache.prototype.clear = mapCacheClear;
    MapCache.prototype["delete"] = mapCacheDelete;
    MapCache.prototype.get = mapCacheGet;
    MapCache.prototype.has = mapCacheHas;
    MapCache.prototype.set = mapCacheSet;
    function SetCache(values) {
      var index = -1, length = values == null ? 0 : values.length;
      this.__data__ = new MapCache();
      while (++index < length) {
        this.add(values[index]);
      }
    }
    function setCacheAdd(value) {
      this.__data__.set(value, HASH_UNDEFINED);
      return this;
    }
    function setCacheHas(value) {
      return this.__data__.has(value);
    }
    SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
    SetCache.prototype.has = setCacheHas;
    function Stack(entries) {
      var data = this.__data__ = new ListCache(entries);
      this.size = data.size;
    }
    function stackClear() {
      this.__data__ = new ListCache();
      this.size = 0;
    }
    function stackDelete(key) {
      var data = this.__data__, result = data["delete"](key);
      this.size = data.size;
      return result;
    }
    function stackGet(key) {
      return this.__data__.get(key);
    }
    function stackHas(key) {
      return this.__data__.has(key);
    }
    function stackSet(key, value) {
      var data = this.__data__;
      if (data instanceof ListCache) {
        var pairs = data.__data__;
        if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
          pairs.push([key, value]);
          this.size = ++data.size;
          return this;
        }
        data = this.__data__ = new MapCache(pairs);
      }
      data.set(key, value);
      this.size = data.size;
      return this;
    }
    Stack.prototype.clear = stackClear;
    Stack.prototype["delete"] = stackDelete;
    Stack.prototype.get = stackGet;
    Stack.prototype.has = stackHas;
    Stack.prototype.set = stackSet;
    function arrayLikeKeys(value, inherited) {
      var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes(value.length, String) : [], length = result.length;
      for (var key in value) {
        if ((inherited || hasOwnProperty2.call(value, key)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
        (key == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
        isBuff && (key == "offset" || key == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
        isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || // Skip index properties.
        isIndex(key, length)))) {
          result.push(key);
        }
      }
      return result;
    }
    function assocIndexOf(array2, key) {
      var length = array2.length;
      while (length--) {
        if (eq(array2[length][0], key)) {
          return length;
        }
      }
      return -1;
    }
    function baseGetAllKeys(object2, keysFunc, symbolsFunc) {
      var result = keysFunc(object2);
      return isArray(object2) ? result : arrayPush(result, symbolsFunc(object2));
    }
    function baseGetTag(value) {
      if (value == null) {
        return value === void 0 ? undefinedTag : nullTag;
      }
      return symToStringTag && symToStringTag in Object(value) ? getRawTag(value) : objectToString(value);
    }
    function baseIsArguments(value) {
      return isObjectLike(value) && baseGetTag(value) == argsTag;
    }
    function baseIsEqual(value, other, bitmask, customizer, stack) {
      if (value === other) {
        return true;
      }
      if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
        return value !== value && other !== other;
      }
      return baseIsEqualDeep(value, other, bitmask, customizer, baseIsEqual, stack);
    }
    function baseIsEqualDeep(object2, other, bitmask, customizer, equalFunc, stack) {
      var objIsArr = isArray(object2), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object2), othTag = othIsArr ? arrayTag : getTag(other);
      objTag = objTag == argsTag ? objectTag : objTag;
      othTag = othTag == argsTag ? objectTag : othTag;
      var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
      if (isSameTag && isBuffer(object2)) {
        if (!isBuffer(other)) {
          return false;
        }
        objIsArr = true;
        objIsObj = false;
      }
      if (isSameTag && !objIsObj) {
        stack || (stack = new Stack());
        return objIsArr || isTypedArray(object2) ? equalArrays(object2, other, bitmask, customizer, equalFunc, stack) : equalByTag(object2, other, objTag, bitmask, customizer, equalFunc, stack);
      }
      if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
        var objIsWrapped = objIsObj && hasOwnProperty2.call(object2, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty2.call(other, "__wrapped__");
        if (objIsWrapped || othIsWrapped) {
          var objUnwrapped = objIsWrapped ? object2.value() : object2, othUnwrapped = othIsWrapped ? other.value() : other;
          stack || (stack = new Stack());
          return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer, stack);
        }
      }
      if (!isSameTag) {
        return false;
      }
      stack || (stack = new Stack());
      return equalObjects(object2, other, bitmask, customizer, equalFunc, stack);
    }
    function baseIsNative(value) {
      if (!isObject(value) || isMasked(value)) {
        return false;
      }
      var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
      return pattern.test(toSource(value));
    }
    function baseIsTypedArray(value) {
      return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
    }
    function baseKeys(object2) {
      if (!isPrototype(object2)) {
        return nativeKeys(object2);
      }
      var result = [];
      for (var key in Object(object2)) {
        if (hasOwnProperty2.call(object2, key) && key != "constructor") {
          result.push(key);
        }
      }
      return result;
    }
    function equalArrays(array2, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array2.length, othLength = other.length;
      if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
        return false;
      }
      var stacked = stack.get(array2);
      if (stacked && stack.get(other)) {
        return stacked == other;
      }
      var index = -1, result = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : void 0;
      stack.set(array2, other);
      stack.set(other, array2);
      while (++index < arrLength) {
        var arrValue = array2[index], othValue = other[index];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, arrValue, index, other, array2, stack) : customizer(arrValue, othValue, index, array2, other, stack);
        }
        if (compared !== void 0) {
          if (compared) {
            continue;
          }
          result = false;
          break;
        }
        if (seen) {
          if (!arraySome(other, function(othValue2, othIndex) {
            if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer, stack))) {
              return seen.push(othIndex);
            }
          })) {
            result = false;
            break;
          }
        } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer, stack))) {
          result = false;
          break;
        }
      }
      stack["delete"](array2);
      stack["delete"](other);
      return result;
    }
    function equalByTag(object2, other, tag, bitmask, customizer, equalFunc, stack) {
      switch (tag) {
        case dataViewTag:
          if (object2.byteLength != other.byteLength || object2.byteOffset != other.byteOffset) {
            return false;
          }
          object2 = object2.buffer;
          other = other.buffer;
        case arrayBufferTag:
          if (object2.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object2), new Uint8Array2(other))) {
            return false;
          }
          return true;
        case boolTag:
        case dateTag:
        case numberTag:
          return eq(+object2, +other);
        case errorTag:
          return object2.name == other.name && object2.message == other.message;
        case regexpTag:
        case stringTag:
          return object2 == other + "";
        case mapTag:
          var convert = mapToArray;
        case setTag:
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
          convert || (convert = setToArray);
          if (object2.size != other.size && !isPartial) {
            return false;
          }
          var stacked = stack.get(object2);
          if (stacked) {
            return stacked == other;
          }
          bitmask |= COMPARE_UNORDERED_FLAG;
          stack.set(object2, other);
          var result = equalArrays(convert(object2), convert(other), bitmask, customizer, equalFunc, stack);
          stack["delete"](object2);
          return result;
        case symbolTag:
          if (symbolValueOf) {
            return symbolValueOf.call(object2) == symbolValueOf.call(other);
          }
      }
      return false;
    }
    function equalObjects(object2, other, bitmask, customizer, equalFunc, stack) {
      var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object2), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
      if (objLength != othLength && !isPartial) {
        return false;
      }
      var index = objLength;
      while (index--) {
        var key = objProps[index];
        if (!(isPartial ? key in other : hasOwnProperty2.call(other, key))) {
          return false;
        }
      }
      var stacked = stack.get(object2);
      if (stacked && stack.get(other)) {
        return stacked == other;
      }
      var result = true;
      stack.set(object2, other);
      stack.set(other, object2);
      var skipCtor = isPartial;
      while (++index < objLength) {
        key = objProps[index];
        var objValue = object2[key], othValue = other[key];
        if (customizer) {
          var compared = isPartial ? customizer(othValue, objValue, key, other, object2, stack) : customizer(objValue, othValue, key, object2, other, stack);
        }
        if (!(compared === void 0 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer, stack) : compared)) {
          result = false;
          break;
        }
        skipCtor || (skipCtor = key == "constructor");
      }
      if (result && !skipCtor) {
        var objCtor = object2.constructor, othCtor = other.constructor;
        if (objCtor != othCtor && ("constructor" in object2 && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
          result = false;
        }
      }
      stack["delete"](object2);
      stack["delete"](other);
      return result;
    }
    function getAllKeys(object2) {
      return baseGetAllKeys(object2, keys, getSymbols);
    }
    function getMapData(map, key) {
      var data = map.__data__;
      return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
    }
    function getNative(object2, key) {
      var value = getValue(object2, key);
      return baseIsNative(value) ? value : void 0;
    }
    function getRawTag(value) {
      var isOwn = hasOwnProperty2.call(value, symToStringTag), tag = value[symToStringTag];
      try {
        value[symToStringTag] = void 0;
        var unmasked = true;
      } catch (e) {
      }
      var result = nativeObjectToString.call(value);
      if (unmasked) {
        if (isOwn) {
          value[symToStringTag] = tag;
        } else {
          delete value[symToStringTag];
        }
      }
      return result;
    }
    var getSymbols = !nativeGetSymbols ? stubArray : function(object2) {
      if (object2 == null) {
        return [];
      }
      object2 = Object(object2);
      return arrayFilter(nativeGetSymbols(object2), function(symbol) {
        return propertyIsEnumerable.call(object2, symbol);
      });
    };
    var getTag = baseGetTag;
    if (DataView2 && getTag(new DataView2(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap2 && getTag(new WeakMap2()) != weakMapTag) {
      getTag = function(value) {
        var result = baseGetTag(value), Ctor = result == objectTag ? value.constructor : void 0, ctorString = Ctor ? toSource(Ctor) : "";
        if (ctorString) {
          switch (ctorString) {
            case dataViewCtorString:
              return dataViewTag;
            case mapCtorString:
              return mapTag;
            case promiseCtorString:
              return promiseTag;
            case setCtorString:
              return setTag;
            case weakMapCtorString:
              return weakMapTag;
          }
        }
        return result;
      };
    }
    function isIndex(value, length) {
      length = length == null ? MAX_SAFE_INTEGER : length;
      return !!length && (typeof value == "number" || reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
    }
    function isKeyable(value) {
      var type = typeof value;
      return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
    }
    function isMasked(func) {
      return !!maskSrcKey && maskSrcKey in func;
    }
    function isPrototype(value) {
      var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
      return value === proto;
    }
    function objectToString(value) {
      return nativeObjectToString.call(value);
    }
    function toSource(func) {
      if (func != null) {
        try {
          return funcToString.call(func);
        } catch (e) {
        }
        try {
          return func + "";
        } catch (e) {
        }
      }
      return "";
    }
    function eq(value, other) {
      return value === other || value !== value && other !== other;
    }
    var isArguments = baseIsArguments(function() {
      return arguments;
    }()) ? baseIsArguments : function(value) {
      return isObjectLike(value) && hasOwnProperty2.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
    };
    var isArray = Array.isArray;
    function isArrayLike(value) {
      return value != null && isLength(value.length) && !isFunction(value);
    }
    var isBuffer = nativeIsBuffer || stubFalse;
    function isEqual5(value, other) {
      return baseIsEqual(value, other);
    }
    function isFunction(value) {
      if (!isObject(value)) {
        return false;
      }
      var tag = baseGetTag(value);
      return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
    }
    function isLength(value) {
      return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
    }
    function isObject(value) {
      var type = typeof value;
      return value != null && (type == "object" || type == "function");
    }
    function isObjectLike(value) {
      return value != null && typeof value == "object";
    }
    var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
    function keys(object2) {
      return isArrayLike(object2) ? arrayLikeKeys(object2) : baseKeys(object2);
    }
    function stubArray() {
      return [];
    }
    function stubFalse() {
      return false;
    }
    module.exports = isEqual5;
  }
});

// .wrangler/tmp/bundle-fO5AAb/middleware-loader.entry.ts
init_checked_fetch();
init_modules_watch_stub();

// .wrangler/tmp/bundle-fO5AAb/middleware-insertion-facade.js
init_checked_fetch();
init_modules_watch_stub();

// worker/worker.ts
init_checked_fetch();
init_modules_watch_stub();

// node_modules/cloudflare-workers-unfurl/unfurl.js
init_checked_fetch();
init_modules_watch_stub();
var validContentTypes = [
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "image/*"
];
function isValidContentType(contentType) {
  return (
    // allow unspecified, try to parse it anyway
    !contentType || contentType.startsWith("image/") || validContentTypes.some((valid) => contentType.startsWith(valid))
  );
}
async function unfurl(url) {
  if (typeof url !== "string" || !url.match(/^https?:\/\//)) {
    return { ok: false, error: "bad-param" };
  }
  const meta$ = new MetaExtractor();
  const title$ = new TextExtractor();
  const icon$ = new IconExtractor();
  try {
    const headers = new Headers();
    for (const contentType of validContentTypes) {
      headers.append("accept", contentType);
    }
    const res = await fetch(url, { headers });
    if (!res.ok || !isValidContentType(res.headers.get("content-type") ?? "")) {
      return { ok: false, error: "failed-fetch" };
    }
    if (res.headers.get("content-type")?.startsWith("image/")) {
      return {
        ok: true,
        value: {
          image: url,
          title: new URL(url).pathname.split("/").pop() || void 0
        }
      };
    }
    await new HTMLRewriter().on("meta", meta$).on("title", title$).on("link", icon$).transform(res).blob();
  } catch {
    return { ok: false, error: "failed-fetch" };
  }
  const { og, twitter } = meta$;
  const title = og["og:title"] ?? twitter["twitter:title"] ?? title$.string ?? void 0;
  const description = og["og:description"] ?? twitter["twitter:description"] ?? meta$.description ?? void 0;
  let image = og["og:image:secure_url"] ?? og["og:image"] ?? twitter["twitter:image"] ?? void 0;
  let favicon = icon$.appleIcon ?? icon$.icon ?? void 0;
  if (image && !image?.startsWith("http")) {
    image = new URL(image, url).href;
  }
  if (favicon && !favicon?.startsWith("http")) {
    favicon = new URL(favicon, url).href;
  }
  return {
    ok: true,
    value: {
      title,
      description,
      image,
      favicon
    }
  };
}
async function handleUnfurlRequest(request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return new Response("Missing URL query parameter.", { status: 400 });
  }
  const result = await unfurl(url);
  if (result.ok) {
    return new Response(JSON.stringify(result.value), {
      headers: { "Content-Type": "application/json" }
    });
  } else if (result.error === "bad-param") {
    return new Response("Bad URL query parameter.", { status: 400 });
  } else {
    return new Response("Failed to fetch URL.", { status: 422 });
  }
}
var TextExtractor = class {
  /**
   * The accumulated text extracted from elements.
   * @type {string}
   */
  string = "";
  /**
   * Handles an incoming piece of text.
   * @param {Object} param - The text object.
   * @param {string} param.text - The incoming text.
   */
  text({ text }) {
    this.string += text;
  }
};
var MetaExtractor = class {
  /**
   * The Open Graph (og) metadata extracted from elements.
   * @type {Object.<string, string|null>}
   */
  og = {};
  /**
   * The Twitter metadata extracted from elements.
   * @type {Object.<string, string|null>}
   */
  twitter = {};
  /**
   * The description extracted from elements.
   * @type {string|null}
   */
  description = null;
  /**
   * Handles an incoming element.
   * @param {Element} element - The incoming element.
   */
  element(element) {
    const property = element.getAttribute("property");
    const name = element.getAttribute("name");
    if (property && property.startsWith("og:")) {
      this.og[property] = element.getAttribute("content");
    } else if (name && name.startsWith("twitter:")) {
      this.twitter[name] = element.getAttribute("content");
    } else if (name === "description") {
      this.description = element.getAttribute("content");
    }
  }
};
var IconExtractor = class {
  /**
   * The Apple touch icon URL extracted from elements.
   * @type {string|null}
   */
  appleIcon = null;
  /**
   * The favicon URL extracted from elements.
   * @type {string|null}
   */
  icon = null;
  /**
   * Handles an incoming element.
   * @param {Element} element - The incoming element.
   */
  element(element) {
    if (element.getAttribute("rel") === "icon") {
      this.icon = element.getAttribute("href");
    } else if (element.getAttribute("rel") === "apple-touch-icon") {
      this.appleIcon = element.getAttribute("href");
    }
  }
};

// node_modules/itty-router/index.mjs
init_checked_fetch();
init_modules_watch_stub();
var t = ({ base: e = "", routes: t2 = [], ...r2 } = {}) => ({ __proto__: new Proxy({}, { get: (r3, o2, a2, s2) => (r4, ...c2) => t2.push([o2.toUpperCase?.(), RegExp(`^${(s2 = (e + r4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), c2, s2]) && a2 }), routes: t2, ...r2, async fetch(e2, ...o2) {
  let a2, s2, c2 = new URL(e2.url), n2 = e2.query = { __proto__: null };
  for (let [e3, t3] of c2.searchParams)
    n2[e3] = n2[e3] ? [].concat(n2[e3], t3) : t3;
  e:
    try {
      for (let t3 of r2.before || [])
        if (null != (a2 = await t3(e2.proxy ?? e2, ...o2)))
          break e;
      t:
        for (let [r3, n3, l, i] of t2)
          if ((r3 == e2.method || "ALL" == r3) && (s2 = c2.pathname.match(n3))) {
            e2.params = s2.groups || {}, e2.route = i;
            for (let t3 of l)
              if (null != (a2 = await t3(e2.proxy ?? e2, ...o2)))
                break t;
          }
    } catch (t3) {
      if (!r2.catch)
        throw t3;
      a2 = await r2.catch(t3, e2.proxy ?? e2, ...o2);
    }
  try {
    for (let t3 of r2.finally || [])
      a2 = await t3(a2, e2.proxy ?? e2, ...o2) ?? a2;
  } catch (t3) {
    if (!r2.catch)
      throw t3;
    a2 = await r2.catch(t3, e2.proxy ?? e2, ...o2);
  }
  return a2;
} });
var r = (e = "text/plain; charset=utf-8", t2) => (r2, o2 = {}) => {
  if (void 0 === r2 || r2 instanceof Response)
    return r2;
  const a2 = new Response(t2?.(r2) ?? r2, o2.url ? void 0 : o2);
  return a2.headers.set("content-type", e), a2;
};
var o = r("application/json; charset=utf-8", JSON.stringify);
var a = (e) => ({ 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error" })[e] || "Unknown Error";
var s = (e = 500, t2) => {
  if (e instanceof Error) {
    const { message: r2, ...o2 } = e;
    e = e.status || 500, t2 = { error: r2 || a(e), ...o2 };
  }
  return t2 = { status: e, ..."object" == typeof t2 ? t2 : { error: t2 || a(e) } }, o(t2, { status: e });
};
var c = (e) => {
  e.proxy = new Proxy(e.proxy ?? e, { get: (t2, r2) => t2[r2]?.bind?.(e) ?? t2[r2] ?? t2?.params?.[r2] });
};
var n = ({ format: e = o, missing: r2 = () => s(404), finally: a2 = [], before: n2 = [], ...l } = {}) => t({ before: [c, ...n2], catch: s, finally: [(e2, ...t2) => e2 ?? r2(...t2), e, ...a2], ...l });
var p = r("text/plain; charset=utf-8", String);
var f = r("text/html");
var u = r("image/jpeg");
var h = r("image/png");
var g = r("image/webp");
var y = (e = {}) => {
  const { origin: t2 = "*", credentials: r2 = false, allowMethods: o2 = "*", allowHeaders: a2, exposeHeaders: s2, maxAge: c2 } = e, n2 = (e2) => {
    const o3 = e2?.headers.get("origin");
    return true === t2 ? o3 : t2 instanceof RegExp ? t2.test(o3) ? o3 : void 0 : Array.isArray(t2) ? t2.includes(o3) ? o3 : void 0 : t2 instanceof Function ? t2(o3) : "*" == t2 && r2 ? o3 : t2;
  }, l = (e2, t3) => {
    for (const [r3, o3] of Object.entries(t3))
      o3 && e2.headers.append(r3, o3);
    return e2;
  };
  return { corsify: (e2, t3) => e2?.headers?.get("access-control-allow-origin") || 101 == e2.status ? e2 : l(e2.clone(), { "access-control-allow-origin": n2(t3), "access-control-allow-credentials": r2 }), preflight: (e2) => {
    if ("OPTIONS" == e2.method) {
      const t3 = new Response(null, { status: 204 });
      return l(t3, { "access-control-allow-origin": n2(e2), "access-control-allow-methods": o2?.join?.(",") ?? o2, "access-control-expose-headers": s2?.join?.(",") ?? s2, "access-control-allow-headers": a2?.join?.(",") ?? a2 ?? e2.headers.get("access-control-request-headers"), "access-control-max-age": c2, "access-control-allow-credentials": r2 });
    }
  } };
};

// worker/assetUploads.ts
init_checked_fetch();
init_modules_watch_stub();
function getAssetObjectName(uploadId) {
  return `uploads/${uploadId.replace(/[^a-zA-Z0-9\_\-]+/g, "_")}`;
}
async function handleAssetUpload(request, env) {
  const objectName = getAssetObjectName(request.params.uploadId);
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) {
    return s(400, "Invalid content type");
  }
  if (await env.TLDRAW_BUCKET.head(objectName)) {
    return s(409, "Upload already exists");
  }
  await env.TLDRAW_BUCKET.put(objectName, request.body, {
    httpMetadata: request.headers
  });
  return { ok: true };
}
async function handleAssetDownload(request, env, ctx) {
  const objectName = getAssetObjectName(request.params.uploadId);
  const cacheKey = new Request(request.url, { headers: request.headers });
  const cachedResponse = await caches.default.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }
  const object2 = await env.TLDRAW_BUCKET.get(objectName, {
    range: request.headers,
    onlyIf: request.headers
  });
  if (!object2) {
    return s(404);
  }
  const headers = new Headers();
  object2.writeHttpMetadata(headers);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("etag", object2.httpEtag);
  headers.set("access-control-allow-origin", "*");
  let contentRange;
  if (object2.range) {
    if ("suffix" in object2.range) {
      const start = object2.size - object2.range.suffix;
      const end = object2.size - 1;
      contentRange = `bytes ${start}-${end}/${object2.size}`;
    } else {
      const start = object2.range.offset ?? 0;
      const end = object2.range.length ? start + object2.range.length - 1 : object2.size - 1;
      if (start !== 0 || end !== object2.size - 1) {
        contentRange = `bytes ${start}-${end}/${object2.size}`;
      }
    }
  }
  if (contentRange) {
    headers.set("content-range", contentRange);
  }
  const body = "body" in object2 && object2.body ? object2.body : null;
  const status = body ? contentRange ? 206 : 200 : 304;
  if (status === 200) {
    const [cacheBody, responseBody] = body.tee();
    ctx.waitUntil(caches.default.put(cacheKey, new Response(cacheBody, { headers, status })));
    return new Response(responseBody, { headers, status });
  }
  return new Response(body, { headers, status });
}

// worker/TldrawDurableObject.ts
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/dist-esm/lib/ClientWebSocketAdapter.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/helpers.mjs
init_checked_fetch();
init_modules_watch_stub();
function isChild(x) {
  return x && typeof x === "object" && "parents" in x;
}
function haveParentsChanged(child) {
  for (let i = 0, n2 = child.parents.length; i < n2; i++) {
    child.parents[i].__unsafe__getWithoutCapture(true);
    if (child.parents[i].lastChangedEpoch !== child.parentEpochs[i]) {
      return true;
    }
  }
  return false;
}
var detach = (parent, child) => {
  if (!parent.children.remove(child)) {
    return;
  }
  if (parent.children.isEmpty && isChild(parent)) {
    for (let i = 0, n2 = parent.parents.length; i < n2; i++) {
      detach(parent.parents[i], parent);
    }
  }
};
var attach = (parent, child) => {
  if (!parent.children.add(child)) {
    return;
  }
  if (isChild(parent)) {
    for (let i = 0, n2 = parent.parents.length; i < n2; i++) {
      attach(parent.parents[i], parent);
    }
  }
};
function equals(a2, b) {
  const shallowEquals = a2 === b || Object.is(a2, b) || Boolean(a2 && b && typeof a2.equals === "function" && a2.equals(b));
  return shallowEquals;
}
function singleton(key, init) {
  const symbol = Symbol.for(`com.tldraw.state/${key}`);
  const global2 = globalThis;
  global2[symbol] ??= init();
  return global2[symbol];
}
var EMPTY_ARRAY = singleton("empty_array", () => Object.freeze([]));

// node_modules/@tldraw/state/dist-esm/lib/ArraySet.mjs
init_checked_fetch();
init_modules_watch_stub();
var ARRAY_SIZE_THRESHOLD = 8;
var ArraySet = class {
  arraySize = 0;
  array = Array(ARRAY_SIZE_THRESHOLD);
  set = null;
  /**
   * Get whether this ArraySet has any elements.
   *
   * @returns True if this ArraySet has any elements, false otherwise.
   */
  // eslint-disable-next-line no-restricted-syntax
  get isEmpty() {
    if (this.array) {
      return this.arraySize === 0;
    }
    if (this.set) {
      return this.set.size === 0;
    }
    throw new Error("no set or array");
  }
  /**
   * Add an item to the ArraySet if it is not already present.
   *
   * @param elem - The element to add.
   */
  add(elem) {
    if (this.array) {
      const idx = this.array.indexOf(elem);
      if (idx !== -1) {
        return false;
      }
      if (this.arraySize < ARRAY_SIZE_THRESHOLD) {
        this.array[this.arraySize] = elem;
        this.arraySize++;
        return true;
      } else {
        this.set = new Set(this.array);
        this.array = null;
        this.set.add(elem);
        return true;
      }
    }
    if (this.set) {
      if (this.set.has(elem)) {
        return false;
      }
      this.set.add(elem);
      return true;
    }
    throw new Error("no set or array");
  }
  /**
   * Remove an item from the ArraySet if it is present.
   *
   * @param elem - The element to remove
   */
  remove(elem) {
    if (this.array) {
      const idx = this.array.indexOf(elem);
      if (idx === -1) {
        return false;
      }
      this.array[idx] = void 0;
      this.arraySize--;
      if (idx !== this.arraySize) {
        this.array[idx] = this.array[this.arraySize];
        this.array[this.arraySize] = void 0;
      }
      return true;
    }
    if (this.set) {
      if (!this.set.has(elem)) {
        return false;
      }
      this.set.delete(elem);
      return true;
    }
    throw new Error("no set or array");
  }
  /**
   * Run a callback for each element in the ArraySet.
   *
   * @param visitor - The callback to run for each element.
   */
  visit(visitor) {
    if (this.array) {
      for (let i = 0; i < this.arraySize; i++) {
        const elem = this.array[i];
        if (typeof elem !== "undefined") {
          visitor(elem);
        }
      }
      return;
    }
    if (this.set) {
      this.set.forEach(visitor);
      return;
    }
    throw new Error("no set or array");
  }
  has(elem) {
    if (this.array) {
      return this.array.indexOf(elem) !== -1;
    } else {
      return this.set.has(elem);
    }
  }
  clear() {
    if (this.set) {
      this.set.clear();
    } else {
      this.arraySize = 0;
      this.array = [];
    }
  }
  size() {
    if (this.set) {
      return this.set.size;
    } else {
      return this.arraySize;
    }
  }
};

// node_modules/@tldraw/state/dist-esm/lib/Atom.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/HistoryBuffer.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/types.mjs
init_checked_fetch();
init_modules_watch_stub();
var RESET_VALUE = Symbol.for("com.tldraw.state/RESET_VALUE");

// node_modules/@tldraw/state/dist-esm/lib/HistoryBuffer.mjs
var HistoryBuffer = class {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }
  index = 0;
  // use a wrap around buffer to store the last N values
  buffer;
  /**
   * Add a diff to the history buffer.
   *
   * @param lastComputedEpoch - The epoch when the diff was computed.
   * @param currentEpoch - The current epoch.
   * @param diff - The diff to add, or else a reset value.
   */
  pushEntry(lastComputedEpoch, currentEpoch, diff) {
    if (diff === void 0) {
      return;
    }
    if (diff === RESET_VALUE) {
      this.clear();
      return;
    }
    this.buffer[this.index] = [lastComputedEpoch, currentEpoch, diff];
    this.index = (this.index + 1) % this.capacity;
  }
  /**
   * Clear the history buffer.
   */
  clear() {
    this.index = 0;
    this.buffer.fill(void 0);
  }
  /**
   * Get the diffs since the given epoch.
   *
   * @param epoch - The epoch to get diffs since.
   * @returns An array of diffs or a flag to reset the history buffer.
   */
  getChangesSince(sinceEpoch) {
    const { index, capacity, buffer } = this;
    for (let i = 0; i < capacity; i++) {
      const offset = (index - 1 + capacity - i) % capacity;
      const elem = buffer[offset];
      if (!elem) {
        return RESET_VALUE;
      }
      const [fromEpoch, toEpoch] = elem;
      if (i === 0 && sinceEpoch >= toEpoch) {
        return [];
      }
      if (fromEpoch <= sinceEpoch && sinceEpoch < toEpoch) {
        const len = i + 1;
        const result = new Array(len);
        for (let j = 0; j < len; j++) {
          result[j] = buffer[(offset + j) % capacity][2];
        }
        return result;
      }
    }
    return RESET_VALUE;
  }
};

// node_modules/@tldraw/state/dist-esm/lib/capture.mjs
init_checked_fetch();
init_modules_watch_stub();
var CaptureStackFrame = class {
  constructor(below, child) {
    this.below = below;
    this.child = child;
  }
  offset = 0;
  maybeRemoved;
};
var inst = singleton("capture", () => ({ stack: null }));
function startCapturingParents(child) {
  inst.stack = new CaptureStackFrame(inst.stack, child);
  child.parentSet.clear();
}
function stopCapturingParents() {
  const frame = inst.stack;
  inst.stack = frame.below;
  if (frame.offset < frame.child.parents.length) {
    for (let i = frame.offset; i < frame.child.parents.length; i++) {
      const maybeRemovedParent = frame.child.parents[i];
      if (!frame.child.parentSet.has(maybeRemovedParent)) {
        detach(maybeRemovedParent, frame.child);
      }
    }
    frame.child.parents.length = frame.offset;
    frame.child.parentEpochs.length = frame.offset;
  }
  if (frame.maybeRemoved) {
    for (let i = 0; i < frame.maybeRemoved.length; i++) {
      const maybeRemovedParent = frame.maybeRemoved[i];
      if (!frame.child.parentSet.has(maybeRemovedParent)) {
        detach(maybeRemovedParent, frame.child);
      }
    }
  }
}
function maybeCaptureParent(p2) {
  if (inst.stack) {
    const wasCapturedAlready = inst.stack.child.parentSet.has(p2);
    if (wasCapturedAlready) {
      return;
    }
    inst.stack.child.parentSet.add(p2);
    if (inst.stack.child.isActivelyListening) {
      attach(p2, inst.stack.child);
    }
    if (inst.stack.offset < inst.stack.child.parents.length) {
      const maybeRemovedParent = inst.stack.child.parents[inst.stack.offset];
      if (maybeRemovedParent !== p2) {
        if (!inst.stack.maybeRemoved) {
          inst.stack.maybeRemoved = [maybeRemovedParent];
        } else {
          inst.stack.maybeRemoved.push(maybeRemovedParent);
        }
      }
    }
    inst.stack.child.parents[inst.stack.offset] = p2;
    inst.stack.child.parentEpochs[inst.stack.offset] = p2.lastChangedEpoch;
    inst.stack.offset++;
  }
}

// node_modules/@tldraw/state/dist-esm/lib/transactions.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/EffectScheduler.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/constants.mjs
init_checked_fetch();
init_modules_watch_stub();
var GLOBAL_START_EPOCH = -1;

// node_modules/@tldraw/state/dist-esm/lib/EffectScheduler.mjs
var __EffectScheduler__ = class {
  constructor(name, runEffect, options) {
    this.name = name;
    this.runEffect = runEffect;
    this._scheduleEffect = options?.scheduleEffect;
  }
  _isActivelyListening = false;
  /**
   * Whether this scheduler is attached and actively listening to its parents.
   * @public
   */
  // eslint-disable-next-line no-restricted-syntax
  get isActivelyListening() {
    return this._isActivelyListening;
  }
  /** @internal */
  lastTraversedEpoch = GLOBAL_START_EPOCH;
  lastReactedEpoch = GLOBAL_START_EPOCH;
  _scheduleCount = 0;
  /**
   * The number of times this effect has been scheduled.
   * @public
   */
  // eslint-disable-next-line no-restricted-syntax
  get scheduleCount() {
    return this._scheduleCount;
  }
  /** @internal */
  parentSet = new ArraySet();
  /** @internal */
  parentEpochs = [];
  /** @internal */
  parents = [];
  _scheduleEffect;
  /** @internal */
  maybeScheduleEffect() {
    if (!this._isActivelyListening)
      return;
    if (this.lastReactedEpoch === getGlobalEpoch())
      return;
    if (this.parents.length && !haveParentsChanged(this)) {
      this.lastReactedEpoch = getGlobalEpoch();
      return;
    }
    this.scheduleEffect();
  }
  /** @internal */
  scheduleEffect() {
    this._scheduleCount++;
    if (this._scheduleEffect) {
      this._scheduleEffect(this.maybeExecute);
    } else {
      this.execute();
    }
  }
  /** @internal */
  maybeExecute = () => {
    if (!this._isActivelyListening)
      return;
    this.execute();
  };
  /**
   * Makes this scheduler become 'actively listening' to its parents.
   * If it has been executed before it will immediately become eligible to receive 'maybeScheduleEffect' calls.
   * If it has not executed before it will need to be manually executed once to become eligible for scheduling, i.e. by calling [[EffectScheduler.execute]].
   * @public
   */
  attach() {
    this._isActivelyListening = true;
    for (let i = 0, n2 = this.parents.length; i < n2; i++) {
      attach(this.parents[i], this);
    }
  }
  /**
   * Makes this scheduler stop 'actively listening' to its parents.
   * It will no longer be eligible to receive 'maybeScheduleEffect' calls until [[EffectScheduler.attach]] is called again.
   */
  detach() {
    this._isActivelyListening = false;
    for (let i = 0, n2 = this.parents.length; i < n2; i++) {
      detach(this.parents[i], this);
    }
  }
  /**
   * Executes the effect immediately and returns the result.
   * @returns The result of the effect.
   */
  execute() {
    try {
      startCapturingParents(this);
      const currentEpoch = getGlobalEpoch();
      const result = this.runEffect(this.lastReactedEpoch);
      this.lastReactedEpoch = currentEpoch;
      return result;
    } finally {
      stopCapturingParents();
    }
  }
};
var EffectScheduler = singleton(
  "EffectScheduler",
  () => __EffectScheduler__
);

// node_modules/@tldraw/state/dist-esm/lib/transactions.mjs
var Transaction = class {
  constructor(parent) {
    this.parent = parent;
  }
  initialAtomValues = /* @__PURE__ */ new Map();
  /**
   * Get whether this transaction is a root (no parents).
   *
   * @public
   */
  // eslint-disable-next-line no-restricted-syntax
  get isRoot() {
    return this.parent === null;
  }
  /**
   * Commit the transaction's changes.
   *
   * @public
   */
  commit() {
    if (this.isRoot) {
      flushChanges(this.initialAtomValues.keys());
    } else {
      this.initialAtomValues.forEach((value, atom2) => {
        if (!this.parent.initialAtomValues.has(atom2)) {
          this.parent.initialAtomValues.set(atom2, value);
        }
      });
    }
  }
  /**
   * Abort the transaction.
   *
   * @public
   */
  abort() {
    inst2.globalEpoch++;
    this.initialAtomValues.forEach((value, atom2) => {
      atom2.set(value);
      atom2.historyBuffer?.clear();
    });
    this.commit();
  }
};
var inst2 = singleton("transactions", () => ({
  // The current epoch (global to all atoms).
  globalEpoch: GLOBAL_START_EPOCH + 1,
  // Whether any transaction is reacting.
  globalIsReacting: false,
  currentTransaction: null,
  cleanupReactors: null,
  reactionEpoch: GLOBAL_START_EPOCH + 1
}));
function getReactionEpoch() {
  return inst2.reactionEpoch;
}
function getGlobalEpoch() {
  return inst2.globalEpoch;
}
function getIsReacting() {
  return inst2.globalIsReacting;
}
function traverse(reactors, child) {
  if (child.lastTraversedEpoch === inst2.globalEpoch) {
    return;
  }
  child.lastTraversedEpoch = inst2.globalEpoch;
  if (child instanceof EffectScheduler) {
    reactors.add(child);
  } else {
    ;
    child.children.visit((c2) => traverse(reactors, c2));
  }
}
function flushChanges(atoms) {
  if (inst2.globalIsReacting) {
    throw new Error("cannot change atoms during reaction cycle");
  }
  try {
    inst2.globalIsReacting = true;
    inst2.reactionEpoch = inst2.globalEpoch;
    const reactors = /* @__PURE__ */ new Set();
    for (const atom2 of atoms) {
      atom2.children.visit((child) => traverse(reactors, child));
    }
    for (const r2 of reactors) {
      r2.maybeScheduleEffect();
    }
    let updateDepth = 0;
    while (inst2.cleanupReactors?.size) {
      if (updateDepth++ > 1e3) {
        throw new Error("Reaction update depth limit exceeded");
      }
      const reactors2 = inst2.cleanupReactors;
      inst2.cleanupReactors = null;
      for (const r2 of reactors2) {
        r2.maybeScheduleEffect();
      }
    }
  } finally {
    inst2.cleanupReactors = null;
    inst2.globalIsReacting = false;
  }
}
function atomDidChange(atom2, previousValue) {
  if (inst2.globalIsReacting) {
    const rs = inst2.cleanupReactors ??= /* @__PURE__ */ new Set();
    atom2.children.visit((child) => traverse(rs, child));
  } else if (!inst2.currentTransaction) {
    flushChanges([atom2]);
  } else if (!inst2.currentTransaction.initialAtomValues.has(atom2)) {
    inst2.currentTransaction.initialAtomValues.set(atom2, previousValue);
  }
}
function advanceGlobalEpoch() {
  inst2.globalEpoch++;
}
function transaction(fn) {
  const txn = new Transaction(inst2.currentTransaction);
  inst2.currentTransaction = txn;
  try {
    let result = void 0;
    let rollback = false;
    try {
      result = fn(() => rollback = true);
    } catch (e) {
      txn.abort();
      throw e;
    }
    if (rollback) {
      txn.abort();
    } else {
      txn.commit();
    }
    return result;
  } finally {
    inst2.currentTransaction = inst2.currentTransaction.parent;
  }
}

// node_modules/@tldraw/state/dist-esm/lib/Atom.mjs
var __Atom__ = class {
  constructor(name, current, options) {
    this.name = name;
    this.current = current;
    this.isEqual = options?.isEqual ?? null;
    if (!options)
      return;
    if (options.historyLength) {
      this.historyBuffer = new HistoryBuffer(options.historyLength);
    }
    this.computeDiff = options.computeDiff;
  }
  isEqual;
  computeDiff;
  lastChangedEpoch = getGlobalEpoch();
  children = new ArraySet();
  historyBuffer;
  __unsafe__getWithoutCapture(_ignoreErrors) {
    return this.current;
  }
  get() {
    maybeCaptureParent(this);
    return this.current;
  }
  set(value, diff) {
    if (this.isEqual?.(this.current, value) ?? equals(this.current, value)) {
      return this.current;
    }
    advanceGlobalEpoch();
    if (this.historyBuffer) {
      this.historyBuffer.pushEntry(
        this.lastChangedEpoch,
        getGlobalEpoch(),
        diff ?? this.computeDiff?.(this.current, value, this.lastChangedEpoch, getGlobalEpoch()) ?? RESET_VALUE
      );
    }
    this.lastChangedEpoch = getGlobalEpoch();
    const oldValue = this.current;
    this.current = value;
    atomDidChange(this, oldValue);
    return value;
  }
  update(updater) {
    return this.set(updater(this.current));
  }
  getDiffSince(epoch) {
    maybeCaptureParent(this);
    if (epoch >= this.lastChangedEpoch) {
      return EMPTY_ARRAY;
    }
    return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE;
  }
};
var _Atom = singleton("Atom", () => __Atom__);
function atom(name, initialValue, options) {
  return new _Atom(name, initialValue, options);
}

// node_modules/@tldraw/state/dist-esm/lib/Computed.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/warnings.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/lib/Computed.mjs
var UNINITIALIZED = Symbol.for("com.tldraw.state/UNINITIALIZED");
var WithDiff = singleton(
  "WithDiff",
  () => class WithDiff {
    constructor(value, diff) {
      this.value = value;
      this.diff = diff;
    }
  }
);
var __UNSAFE__Computed = class {
  constructor(name, derive, options) {
    this.name = name;
    this.derive = derive;
    if (options?.historyLength) {
      this.historyBuffer = new HistoryBuffer(options.historyLength);
    }
    this.computeDiff = options?.computeDiff;
    this.isEqual = options?.isEqual ?? equals;
  }
  lastChangedEpoch = GLOBAL_START_EPOCH;
  lastTraversedEpoch = GLOBAL_START_EPOCH;
  /**
   * The epoch when the reactor was last checked.
   */
  lastCheckedEpoch = GLOBAL_START_EPOCH;
  parentSet = new ArraySet();
  parents = [];
  parentEpochs = [];
  children = new ArraySet();
  // eslint-disable-next-line no-restricted-syntax
  get isActivelyListening() {
    return !this.children.isEmpty;
  }
  historyBuffer;
  // The last-computed value of this signal.
  state = UNINITIALIZED;
  // If the signal throws an error we stash it so we can rethrow it on the next get()
  error = null;
  computeDiff;
  isEqual;
  __unsafe__getWithoutCapture(ignoreErrors) {
    const isNew = this.lastChangedEpoch === GLOBAL_START_EPOCH;
    const globalEpoch = getGlobalEpoch();
    if (!isNew && (this.lastCheckedEpoch === globalEpoch || this.isActivelyListening && getIsReacting() && this.lastTraversedEpoch < getReactionEpoch() || !haveParentsChanged(this))) {
      this.lastCheckedEpoch = globalEpoch;
      if (this.error) {
        if (!ignoreErrors) {
          throw this.error.thrownValue;
        } else {
          return this.state;
        }
      } else {
        return this.state;
      }
    }
    try {
      startCapturingParents(this);
      const result = this.derive(this.state, this.lastCheckedEpoch);
      const newState = result instanceof WithDiff ? result.value : result;
      const isUninitialized2 = this.state === UNINITIALIZED;
      if (isUninitialized2 || !this.isEqual(newState, this.state)) {
        if (this.historyBuffer && !isUninitialized2) {
          const diff = result instanceof WithDiff ? result.diff : void 0;
          this.historyBuffer.pushEntry(
            this.lastChangedEpoch,
            getGlobalEpoch(),
            diff ?? this.computeDiff?.(this.state, newState, this.lastCheckedEpoch, getGlobalEpoch()) ?? RESET_VALUE
          );
        }
        this.lastChangedEpoch = getGlobalEpoch();
        this.state = newState;
      }
      this.error = null;
      this.lastCheckedEpoch = getGlobalEpoch();
      return this.state;
    } catch (e) {
      if (this.state !== UNINITIALIZED) {
        this.state = UNINITIALIZED;
        this.lastChangedEpoch = getGlobalEpoch();
      }
      this.lastCheckedEpoch = getGlobalEpoch();
      if (this.historyBuffer) {
        this.historyBuffer.clear();
      }
      this.error = { thrownValue: e };
      if (!ignoreErrors)
        throw e;
      return this.state;
    } finally {
      stopCapturingParents();
    }
  }
  get() {
    try {
      return this.__unsafe__getWithoutCapture();
    } finally {
      maybeCaptureParent(this);
    }
  }
  getDiffSince(epoch) {
    this.__unsafe__getWithoutCapture(true);
    maybeCaptureParent(this);
    if (epoch >= this.lastChangedEpoch) {
      return EMPTY_ARRAY;
    }
    return this.historyBuffer?.getChangesSince(epoch) ?? RESET_VALUE;
  }
};
var _Computed = singleton("Computed", () => __UNSAFE__Computed);

// node_modules/@tldraw/state/dist-esm/lib/isSignal.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/state/dist-esm/index.mjs
var currentApiVersion = 1;
var actualApiVersion = singleton("apiVersion", () => currentApiVersion);
if (actualApiVersion !== currentApiVersion) {
  throw new Error(
    `You have multiple incompatible versions of @tldraw/state in your app. Please deduplicate the package.`
  );
}

// node_modules/@tldraw/utils/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();
var import_lodash = __toESM(require_lodash(), 1);
var import_lodash2 = __toESM(require_lodash2(), 1);

// node_modules/@tldraw/utils/dist-esm/lib/PerformanceTracker.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/perf.mjs
init_checked_fetch();
init_modules_watch_stub();
var PERFORMANCE_COLORS = {
  Good: "#40C057",
  Mid: "#FFC078",
  Poor: "#E03131"
};
var PERFORMANCE_PREFIX_COLOR = PERFORMANCE_COLORS.Good;

// node_modules/@tldraw/utils/dist-esm/lib/array.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/cache.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/control.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/function.mjs
init_checked_fetch();
init_modules_watch_stub();
function omitFromStackTrace(fn) {
  const wrappedFn = (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      if (error instanceof Error && Error.captureStackTrace) {
        Error.captureStackTrace(error, wrappedFn);
      }
      throw error;
    }
  };
  return wrappedFn;
}

// node_modules/@tldraw/utils/dist-esm/lib/control.mjs
var Result = {
  ok(value) {
    return { ok: true, value };
  },
  err(error) {
    return { ok: false, error };
  }
};
function exhaustiveSwitchError(value, property) {
  const debugValue = property && value && typeof value === "object" && property in value ? value[property] : value;
  throw new Error(`Unknown switch case ${debugValue}`);
}
var assert = omitFromStackTrace(
  (value, message) => {
    if (!value) {
      throw new Error(message || "Assertion Error");
    }
  }
);
var assertExists = omitFromStackTrace((value, message) => {
  if (value == null) {
    throw new Error(message ?? "value must be defined");
  }
  return value;
});

// node_modules/@tldraw/utils/dist-esm/lib/debounce.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/error.mjs
init_checked_fetch();
init_modules_watch_stub();
var annotationsByError = /* @__PURE__ */ new WeakMap();
function annotateError(error, annotations) {
  if (typeof error !== "object" || error === null)
    return;
  let currentAnnotations = annotationsByError.get(error);
  if (!currentAnnotations) {
    currentAnnotations = { tags: {}, extras: {} };
    annotationsByError.set(error, currentAnnotations);
  }
  if (annotations.tags) {
    currentAnnotations.tags = {
      ...currentAnnotations.tags,
      ...annotations.tags
    };
  }
  if (annotations.extras) {
    currentAnnotations.extras = {
      ...currentAnnotations.extras,
      ...annotations.extras
    };
  }
}

// node_modules/@tldraw/utils/dist-esm/lib/file.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/network.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/hash.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/iterable.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/media/media.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/media/apng.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/media/avif.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/media/gif.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/media/png.mjs
init_checked_fetch();
init_modules_watch_stub();
var TABLE = [
  0,
  1996959894,
  3993919788,
  2567524794,
  124634137,
  1886057615,
  3915621685,
  2657392035,
  249268274,
  2044508324,
  3772115230,
  2547177864,
  162941995,
  2125561021,
  3887607047,
  2428444049,
  498536548,
  1789927666,
  4089016648,
  2227061214,
  450548861,
  1843258603,
  4107580753,
  2211677639,
  325883990,
  1684777152,
  4251122042,
  2321926636,
  335633487,
  1661365465,
  4195302755,
  2366115317,
  997073096,
  1281953886,
  3579855332,
  2724688242,
  1006888145,
  1258607687,
  3524101629,
  2768942443,
  901097722,
  1119000684,
  3686517206,
  2898065728,
  853044451,
  1172266101,
  3705015759,
  2882616665,
  651767980,
  1373503546,
  3369554304,
  3218104598,
  565507253,
  1454621731,
  3485111705,
  3099436303,
  671266974,
  1594198024,
  3322730930,
  2970347812,
  795835527,
  1483230225,
  3244367275,
  3060149565,
  1994146192,
  31158534,
  2563907772,
  4023717930,
  1907459465,
  112637215,
  2680153253,
  3904427059,
  2013776290,
  251722036,
  2517215374,
  3775830040,
  2137656763,
  141376813,
  2439277719,
  3865271297,
  1802195444,
  476864866,
  2238001368,
  4066508878,
  1812370925,
  453092731,
  2181625025,
  4111451223,
  1706088902,
  314042704,
  2344532202,
  4240017532,
  1658658271,
  366619977,
  2362670323,
  4224994405,
  1303535960,
  984961486,
  2747007092,
  3569037538,
  1256170817,
  1037604311,
  2765210733,
  3554079995,
  1131014506,
  879679996,
  2909243462,
  3663771856,
  1141124467,
  855842277,
  2852801631,
  3708648649,
  1342533948,
  654459306,
  3188396048,
  3373015174,
  1466479909,
  544179635,
  3110523913,
  3462522015,
  1591671054,
  702138776,
  2966460450,
  3352799412,
  1504918807,
  783551873,
  3082640443,
  3233442989,
  3988292384,
  2596254646,
  62317068,
  1957810842,
  3939845945,
  2647816111,
  81470997,
  1943803523,
  3814918930,
  2489596804,
  225274430,
  2053790376,
  3826175755,
  2466906013,
  167816743,
  2097651377,
  4027552580,
  2265490386,
  503444072,
  1762050814,
  4150417245,
  2154129355,
  426522225,
  1852507879,
  4275313526,
  2312317920,
  282753626,
  1742555852,
  4189708143,
  2394877945,
  397917763,
  1622183637,
  3604390888,
  2714866558,
  953729732,
  1340076626,
  3518719985,
  2797360999,
  1068828381,
  1219638859,
  3624741850,
  2936675148,
  906185462,
  1090812512,
  3747672003,
  2825379669,
  829329135,
  1181335161,
  3412177804,
  3160834842,
  628085408,
  1382605366,
  3423369109,
  3138078467,
  570562233,
  1426400815,
  3317316542,
  2998733608,
  733239954,
  1555261956,
  3268935591,
  3050360625,
  752459403,
  1541320221,
  2607071920,
  3965973030,
  1969922972,
  40735498,
  2617837225,
  3943577151,
  1913087877,
  83908371,
  2512341634,
  3803740692,
  2075208622,
  213261112,
  2463272603,
  3855990285,
  2094854071,
  198958881,
  2262029012,
  4057260610,
  1759359992,
  534414190,
  2176718541,
  4139329115,
  1873836001,
  414664567,
  2282248934,
  4279200368,
  1711684554,
  285281116,
  2405801727,
  4167216745,
  1634467795,
  376229701,
  2685067896,
  3608007406,
  1308918612,
  956543938,
  2808555105,
  3495958263,
  1231636301,
  1047427035,
  2932959818,
  3654703836,
  1088359270,
  936918e3,
  2847714899,
  3736837829,
  1202900863,
  817233897,
  3183342108,
  3401237130,
  1404277552,
  615818150,
  3134207493,
  3453421203,
  1423857449,
  601450431,
  3009837614,
  3294710456,
  1567103746,
  711928724,
  3020668471,
  3272380065,
  1510334235,
  755167117
];
if (typeof Int32Array !== "undefined") {
  TABLE = new Int32Array(TABLE);
}

// node_modules/@tldraw/utils/dist-esm/lib/media/webp.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/media/media.mjs
var DEFAULT_SUPPORTED_VECTOR_IMAGE_TYPES = Object.freeze(["image/svg+xml"]);
var DEFAULT_SUPPORTED_STATIC_IMAGE_TYPES = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp"
]);
var DEFAULT_SUPPORTED_ANIMATED_IMAGE_TYPES = Object.freeze([
  "image/gif",
  "image/apng",
  "image/avif"
]);
var DEFAULT_SUPPORTED_IMAGE_TYPES = Object.freeze([
  ...DEFAULT_SUPPORTED_STATIC_IMAGE_TYPES,
  ...DEFAULT_SUPPORTED_VECTOR_IMAGE_TYPES,
  ...DEFAULT_SUPPORTED_ANIMATED_IMAGE_TYPES
]);
var DEFAULT_SUPPORT_VIDEO_TYPES = Object.freeze([
  "video/mp4",
  "video/webm",
  "video/quicktime"
]);
var DEFAULT_SUPPORTED_MEDIA_TYPE_LIST = [
  ...DEFAULT_SUPPORTED_IMAGE_TYPES,
  ...DEFAULT_SUPPORT_VIDEO_TYPES
].join(",");

// node_modules/@tldraw/utils/dist-esm/lib/number.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/object.mjs
init_checked_fetch();
init_modules_watch_stub();
function hasOwnProperty(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
function getOwnProperty(obj, key) {
  if (!hasOwnProperty(obj, key)) {
    return void 0;
  }
  return obj[key];
}
function objectMapKeys(object2) {
  return Object.keys(object2);
}
function objectMapValues(object2) {
  return Object.values(object2);
}
function objectMapEntries(object2) {
  return Object.entries(object2);
}
function objectMapFromEntries(entries) {
  return Object.fromEntries(entries);
}
function mapObjectMapValues(object2, mapper) {
  const result = {};
  for (const [key, value] of objectMapEntries(object2)) {
    const newValue = mapper(key, value);
    result[key] = newValue;
  }
  return result;
}

// node_modules/@tldraw/utils/dist-esm/lib/reordering/reordering.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/reordering/dgreensp/dgreensp.mjs
init_checked_fetch();
init_modules_watch_stub();
var DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
var INTEGER_ZERO = "a0";
var SMALLEST_INTEGER = "A00000000000000000000000000";
function getIntegerLength(head) {
  if (head >= "a" && head <= "z") {
    return head.charCodeAt(0) - "a".charCodeAt(0) + 2;
  } else if (head >= "A" && head <= "Z") {
    return "Z".charCodeAt(0) - head.charCodeAt(0) + 2;
  } else {
    throw new Error("Invalid index key head: " + head);
  }
}
function validateInteger(int) {
  if (int.length !== getIntegerLength(int.charAt(0))) {
    throw new Error("invalid integer part of index key: " + int);
  }
}
function isNotUndefined(n2) {
  if (n2 === void 0)
    throw Error("n is undefined");
}
function incrementInteger(x) {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let carry = true;
  for (let i = digs.length - 1; carry && i >= 0; i--) {
    const d = DIGITS.indexOf(digs[i]) + 1;
    if (d === DIGITS.length) {
      digs[i] = "0";
    } else {
      digs[i] = DIGITS.charAt(d);
      carry = false;
    }
  }
  if (carry) {
    if (head === "Z")
      return "a0";
    if (head === "z")
      return void 0;
    const h2 = String.fromCharCode(head.charCodeAt(0) + 1);
    if (h2 > "a") {
      digs.push("0");
    } else {
      digs.pop();
    }
    return h2 + digs.join("");
  } else {
    return head + digs.join("");
  }
}
function decrementInteger(x) {
  validateInteger(x);
  const [head, ...digs] = x.split("");
  let borrow = true;
  for (let i = digs.length - 1; borrow && i >= 0; i--) {
    const d = DIGITS.indexOf(digs[i]) - 1;
    if (d === -1) {
      digs[i] = DIGITS.slice(-1);
    } else {
      digs[i] = DIGITS.charAt(d);
      borrow = false;
    }
  }
  if (borrow) {
    if (head === "a")
      return "Z" + DIGITS.slice(-1);
    if (head === "A")
      return void 0;
    const h2 = String.fromCharCode(head.charCodeAt(0) - 1);
    if (h2 < "Z") {
      digs.push(DIGITS.slice(-1));
    } else {
      digs.pop();
    }
    return h2 + digs.join("");
  } else {
    return head + digs.join("");
  }
}
function midpoint(a2, b) {
  if (b !== void 0 && a2 >= b) {
    throw new Error(a2 + " >= " + b);
  }
  if (a2.slice(-1) === "0" || b && b.slice(-1) === "0") {
    throw new Error("trailing zero");
  }
  if (b) {
    let n2 = 0;
    while ((a2.charAt(n2) || "0") === b.charAt(n2)) {
      n2++;
    }
    if (n2 > 0) {
      return b.slice(0, n2) + midpoint(a2.slice(n2), b.slice(n2));
    }
  }
  const digitA = a2 ? DIGITS.indexOf(a2.charAt(0)) : 0;
  const digitB = b !== void 0 ? DIGITS.indexOf(b.charAt(0)) : DIGITS.length;
  if (digitB - digitA > 1) {
    const midDigit = Math.round(0.5 * (digitA + digitB));
    return DIGITS.charAt(midDigit);
  } else {
    if (b && b.length > 1) {
      return b.slice(0, 1);
    } else {
      return DIGITS.charAt(digitA) + midpoint(a2.slice(1), void 0);
    }
  }
}
function getIntegerPart(index) {
  const integerPartLength = getIntegerLength(index.charAt(0));
  if (integerPartLength > index.length) {
    throw new Error("invalid index: " + index);
  }
  return index.slice(0, integerPartLength);
}
function validateOrder(index) {
  if (index === SMALLEST_INTEGER) {
    throw new Error("invalid index: " + index);
  }
  const i = getIntegerPart(index);
  const f2 = index.slice(i.length);
  if (f2.slice(-1) === "0") {
    throw new Error("invalid index: " + index);
  }
}
function generateKeyBetween(a2, b) {
  if (a2 !== void 0)
    validateOrder(a2);
  if (b !== void 0)
    validateOrder(b);
  if (a2 !== void 0 && b !== void 0 && a2 >= b) {
    throw new Error(a2 + " >= " + b);
  }
  if (a2 === void 0 && b === void 0) {
    return INTEGER_ZERO;
  }
  if (a2 === void 0) {
    if (b === void 0)
      throw Error("b is undefined");
    const ib2 = getIntegerPart(b);
    const fb2 = b.slice(ib2.length);
    if (ib2 === SMALLEST_INTEGER) {
      return ib2 + midpoint("", fb2);
    }
    if (ib2 < b) {
      return ib2;
    }
    const ibl = decrementInteger(ib2);
    isNotUndefined(ibl);
    return ibl;
  }
  if (b === void 0) {
    const ia2 = getIntegerPart(a2);
    const fa2 = a2.slice(ia2.length);
    const i2 = incrementInteger(ia2);
    return i2 === void 0 ? ia2 + midpoint(fa2, void 0) : i2;
  }
  const ia = getIntegerPart(a2);
  const fa = a2.slice(ia.length);
  const ib = getIntegerPart(b);
  const fb = b.slice(ib.length);
  if (ia === ib) {
    return ia + midpoint(fa, fb);
  }
  const i = incrementInteger(ia);
  isNotUndefined(i);
  return i < b ? i : ia + midpoint(fa, void 0);
}
function generateNKeysBetween(a2, b, n2) {
  if (n2 === 0)
    return [];
  if (n2 === 1)
    return [generateKeyBetween(a2, b)];
  if (b === void 0) {
    let c22 = generateKeyBetween(a2, b);
    const result = [c22];
    for (let i = 0; i < n2 - 1; i++) {
      c22 = generateKeyBetween(c22, b);
      result.push(c22);
    }
    return result;
  }
  if (a2 === void 0) {
    let c22 = generateKeyBetween(a2, b);
    const result = [c22];
    for (let i = 0; i < n2 - 1; i++) {
      c22 = generateKeyBetween(a2, c22);
      result.push(c22);
    }
    result.reverse();
    return result;
  }
  const mid = Math.floor(n2 / 2);
  const c2 = generateKeyBetween(a2, b);
  return [...generateNKeysBetween(a2, c2, mid), c2, ...generateNKeysBetween(c2, b, n2 - mid - 1)];
}

// node_modules/@tldraw/utils/dist-esm/lib/reordering/reordering.mjs
function validateIndexKey(key) {
  validateOrder(key);
}
function getIndices(n2, start = "a1") {
  return [start, ...generateNKeysBetween(start, void 0, n2)];
}
function sortByIndex(a2, b) {
  if (a2.index < b.index) {
    return -1;
  } else if (a2.index > b.index) {
    return 1;
  }
  return 0;
}

// node_modules/@tldraw/utils/dist-esm/lib/sort.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/storage.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/throttle.mjs
init_checked_fetch();
init_modules_watch_stub();
var targetFps = 60;
var targetTimePerFrame = Math.ceil(1e3 / targetFps);

// node_modules/@tldraw/utils/dist-esm/lib/timers.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/utils/dist-esm/lib/value.mjs
init_checked_fetch();
init_modules_watch_stub();
function getStructuredClone() {
  if (typeof globalThis !== "undefined" && globalThis.structuredClone) {
    return [globalThis.structuredClone, true];
  }
  if (typeof global !== "undefined" && global.structuredClone) {
    return [global.structuredClone, true];
  }
  if (typeof window !== "undefined" && window.structuredClone) {
    return [window.structuredClone, true];
  }
  return [(i) => i ? JSON.parse(JSON.stringify(i)) : i, false];
}
var _structuredClone = getStructuredClone();
var structuredClone = _structuredClone[0];
var isNativeStructuredClone = _structuredClone[1];
var STRUCTURED_CLONE_OBJECT_PROTOTYPE = Object.getPrototypeOf(structuredClone({}));

// node_modules/@tldraw/utils/dist-esm/lib/warn.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/dist-esm/lib/chunk.mjs
init_checked_fetch();
init_modules_watch_stub();
var MAX_CLIENT_SENT_MESSAGE_SIZE_BYTES = 1024 * 1024;
var MAX_BYTES_PER_CHAR = 4;
var MAX_SAFE_MESSAGE_SIZE = MAX_CLIENT_SENT_MESSAGE_SIZE_BYTES / MAX_BYTES_PER_CHAR;
var chunkRe = /^(\d+)_(.*)$/;
var JsonChunkAssembler = class {
  state = "idle";
  handleMessage(msg) {
    if (msg.startsWith("{")) {
      const error = this.state === "idle" ? void 0 : new Error("Unexpected non-chunk message");
      this.state = "idle";
      return error ? { error } : { data: JSON.parse(msg), stringified: msg };
    } else {
      const match = chunkRe.exec(msg);
      if (!match) {
        this.state = "idle";
        return { error: new Error("Invalid chunk: " + JSON.stringify(msg.slice(0, 20) + "...")) };
      }
      const numChunksRemaining = Number(match[1]);
      const data = match[2];
      if (this.state === "idle") {
        this.state = {
          chunksReceived: [data],
          totalChunks: numChunksRemaining + 1
        };
      } else {
        this.state.chunksReceived.push(data);
        if (numChunksRemaining !== this.state.totalChunks - this.state.chunksReceived.length) {
          this.state = "idle";
          return { error: new Error(`Chunks received in wrong order`) };
        }
      }
      if (this.state.chunksReceived.length === this.state.totalChunks) {
        try {
          const stringified = this.state.chunksReceived.join("");
          const data2 = JSON.parse(stringified);
          return { data: data2, stringified };
        } catch (e) {
          return { error: e };
        } finally {
          this.state = "idle";
        }
      }
      return null;
    }
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncClient.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/IncrementalSetConstructor.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/RecordType.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/nanoid/index.browser.js
init_checked_fetch();
init_modules_watch_stub();
var nanoid = (size = 21) => crypto.getRandomValues(new Uint8Array(size)).reduce((id, byte) => {
  byte &= 63;
  if (byte < 36) {
    id += byte.toString(36);
  } else if (byte < 62) {
    id += (byte - 26).toString(36).toUpperCase();
  } else if (byte > 62) {
    id += "-";
  } else {
    id += "_";
  }
  return id;
}, "");

// node_modules/@tldraw/store/dist-esm/lib/RecordType.mjs
var RecordType = class {
  constructor(typeName, config) {
    this.typeName = typeName;
    this.createDefaultProperties = config.createDefaultProperties;
    this.validator = config.validator ?? { validate: (r2) => r2 };
    this.scope = config.scope ?? "document";
    this.ephemeralKeys = config.ephemeralKeys;
    const ephemeralKeySet = /* @__PURE__ */ new Set();
    if (config.ephemeralKeys) {
      for (const [key, isEphemeral] of objectMapEntries(config.ephemeralKeys)) {
        if (isEphemeral)
          ephemeralKeySet.add(key);
      }
    }
    this.ephemeralKeySet = ephemeralKeySet;
  }
  createDefaultProperties;
  validator;
  ephemeralKeys;
  ephemeralKeySet;
  scope;
  /**
   * Create a new record of this type.
   *
   * @param properties - The properties of the record.
   * @returns The new record.
   */
  create(properties) {
    const result = { ...this.createDefaultProperties(), id: this.createId() };
    for (const [k, v] of Object.entries(properties)) {
      if (v !== void 0) {
        result[k] = v;
      }
    }
    result.typeName = this.typeName;
    return result;
  }
  /**
   * Clone a record of this type.
   *
   * @param record - The record to clone.
   * @returns The cloned record.
   * @public
   */
  clone(record) {
    return { ...structuredClone(record), id: this.createId() };
  }
  /**
   * Create a new ID for this record type.
   *
   * @example
   *
   * ```ts
   * const id = recordType.createId()
   * ```
   *
   * @returns The new ID.
   * @public
   */
  createId(customUniquePart) {
    return this.typeName + ":" + (customUniquePart ?? nanoid());
  }
  /**
   * Create a new ID for this record type based on the given ID.
   *
   * @example
   *
   * ```ts
   * const id = recordType.createCustomId('myId')
   * ```
   *
   * @deprecated - Use `createId` instead.
   * @param id - The ID to base the new ID on.
   * @returns The new ID.
   */
  createCustomId(id) {
    return this.typeName + ":" + id;
  }
  /**
   * Takes an id like `user:123` and returns the part after the colon `123`
   *
   * @param id - The id
   * @returns
   */
  parseId(id) {
    if (!this.isId(id)) {
      throw new Error(`ID "${id}" is not a valid ID for type "${this.typeName}"`);
    }
    return id.slice(this.typeName.length + 1);
  }
  /**
   * Check whether a record is an instance of this record type.
   *
   * @example
   *
   * ```ts
   * const result = recordType.isInstance(someRecord)
   * ```
   *
   * @param record - The record to check.
   * @returns Whether the record is an instance of this record type.
   */
  isInstance = (record) => {
    return record?.typeName === this.typeName;
  };
  /**
   * Check whether an id is an id of this type.
   *
   * @example
   *
   * ```ts
   * const result = recordType.isIn('someId')
   * ```
   *
   * @param id - The id to check.
   * @returns Whether the id is an id of this type.
   */
  isId(id) {
    if (!id)
      return false;
    for (let i = 0; i < this.typeName.length; i++) {
      if (id[i] !== this.typeName[i])
        return false;
    }
    return id[this.typeName.length] === ":";
  }
  /**
   * Create a new RecordType that has the same type name as this RecordType and includes the given
   * default properties.
   *
   * @example
   *
   * ```ts
   * const authorType = createRecordType('author', () => ({ living: true }))
   * const deadAuthorType = authorType.withDefaultProperties({ living: false })
   * ```
   *
   * @param fn - A function that returns the default properties of the new RecordType.
   * @returns The new RecordType.
   */
  withDefaultProperties(createDefaultProperties) {
    return new RecordType(this.typeName, {
      createDefaultProperties,
      validator: this.validator,
      scope: this.scope,
      ephemeralKeys: this.ephemeralKeys
    });
  }
  /**
   * Check that the passed in record passes the validations for this type. Returns its input
   * correctly typed if it does, but throws an error otherwise.
   */
  validate(record, recordBefore) {
    if (recordBefore && this.validator.validateUsingKnownGoodVersion) {
      return this.validator.validateUsingKnownGoodVersion(recordBefore, record);
    }
    return this.validator.validate(record);
  }
};
function createRecordType(typeName, config) {
  return new RecordType(typeName, {
    createDefaultProperties: () => ({}),
    validator: config.validator,
    scope: config.scope,
    ephemeralKeys: config.ephemeralKeys
  });
}

// node_modules/@tldraw/store/dist-esm/lib/RecordsDiff.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/Store.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/StoreQueries.mjs
init_checked_fetch();
init_modules_watch_stub();
var import_lodash3 = __toESM(require_lodash3(), 1);

// node_modules/@tldraw/store/dist-esm/lib/executeQuery.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/setUtils.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/StoreSideEffects.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/devFreeze.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/StoreSchema.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/store/dist-esm/lib/migrate.mjs
init_checked_fetch();
init_modules_watch_stub();
function squashDependsOn(sequence) {
  const result = [];
  for (let i = sequence.length - 1; i >= 0; i--) {
    const elem = sequence[i];
    if (!("id" in elem)) {
      const dependsOn = elem.dependsOn;
      const prev = result[0];
      if (prev) {
        result[0] = {
          ...prev,
          dependsOn: dependsOn.concat(prev.dependsOn ?? [])
        };
      }
    } else {
      result.unshift(elem);
    }
  }
  return result;
}
function createMigrationSequence({
  sequence,
  sequenceId,
  retroactive = true
}) {
  const migrations = {
    sequenceId,
    retroactive,
    sequence: squashDependsOn(sequence)
  };
  validateMigrations(migrations);
  return migrations;
}
function createMigrationIds(sequenceId, versions) {
  return Object.fromEntries(
    objectMapEntries(versions).map(([key, version]) => [key, `${sequenceId}/${version}`])
  );
}
function createRecordMigrationSequence(opts) {
  const sequenceId = opts.sequenceId;
  return createMigrationSequence({
    sequenceId,
    retroactive: opts.retroactive ?? true,
    sequence: opts.sequence.map(
      (m) => "id" in m ? {
        ...m,
        scope: "record",
        filter: (r2) => r2.typeName === opts.recordType && (m.filter?.(r2) ?? true) && (opts.filter?.(r2) ?? true)
      } : m
    )
  });
}
function sortMigrations(migrations) {
  const byId = new Map(migrations.map((m) => [m.id, m]));
  const isProcessing = /* @__PURE__ */ new Set();
  const result = [];
  function process2(m) {
    assert(!isProcessing.has(m.id), `Circular dependency in migrations: ${m.id}`);
    isProcessing.add(m.id);
    const { version, sequenceId } = parseMigrationId(m.id);
    const parent = byId.get(`${sequenceId}/${version - 1}`);
    if (parent) {
      process2(parent);
    }
    if (m.dependsOn) {
      for (const dep of m.dependsOn) {
        const depMigration = byId.get(dep);
        if (depMigration) {
          process2(depMigration);
        }
      }
    }
    byId.delete(m.id);
    result.push(m);
  }
  for (const m of byId.values()) {
    process2(m);
  }
  return result;
}
function parseMigrationId(id) {
  const [sequenceId, version] = id.split("/");
  return { sequenceId, version: parseInt(version) };
}
function validateMigrationId(id, expectedSequenceId) {
  if (expectedSequenceId) {
    assert(
      id.startsWith(expectedSequenceId + "/"),
      `Every migration in sequence '${expectedSequenceId}' must have an id starting with '${expectedSequenceId}/'. Got invalid id: '${id}'`
    );
  }
  assert(id.match(/^(.*?)\/(0|[1-9]\d*)$/), `Invalid migration id: '${id}'`);
}
function validateMigrations(migrations) {
  assert(
    !migrations.sequenceId.includes("/"),
    `sequenceId cannot contain a '/', got ${migrations.sequenceId}`
  );
  assert(migrations.sequenceId.length, "sequenceId must be a non-empty string");
  if (migrations.sequence.length === 0) {
    return;
  }
  validateMigrationId(migrations.sequence[0].id, migrations.sequenceId);
  let n2 = parseMigrationId(migrations.sequence[0].id).version;
  assert(
    n2 === 1,
    `Expected the first migrationId to be '${migrations.sequenceId}/1' but got '${migrations.sequence[0].id}'`
  );
  for (let i = 1; i < migrations.sequence.length; i++) {
    const id = migrations.sequence[i].id;
    validateMigrationId(id, migrations.sequenceId);
    const m = parseMigrationId(id).version;
    assert(
      m === n2 + 1,
      `Migration id numbers must increase in increments of 1, expected ${migrations.sequenceId}/${n2 + 1} but got '${migrations.sequence[i].id}'`
    );
    n2 = m;
  }
}
var MigrationFailureReason = /* @__PURE__ */ ((MigrationFailureReason2) => {
  MigrationFailureReason2["IncompatibleSubtype"] = "incompatible-subtype";
  MigrationFailureReason2["UnknownType"] = "unknown-type";
  MigrationFailureReason2["TargetVersionTooNew"] = "target-version-too-new";
  MigrationFailureReason2["TargetVersionTooOld"] = "target-version-too-old";
  MigrationFailureReason2["MigrationError"] = "migration-error";
  MigrationFailureReason2["UnrecognizedSubtype"] = "unrecognized-subtype";
  return MigrationFailureReason2;
})(MigrationFailureReason || {});

// node_modules/@tldraw/store/dist-esm/lib/StoreSchema.mjs
function upgradeSchema(schema2) {
  if (schema2.schemaVersion > 2 || schema2.schemaVersion < 1)
    return Result.err("Bad schema version");
  if (schema2.schemaVersion === 2)
    return Result.ok(schema2);
  const result = {
    schemaVersion: 2,
    sequences: {}
  };
  for (const [typeName, recordVersion] of Object.entries(schema2.recordVersions)) {
    result.sequences[`com.tldraw.${typeName}`] = recordVersion.version;
    if ("subTypeKey" in recordVersion) {
      for (const [subType, version] of Object.entries(recordVersion.subTypeVersions)) {
        result.sequences[`com.tldraw.${typeName}.${subType}`] = version;
      }
    }
  }
  return Result.ok(result);
}
var StoreSchema = class {
  constructor(types, options) {
    this.types = types;
    this.options = options;
    for (const m of options.migrations ?? []) {
      assert(!this.migrations[m.sequenceId], `Duplicate migration sequenceId ${m.sequenceId}`);
      validateMigrations(m);
      this.migrations[m.sequenceId] = m;
    }
    const allMigrations = Object.values(this.migrations).flatMap((m) => m.sequence);
    this.sortedMigrations = sortMigrations(allMigrations);
    for (const migration of this.sortedMigrations) {
      if (!migration.dependsOn?.length)
        continue;
      for (const dep of migration.dependsOn) {
        const depMigration = allMigrations.find((m) => m.id === dep);
        assert(depMigration, `Migration '${migration.id}' depends on missing migration '${dep}'`);
      }
    }
  }
  static create(types, options) {
    return new StoreSchema(types, options ?? {});
  }
  migrations = {};
  sortedMigrations;
  validateRecord(store, record, phase, recordBefore) {
    try {
      const recordType = getOwnProperty(this.types, record.typeName);
      if (!recordType) {
        throw new Error(`Missing definition for record type ${record.typeName}`);
      }
      return recordType.validate(record, recordBefore ?? void 0);
    } catch (error) {
      if (this.options.onValidationFailure) {
        return this.options.onValidationFailure({
          store,
          record,
          phase,
          recordBefore,
          error
        });
      } else {
        throw error;
      }
    }
  }
  // TODO: use a weakmap to store the result of this function
  getMigrationsSince(persistedSchema) {
    const upgradeResult = upgradeSchema(persistedSchema);
    if (!upgradeResult.ok) {
      return upgradeResult;
    }
    const schema2 = upgradeResult.value;
    const sequenceIdsToInclude = new Set(
      // start with any shared sequences
      Object.keys(schema2.sequences).filter((sequenceId) => this.migrations[sequenceId])
    );
    for (const sequenceId in this.migrations) {
      if (schema2.sequences[sequenceId] === void 0 && this.migrations[sequenceId].retroactive) {
        sequenceIdsToInclude.add(sequenceId);
      }
    }
    if (sequenceIdsToInclude.size === 0) {
      return Result.ok([]);
    }
    const allMigrationsToInclude = /* @__PURE__ */ new Set();
    for (const sequenceId of sequenceIdsToInclude) {
      const theirVersion = schema2.sequences[sequenceId];
      if (typeof theirVersion !== "number" && this.migrations[sequenceId].retroactive || theirVersion === 0) {
        for (const migration of this.migrations[sequenceId].sequence) {
          allMigrationsToInclude.add(migration.id);
        }
        continue;
      }
      const theirVersionId = `${sequenceId}/${theirVersion}`;
      const idx = this.migrations[sequenceId].sequence.findIndex((m) => m.id === theirVersionId);
      if (idx === -1) {
        return Result.err("Incompatible schema?");
      }
      for (const migration of this.migrations[sequenceId].sequence.slice(idx + 1)) {
        allMigrationsToInclude.add(migration.id);
      }
    }
    return Result.ok(this.sortedMigrations.filter(({ id }) => allMigrationsToInclude.has(id)));
  }
  migratePersistedRecord(record, persistedSchema, direction = "up") {
    const migrations = this.getMigrationsSince(persistedSchema);
    if (!migrations.ok) {
      console.error("Error migrating record", migrations.error);
      return { type: "error", reason: MigrationFailureReason.MigrationError };
    }
    let migrationsToApply = migrations.value;
    if (migrationsToApply.length === 0) {
      return { type: "success", value: record };
    }
    if (migrationsToApply.some((m) => m.scope === "store")) {
      return {
        type: "error",
        reason: direction === "down" ? MigrationFailureReason.TargetVersionTooOld : MigrationFailureReason.TargetVersionTooNew
      };
    }
    if (direction === "down") {
      if (!migrationsToApply.every((m) => m.down)) {
        return {
          type: "error",
          reason: MigrationFailureReason.TargetVersionTooOld
        };
      }
      migrationsToApply = migrationsToApply.slice().reverse();
    }
    record = structuredClone(record);
    try {
      for (const migration of migrationsToApply) {
        if (migration.scope === "store")
          throw new Error(
            /* won't happen, just for TS */
          );
        const shouldApply = migration.filter ? migration.filter(record) : true;
        if (!shouldApply)
          continue;
        const result = migration[direction](record);
        if (result) {
          record = structuredClone(result);
        }
      }
    } catch (e) {
      console.error("Error migrating record", e);
      return { type: "error", reason: MigrationFailureReason.MigrationError };
    }
    return { type: "success", value: record };
  }
  migrateStoreSnapshot(snapshot) {
    let { store } = snapshot;
    const migrations = this.getMigrationsSince(snapshot.schema);
    if (!migrations.ok) {
      console.error("Error migrating store", migrations.error);
      return { type: "error", reason: MigrationFailureReason.MigrationError };
    }
    const migrationsToApply = migrations.value;
    if (migrationsToApply.length === 0) {
      return { type: "success", value: store };
    }
    store = structuredClone(store);
    try {
      for (const migration of migrationsToApply) {
        if (migration.scope === "record") {
          for (const [id, record] of Object.entries(store)) {
            const shouldApply = migration.filter ? migration.filter(record) : true;
            if (!shouldApply)
              continue;
            const result = migration.up(record);
            if (result) {
              store[id] = structuredClone(result);
            }
          }
        } else if (migration.scope === "store") {
          const result = migration.up(store);
          if (result) {
            store = structuredClone(result);
          }
        } else {
          exhaustiveSwitchError(migration);
        }
      }
    } catch (e) {
      console.error("Error migrating store", e);
      return { type: "error", reason: MigrationFailureReason.MigrationError };
    }
    return { type: "success", value: store };
  }
  /** @internal */
  createIntegrityChecker(store) {
    return this.options.createIntegrityChecker?.(store) ?? void 0;
  }
  serialize() {
    return {
      schemaVersion: 2,
      sequences: Object.fromEntries(
        Object.values(this.migrations).map(({ sequenceId, sequence }) => [
          sequenceId,
          sequence.length ? parseMigrationId(sequence.at(-1).id).version : 0
        ])
      )
    };
  }
  /**
   * @deprecated This is only here for legacy reasons, don't use it unless you have david's blessing!
   */
  serializeEarliestVersion() {
    return {
      schemaVersion: 2,
      sequences: Object.fromEntries(
        Object.values(this.migrations).map(({ sequenceId }) => [sequenceId, 0])
      )
    };
  }
  /** @internal */
  getType(typeName) {
    const type = getOwnProperty(this.types, typeName);
    assert(type, "record type does not exists");
    return type;
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncClient.mjs
var import_lodash5 = __toESM(require_lodash3(), 1);

// node_modules/@tldraw/sync-core/dist-esm/lib/diff.mjs
init_checked_fetch();
init_modules_watch_stub();
var import_lodash4 = __toESM(require_lodash3(), 1);
var RecordOpType = {
  Put: "put",
  Patch: "patch",
  Remove: "remove"
};
var ValueOpType = {
  Put: "put",
  Delete: "delete",
  Append: "append",
  Patch: "patch"
};
function diffRecord(prev, next) {
  return diffObject(prev, next, /* @__PURE__ */ new Set(["props"]));
}
function diffObject(prev, next, nestedKeys) {
  if (prev === next) {
    return null;
  }
  let result = null;
  for (const key of Object.keys(prev)) {
    if (!(key in next)) {
      if (!result)
        result = {};
      result[key] = [ValueOpType.Delete];
      continue;
    }
    const prevVal = prev[key];
    const nextVal = next[key];
    if (!(0, import_lodash4.default)(prevVal, nextVal)) {
      if (nestedKeys?.has(key) && prevVal && nextVal) {
        const diff = diffObject(prevVal, nextVal);
        if (diff) {
          if (!result)
            result = {};
          result[key] = [ValueOpType.Patch, diff];
        }
      } else if (Array.isArray(nextVal) && Array.isArray(prevVal)) {
        const op = diffArray(prevVal, nextVal);
        if (op) {
          if (!result)
            result = {};
          result[key] = op;
        }
      } else {
        if (!result)
          result = {};
        result[key] = [ValueOpType.Put, nextVal];
      }
    }
  }
  for (const key of Object.keys(next)) {
    if (!(key in prev)) {
      if (!result)
        result = {};
      result[key] = [ValueOpType.Put, next[key]];
    }
  }
  return result;
}
function diffValue(valueA, valueB) {
  if (Object.is(valueA, valueB))
    return null;
  if (Array.isArray(valueA) && Array.isArray(valueB)) {
    return diffArray(valueA, valueB);
  } else if (!valueA || !valueB || typeof valueA !== "object" || typeof valueB !== "object") {
    return (0, import_lodash4.default)(valueA, valueB) ? null : [ValueOpType.Put, valueB];
  } else {
    const diff = diffObject(valueA, valueB);
    return diff ? [ValueOpType.Patch, diff] : null;
  }
}
function diffArray(prevArray, nextArray) {
  if (Object.is(prevArray, nextArray))
    return null;
  if (prevArray.length === nextArray.length) {
    const maxPatchIndexes = Math.max(prevArray.length / 5, 1);
    const toPatchIndexes = [];
    for (let i = 0; i < prevArray.length; i++) {
      if (!(0, import_lodash4.default)(prevArray[i], nextArray[i])) {
        toPatchIndexes.push(i);
        if (toPatchIndexes.length > maxPatchIndexes) {
          return [ValueOpType.Put, nextArray];
        }
      }
    }
    if (toPatchIndexes.length === 0) {
      return null;
    }
    const diff = {};
    for (const i of toPatchIndexes) {
      const prevItem = prevArray[i];
      const nextItem = nextArray[i];
      if (!prevItem || !nextItem) {
        diff[i] = [ValueOpType.Put, nextItem];
      } else if (typeof prevItem === "object" && typeof nextItem === "object") {
        const op = diffValue(prevItem, nextItem);
        if (op) {
          diff[i] = op;
        }
      } else {
        diff[i] = [ValueOpType.Put, nextItem];
      }
    }
    return [ValueOpType.Patch, diff];
  }
  for (let i = 0; i < prevArray.length; i++) {
    if (!(0, import_lodash4.default)(prevArray[i], nextArray[i])) {
      return [ValueOpType.Put, nextArray];
    }
  }
  return [ValueOpType.Append, nextArray.slice(prevArray.length), prevArray.length];
}
function applyObjectDiff(object2, objectDiff) {
  if (!object2 || typeof object2 !== "object")
    return object2;
  const isArray = Array.isArray(object2);
  let newObject = void 0;
  const set = (k, v) => {
    if (!newObject) {
      if (isArray) {
        newObject = [...object2];
      } else {
        newObject = { ...object2 };
      }
    }
    if (isArray) {
      newObject[Number(k)] = v;
    } else {
      newObject[k] = v;
    }
  };
  for (const [key, op] of Object.entries(objectDiff)) {
    switch (op[0]) {
      case ValueOpType.Put: {
        const value = op[1];
        if (!(0, import_lodash4.default)(object2[key], value)) {
          set(key, value);
        }
        break;
      }
      case ValueOpType.Append: {
        const values = op[1];
        const offset = op[2];
        const arr = object2[key];
        if (Array.isArray(arr) && arr.length === offset) {
          set(key, [...arr, ...values]);
        }
        break;
      }
      case ValueOpType.Patch: {
        if (object2[key] && typeof object2[key] === "object") {
          const diff = op[1];
          const patched = applyObjectDiff(object2[key], diff);
          if (patched !== object2[key]) {
            set(key, patched);
          }
        }
        break;
      }
      case ValueOpType.Delete: {
        if (key in object2) {
          if (!newObject) {
            if (isArray) {
              console.error("Can't delete array item yet (this should never happen)");
              newObject = [...object2];
            } else {
              newObject = { ...object2 };
            }
          }
          delete newObject[key];
        }
      }
    }
  }
  return newObject ?? object2;
}

// node_modules/@tldraw/sync-core/dist-esm/lib/interval.mjs
init_checked_fetch();
init_modules_watch_stub();
function interval(cb, timeout) {
  const i = setInterval(cb, timeout);
  return () => clearInterval(i);
}

// node_modules/@tldraw/sync-core/dist-esm/lib/protocol.mjs
init_checked_fetch();
init_modules_watch_stub();
var TLSYNC_PROTOCOL_VERSION = 6;
function getTlsyncProtocolVersion() {
  return TLSYNC_PROTOCOL_VERSION;
}
var TLIncompatibilityReason = {
  ClientTooOld: "clientTooOld",
  ServerTooOld: "serverTooOld",
  InvalidRecord: "invalidRecord",
  InvalidOperation: "invalidOperation",
  RoomNotFound: "roomNotFound"
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncClient.mjs
var PING_INTERVAL = 5e3;
var MAX_TIME_TO_WAIT_FOR_SERVER_INTERACTION_BEFORE_RESETTING_CONNECTION = PING_INTERVAL * 2;

// node_modules/@tldraw/sync-core/dist-esm/lib/ClientWebSocketAdapter.mjs
var INACTIVE_MAX_DELAY = 1e3 * 60 * 5;

// node_modules/@tldraw/sync-core/dist-esm/lib/RoomSession.mjs
init_checked_fetch();
init_modules_watch_stub();
var RoomSessionState = {
  AwaitingConnectMessage: "awaiting-connect-message",
  AwaitingRemoval: "awaiting-removal",
  Connected: "connected"
};
var SESSION_START_WAIT_TIME = 1e4;
var SESSION_REMOVAL_WAIT_TIME = 1e4;
var SESSION_IDLE_TIMEOUT = 2e4;

// node_modules/@tldraw/sync-core/dist-esm/lib/TLRemoteSyncError.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSocketRoom.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/assets/TLBaseAsset.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/validate/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/validate/dist-esm/lib/validation.mjs
var validation_exports = {};
__export(validation_exports, {
  ArrayOfValidator: () => ArrayOfValidator,
  DictValidator: () => DictValidator,
  ObjectValidator: () => ObjectValidator,
  UnionValidator: () => UnionValidator,
  ValidationError: () => ValidationError,
  Validator: () => Validator,
  any: () => any,
  array: () => array,
  arrayOf: () => arrayOf,
  bigint: () => bigint,
  boolean: () => boolean,
  dict: () => dict,
  httpUrl: () => httpUrl,
  indexKey: () => indexKey,
  integer: () => integer,
  jsonDict: () => jsonDict,
  jsonValue: () => jsonValue,
  linkUrl: () => linkUrl,
  literal: () => literal,
  literalEnum: () => literalEnum,
  model: () => model,
  nonZeroInteger: () => nonZeroInteger,
  nonZeroNumber: () => nonZeroNumber,
  nullable: () => nullable,
  number: () => number,
  numberUnion: () => numberUnion,
  object: () => object,
  optional: () => optional,
  positiveInteger: () => positiveInteger,
  positiveNumber: () => positiveNumber,
  setEnum: () => setEnum,
  srcUrl: () => srcUrl,
  string: () => string,
  union: () => union,
  unknown: () => unknown,
  unknownObject: () => unknownObject
});
init_checked_fetch();
init_modules_watch_stub();
function formatPath(path) {
  if (!path.length) {
    return null;
  }
  let formattedPath = "";
  for (const item of path) {
    if (typeof item === "number") {
      formattedPath += `.${item}`;
    } else if (item.startsWith("(")) {
      if (formattedPath.endsWith(")")) {
        formattedPath = `${formattedPath.slice(0, -1)}, ${item.slice(1)}`;
      } else {
        formattedPath += item;
      }
    } else {
      formattedPath += `.${item}`;
    }
  }
  formattedPath = formattedPath.replace(/id = [^,]+, /, "").replace(/id = [^)]+/, "");
  if (formattedPath.startsWith(".")) {
    return formattedPath.slice(1);
  }
  return formattedPath;
}
var ValidationError = class extends Error {
  constructor(rawMessage, path = []) {
    const formattedPath = formatPath(path);
    const indentedMessage = rawMessage.split("\n").map((line, i) => i === 0 ? line : `  ${line}`).join("\n");
    super(path ? `At ${formattedPath}: ${indentedMessage}` : indentedMessage);
    this.rawMessage = rawMessage;
    this.path = path;
  }
  name = "ValidationError";
};
function prefixError(path, fn) {
  try {
    return fn();
  } catch (err) {
    if (err instanceof ValidationError) {
      throw new ValidationError(err.rawMessage, [path, ...err.path]);
    }
    throw new ValidationError(err.toString(), [path]);
  }
}
function typeToString(value) {
  if (value === null)
    return "null";
  if (Array.isArray(value))
    return "an array";
  const type = typeof value;
  switch (type) {
    case "bigint":
    case "boolean":
    case "function":
    case "number":
    case "string":
    case "symbol":
      return `a ${type}`;
    case "object":
      return `an ${type}`;
    case "undefined":
      return "undefined";
    default:
      exhaustiveSwitchError(type);
  }
}
var Validator = class {
  constructor(validationFn, validateUsingKnownGoodVersionFn) {
    this.validationFn = validationFn;
    this.validateUsingKnownGoodVersionFn = validateUsingKnownGoodVersionFn;
  }
  /**
   * Asserts that the passed value is of the correct type and returns it. The returned value is
   * guaranteed to be referentially equal to the passed value.
   */
  validate(value) {
    const validated = this.validationFn(value);
    if (!Object.is(value, validated)) {
      throw new ValidationError("Validator functions must return the same value they were passed");
    }
    return validated;
  }
  validateUsingKnownGoodVersion(knownGoodValue, newValue) {
    if (Object.is(knownGoodValue, newValue)) {
      return knownGoodValue;
    }
    if (this.validateUsingKnownGoodVersionFn) {
      return this.validateUsingKnownGoodVersionFn(knownGoodValue, newValue);
    }
    return this.validate(newValue);
  }
  /** Checks that the passed value is of the correct type. */
  isValid(value) {
    try {
      this.validate(value);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Returns a new validator that also accepts null or undefined. The resulting value will always be
   * null.
   */
  nullable() {
    return nullable(this);
  }
  /**
   * Returns a new validator that also accepts null or undefined. The resulting value will always be
   * null.
   */
  optional() {
    return optional(this);
  }
  /**
   * Refine this validation to a new type. The passed-in validation function should throw an error
   * if the value can't be converted to the new type, or return the new type otherwise.
   */
  refine(otherValidationFn) {
    return new Validator(
      (value) => {
        return otherValidationFn(this.validate(value));
      },
      (knownGoodValue, newValue) => {
        const validated = this.validateUsingKnownGoodVersion(knownGoodValue, newValue);
        if (Object.is(knownGoodValue, validated)) {
          return knownGoodValue;
        }
        return otherValidationFn(validated);
      }
    );
  }
  check(nameOrCheckFn, checkFn) {
    if (typeof nameOrCheckFn === "string") {
      return this.refine((value) => {
        prefixError(`(check ${nameOrCheckFn})`, () => checkFn(value));
        return value;
      });
    } else {
      return this.refine((value) => {
        nameOrCheckFn(value);
        return value;
      });
    }
  }
};
var ArrayOfValidator = class extends Validator {
  constructor(itemValidator) {
    super(
      (value) => {
        const arr = array.validate(value);
        for (let i = 0; i < arr.length; i++) {
          prefixError(i, () => itemValidator.validate(arr[i]));
        }
        return arr;
      },
      (knownGoodValue, newValue) => {
        if (!itemValidator.validateUsingKnownGoodVersion)
          return this.validate(newValue);
        const arr = array.validate(newValue);
        let isDifferent = knownGoodValue.length !== arr.length;
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i];
          if (i >= knownGoodValue.length) {
            isDifferent = true;
            prefixError(i, () => itemValidator.validate(item));
            continue;
          }
          if (Object.is(knownGoodValue[i], item)) {
            continue;
          }
          const checkedItem = prefixError(
            i,
            () => itemValidator.validateUsingKnownGoodVersion(knownGoodValue[i], item)
          );
          if (!Object.is(checkedItem, knownGoodValue[i])) {
            isDifferent = true;
          }
        }
        return isDifferent ? newValue : knownGoodValue;
      }
    );
    this.itemValidator = itemValidator;
  }
  nonEmpty() {
    return this.check((value) => {
      if (value.length === 0) {
        throw new ValidationError("Expected a non-empty array");
      }
    });
  }
  lengthGreaterThan1() {
    return this.check((value) => {
      if (value.length <= 1) {
        throw new ValidationError("Expected an array with length greater than 1");
      }
    });
  }
};
var ObjectValidator = class extends Validator {
  constructor(config, shouldAllowUnknownProperties = false) {
    super(
      (object2) => {
        if (typeof object2 !== "object" || object2 === null) {
          throw new ValidationError(`Expected object, got ${typeToString(object2)}`);
        }
        for (const [key, validator] of Object.entries(config)) {
          prefixError(key, () => {
            ;
            validator.validate(getOwnProperty(object2, key));
          });
        }
        if (!shouldAllowUnknownProperties) {
          for (const key of Object.keys(object2)) {
            if (!hasOwnProperty(config, key)) {
              throw new ValidationError(`Unexpected property`, [key]);
            }
          }
        }
        return object2;
      },
      (knownGoodValue, newValue) => {
        if (typeof newValue !== "object" || newValue === null) {
          throw new ValidationError(`Expected object, got ${typeToString(newValue)}`);
        }
        let isDifferent = false;
        for (const [key, validator] of Object.entries(config)) {
          const prev = getOwnProperty(knownGoodValue, key);
          const next = getOwnProperty(newValue, key);
          if (Object.is(prev, next)) {
            continue;
          }
          const checked = prefixError(key, () => {
            const validatable = validator;
            if (validatable.validateUsingKnownGoodVersion) {
              return validatable.validateUsingKnownGoodVersion(prev, next);
            } else {
              return validatable.validate(next);
            }
          });
          if (!Object.is(checked, prev)) {
            isDifferent = true;
          }
        }
        if (!shouldAllowUnknownProperties) {
          for (const key of Object.keys(newValue)) {
            if (!hasOwnProperty(config, key)) {
              throw new ValidationError(`Unexpected property`, [key]);
            }
          }
        }
        for (const key of Object.keys(knownGoodValue)) {
          if (!hasOwnProperty(newValue, key)) {
            isDifferent = true;
            break;
          }
        }
        return isDifferent ? newValue : knownGoodValue;
      }
    );
    this.config = config;
    this.shouldAllowUnknownProperties = shouldAllowUnknownProperties;
  }
  allowUnknownProperties() {
    return new ObjectValidator(this.config, true);
  }
  /**
   * Extend an object validator by adding additional properties.
   *
   * @example
   *
   * ```ts
   * const animalValidator = T.object({
   * 	name: T.string,
   * })
   * const catValidator = animalValidator.extend({
   * 	meowVolume: T.number,
   * })
   * ```
   */
  extend(extension) {
    return new ObjectValidator({ ...this.config, ...extension });
  }
};
var UnionValidator = class extends Validator {
  constructor(key, config, unknownValueValidation, useNumberKeys) {
    super(
      (input) => {
        this.expectObject(input);
        const { matchingSchema, variant } = this.getMatchingSchemaAndVariant(input);
        if (matchingSchema === void 0) {
          return this.unknownValueValidation(input, variant);
        }
        return prefixError(`(${key} = ${variant})`, () => matchingSchema.validate(input));
      },
      (prevValue, newValue) => {
        this.expectObject(newValue);
        this.expectObject(prevValue);
        const { matchingSchema, variant } = this.getMatchingSchemaAndVariant(newValue);
        if (matchingSchema === void 0) {
          return this.unknownValueValidation(newValue, variant);
        }
        if (getOwnProperty(prevValue, key) !== getOwnProperty(newValue, key)) {
          return prefixError(`(${key} = ${variant})`, () => matchingSchema.validate(newValue));
        }
        return prefixError(`(${key} = ${variant})`, () => {
          if (matchingSchema.validateUsingKnownGoodVersion) {
            return matchingSchema.validateUsingKnownGoodVersion(prevValue, newValue);
          } else {
            return matchingSchema.validate(newValue);
          }
        });
      }
    );
    this.key = key;
    this.config = config;
    this.unknownValueValidation = unknownValueValidation;
    this.useNumberKeys = useNumberKeys;
  }
  expectObject(value) {
    if (typeof value !== "object" || value === null) {
      throw new ValidationError(`Expected an object, got ${typeToString(value)}`, []);
    }
  }
  getMatchingSchemaAndVariant(object2) {
    const variant = getOwnProperty(object2, this.key);
    if (!this.useNumberKeys && typeof variant !== "string") {
      throw new ValidationError(
        `Expected a string for key "${this.key}", got ${typeToString(variant)}`
      );
    } else if (this.useNumberKeys && !Number.isFinite(Number(variant))) {
      throw new ValidationError(`Expected a number for key "${this.key}", got "${variant}"`);
    }
    const matchingSchema = hasOwnProperty(this.config, variant) ? this.config[variant] : void 0;
    return { matchingSchema, variant };
  }
  validateUnknownVariants(unknownValueValidation) {
    return new UnionValidator(this.key, this.config, unknownValueValidation, this.useNumberKeys);
  }
};
var DictValidator = class extends Validator {
  constructor(keyValidator, valueValidator) {
    super(
      (object2) => {
        if (typeof object2 !== "object" || object2 === null) {
          throw new ValidationError(`Expected object, got ${typeToString(object2)}`);
        }
        for (const [key, value] of Object.entries(object2)) {
          prefixError(key, () => {
            keyValidator.validate(key);
            valueValidator.validate(value);
          });
        }
        return object2;
      },
      (knownGoodValue, newValue) => {
        if (typeof newValue !== "object" || newValue === null) {
          throw new ValidationError(`Expected object, got ${typeToString(newValue)}`);
        }
        let isDifferent = false;
        for (const [key, value] of Object.entries(newValue)) {
          if (!hasOwnProperty(knownGoodValue, key)) {
            isDifferent = true;
            prefixError(key, () => {
              keyValidator.validate(key);
              valueValidator.validate(value);
            });
            continue;
          }
          const prev = getOwnProperty(knownGoodValue, key);
          const next = value;
          if (Object.is(prev, next)) {
            continue;
          }
          const checked = prefixError(key, () => {
            if (valueValidator.validateUsingKnownGoodVersion) {
              return valueValidator.validateUsingKnownGoodVersion(prev, next);
            } else {
              return valueValidator.validate(next);
            }
          });
          if (!Object.is(checked, prev)) {
            isDifferent = true;
          }
        }
        for (const key of Object.keys(knownGoodValue)) {
          if (!hasOwnProperty(newValue, key)) {
            isDifferent = true;
            break;
          }
        }
        return isDifferent ? newValue : knownGoodValue;
      }
    );
    this.keyValidator = keyValidator;
    this.valueValidator = valueValidator;
  }
};
function typeofValidator(type) {
  return new Validator((value) => {
    if (typeof value !== type) {
      throw new ValidationError(`Expected ${type}, got ${typeToString(value)}`);
    }
    return value;
  });
}
var unknown = new Validator((value) => value);
var any = new Validator((value) => value);
var string = typeofValidator("string");
var number = typeofValidator("number").check((number2) => {
  if (Number.isNaN(number2)) {
    throw new ValidationError("Expected a number, got NaN");
  }
  if (!Number.isFinite(number2)) {
    throw new ValidationError(`Expected a finite number, got ${number2}`);
  }
});
var positiveNumber = number.check((value) => {
  if (value < 0)
    throw new ValidationError(`Expected a positive number, got ${value}`);
});
var nonZeroNumber = number.check((value) => {
  if (value <= 0)
    throw new ValidationError(`Expected a non-zero positive number, got ${value}`);
});
var integer = number.check((value) => {
  if (!Number.isInteger(value))
    throw new ValidationError(`Expected an integer, got ${value}`);
});
var positiveInteger = integer.check((value) => {
  if (value < 0)
    throw new ValidationError(`Expected a positive integer, got ${value}`);
});
var nonZeroInteger = integer.check((value) => {
  if (value <= 0)
    throw new ValidationError(`Expected a non-zero positive integer, got ${value}`);
});
var boolean = typeofValidator("boolean");
var bigint = typeofValidator("bigint");
function literal(expectedValue) {
  return new Validator((actualValue) => {
    if (actualValue !== expectedValue) {
      throw new ValidationError(`Expected ${expectedValue}, got ${JSON.stringify(actualValue)}`);
    }
    return expectedValue;
  });
}
var array = new Validator((value) => {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Expected an array, got ${typeToString(value)}`);
  }
  return value;
});
function arrayOf(itemValidator) {
  return new ArrayOfValidator(itemValidator);
}
var unknownObject = new Validator((value) => {
  if (typeof value !== "object" || value === null) {
    throw new ValidationError(`Expected object, got ${typeToString(value)}`);
  }
  return value;
});
function object(config) {
  return new ObjectValidator(config);
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null || Object.getPrototypeOf(value) === STRUCTURED_CLONE_OBJECT_PROTOTYPE);
}
function isValidJson(value) {
  if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isValidJson);
  }
  if (isPlainObject(value)) {
    return Object.values(value).every(isValidJson);
  }
  return false;
}
var jsonValue = new Validator(
  (value) => {
    if (isValidJson(value)) {
      return value;
    }
    throw new ValidationError(`Expected json serializable value, got ${typeof value}`);
  },
  (knownGoodValue, newValue) => {
    if (Array.isArray(knownGoodValue) && Array.isArray(newValue)) {
      let isDifferent = knownGoodValue.length !== newValue.length;
      for (let i = 0; i < newValue.length; i++) {
        if (i >= knownGoodValue.length) {
          isDifferent = true;
          jsonValue.validate(newValue[i]);
          continue;
        }
        const prev = knownGoodValue[i];
        const next = newValue[i];
        if (Object.is(prev, next)) {
          continue;
        }
        const checked = jsonValue.validateUsingKnownGoodVersion(prev, next);
        if (!Object.is(checked, prev)) {
          isDifferent = true;
        }
      }
      return isDifferent ? newValue : knownGoodValue;
    } else if (isPlainObject(knownGoodValue) && isPlainObject(newValue)) {
      let isDifferent = false;
      for (const key of Object.keys(newValue)) {
        if (!hasOwnProperty(knownGoodValue, key)) {
          isDifferent = true;
          jsonValue.validate(newValue[key]);
          continue;
        }
        const prev = knownGoodValue[key];
        const next = newValue[key];
        if (Object.is(prev, next)) {
          continue;
        }
        const checked = jsonValue.validateUsingKnownGoodVersion(prev, next);
        if (!Object.is(checked, prev)) {
          isDifferent = true;
        }
      }
      for (const key of Object.keys(knownGoodValue)) {
        if (!hasOwnProperty(newValue, key)) {
          isDifferent = true;
          break;
        }
      }
      return isDifferent ? newValue : knownGoodValue;
    } else {
      return jsonValue.validate(newValue);
    }
  }
);
function jsonDict() {
  return dict(string, jsonValue);
}
function dict(keyValidator, valueValidator) {
  return new DictValidator(keyValidator, valueValidator);
}
function union(key, config) {
  return new UnionValidator(
    key,
    config,
    (unknownValue, unknownVariant) => {
      throw new ValidationError(
        `Expected one of ${Object.keys(config).map((key2) => JSON.stringify(key2)).join(" or ")}, got ${JSON.stringify(unknownVariant)}`,
        [key]
      );
    },
    false
  );
}
function numberUnion(key, config) {
  return new UnionValidator(
    key,
    config,
    (unknownValue, unknownVariant) => {
      throw new ValidationError(
        `Expected one of ${Object.keys(config).map((key2) => JSON.stringify(key2)).join(" or ")}, got ${JSON.stringify(unknownVariant)}`,
        [key]
      );
    },
    true
  );
}
function model(name, validator) {
  return new Validator(
    (value) => {
      return prefixError(name, () => validator.validate(value));
    },
    (prevValue, newValue) => {
      return prefixError(name, () => {
        if (validator.validateUsingKnownGoodVersion) {
          return validator.validateUsingKnownGoodVersion(prevValue, newValue);
        } else {
          return validator.validate(newValue);
        }
      });
    }
  );
}
function setEnum(values) {
  return new Validator((value) => {
    if (!values.has(value)) {
      const valuesString = Array.from(values, (value2) => JSON.stringify(value2)).join(" or ");
      throw new ValidationError(`Expected ${valuesString}, got ${value}`);
    }
    return value;
  });
}
function optional(validator) {
  return new Validator(
    (value) => {
      if (value === void 0)
        return void 0;
      return validator.validate(value);
    },
    (knownGoodValue, newValue) => {
      if (knownGoodValue === void 0 && newValue === void 0)
        return void 0;
      if (newValue === void 0)
        return void 0;
      if (validator.validateUsingKnownGoodVersion && knownGoodValue !== void 0) {
        return validator.validateUsingKnownGoodVersion(knownGoodValue, newValue);
      }
      return validator.validate(newValue);
    }
  );
}
function nullable(validator) {
  return new Validator(
    (value) => {
      if (value === null)
        return null;
      return validator.validate(value);
    },
    (knownGoodValue, newValue) => {
      if (newValue === null)
        return null;
      if (validator.validateUsingKnownGoodVersion && knownGoodValue !== null) {
        return validator.validateUsingKnownGoodVersion(knownGoodValue, newValue);
      }
      return validator.validate(newValue);
    }
  );
}
function literalEnum(...values) {
  return setEnum(new Set(values));
}
function parseUrl(str) {
  try {
    return new URL(str);
  } catch (error) {
    if (str.startsWith("/") || str.startsWith("./")) {
      try {
        return new URL(str, "http://example.com");
      } catch (error2) {
        throw new ValidationError(`Expected a valid url, got ${JSON.stringify(str)}`);
      }
    }
    throw new ValidationError(`Expected a valid url, got ${JSON.stringify(str)}`);
  }
}
var validLinkProtocols = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
var linkUrl = string.check((value) => {
  if (value === "")
    return;
  const url = parseUrl(value);
  if (!validLinkProtocols.has(url.protocol.toLowerCase())) {
    throw new ValidationError(
      `Expected a valid url, got ${JSON.stringify(value)} (invalid protocol)`
    );
  }
});
var validSrcProtocols = /* @__PURE__ */ new Set(["http:", "https:", "data:", "asset:"]);
var srcUrl = string.check((value) => {
  if (value === "")
    return;
  const url = parseUrl(value);
  if (!validSrcProtocols.has(url.protocol.toLowerCase())) {
    throw new ValidationError(
      `Expected a valid url, got ${JSON.stringify(value)} (invalid protocol)`
    );
  }
});
var httpUrl = string.check((value) => {
  if (value === "")
    return;
  const url = parseUrl(value);
  if (!url.protocol.toLowerCase().match(/^https?:$/)) {
    throw new ValidationError(
      `Expected a valid url, got ${JSON.stringify(value)} (invalid protocol)`
    );
  }
});
var indexKey = string.refine((key) => {
  try {
    validateIndexKey(key);
    return key;
  } catch {
    throw new ValidationError(`Expected an index key, got ${JSON.stringify(key)}`);
  }
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/id-validator.mjs
init_checked_fetch();
init_modules_watch_stub();
function idValidator(prefix) {
  return validation_exports.string.refine((id) => {
    if (!id.startsWith(`${prefix}:`)) {
      throw new Error(`${prefix} ID must start with "${prefix}:"`);
    }
    return id;
  });
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/assets/TLBaseAsset.mjs
var assetIdValidator = idValidator("asset");
function createAssetValidator(type, props) {
  return validation_exports.object({
    id: assetIdValidator,
    typeName: validation_exports.literal("asset"),
    type: validation_exports.literal(type),
    props,
    meta: validation_exports.jsonValue
  });
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/bindings/TLArrowBinding.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/geometry-types.mjs
init_checked_fetch();
init_modules_watch_stub();
var vecModelValidator = validation_exports.object({
  x: validation_exports.number,
  y: validation_exports.number,
  z: validation_exports.number.optional()
});
var boxModelValidator = validation_exports.object({
  x: validation_exports.number,
  y: validation_exports.number,
  w: validation_exports.number,
  h: validation_exports.number
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLBinding.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/bindings/TLBaseBinding.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLBaseShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/TLOpacity.mjs
init_checked_fetch();
init_modules_watch_stub();
var opacityValidator = validation_exports.number.check((n2) => {
  if (n2 < 0 || n2 > 1) {
    throw new validation_exports.ValidationError("Opacity must be between 0 and 1");
  }
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLBaseShape.mjs
var parentIdValidator = validation_exports.string.refine((id) => {
  if (!id.startsWith("page:") && !id.startsWith("shape:")) {
    throw new Error('Parent ID must start with "page:" or "shape:"');
  }
  return id;
});
var shapeIdValidator = idValidator("shape");
function createShapeValidator(type, props, meta) {
  return validation_exports.object({
    id: shapeIdValidator,
    typeName: validation_exports.literal("shape"),
    x: validation_exports.number,
    y: validation_exports.number,
    rotation: validation_exports.number,
    index: validation_exports.indexKey,
    parentId: parentIdValidator,
    type: validation_exports.literal(type),
    isLocked: validation_exports.boolean,
    opacity: opacityValidator,
    props: props ? validation_exports.object(props) : validation_exports.jsonValue,
    meta: meta ? validation_exports.object(meta) : validation_exports.jsonValue
  });
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/bindings/TLBaseBinding.mjs
var bindingIdValidator = idValidator("binding");
function createBindingValidator(type, props, meta) {
  return validation_exports.object({
    id: bindingIdValidator,
    typeName: validation_exports.literal("binding"),
    type: validation_exports.literal(type),
    fromId: shapeIdValidator,
    toId: shapeIdValidator,
    props: props ? validation_exports.object(props) : validation_exports.jsonValue,
    meta: meta ? validation_exports.object(meta) : validation_exports.jsonValue
  });
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLBinding.mjs
var rootBindingVersions = createMigrationIds("com.tldraw.binding", {});
var rootBindingMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.binding",
  recordType: "binding",
  sequence: []
});
function createBindingId(id) {
  return `binding:${id ?? nanoid()}`;
}
function createBindingPropsMigrationSequence(migrations) {
  return migrations;
}
function createBindingRecordType(bindings) {
  return createRecordType("binding", {
    scope: "document",
    validator: validation_exports.model(
      "binding",
      validation_exports.union(
        "type",
        mapObjectMapValues(
          bindings,
          (type, { props, meta }) => createBindingValidator(type, props, meta)
        )
      )
    )
  }).withDefaultProperties(() => ({
    meta: {}
  }));
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLArrowShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/StyleProp.mjs
init_checked_fetch();
init_modules_watch_stub();
var StyleProp = class {
  /** @internal */
  constructor(id, defaultValue, type) {
    this.id = id;
    this.defaultValue = defaultValue;
    this.type = type;
  }
  /**
   * Define a new {@link StyleProp}.
   *
   * @param uniqueId - Each StyleProp must have a unique ID. We recommend you prefix this with
   * your app/library name.
   * @param options -
   * - `defaultValue`: The default value for this style prop.
   *
   * - `type`: Optionally, describe what type of data you expect for this style prop.
   *
   * @example
   * ```ts
   * import {T} from '@tldraw/validate'
   * import {StyleProp} from '@tldraw/tlschema'
   *
   * const MyLineWidthProp = StyleProp.define('myApp:lineWidth', {
   *   defaultValue: 1,
   *   type: T.number,
   * })
   * ```
   * @public
   */
  static define(uniqueId, options) {
    const { defaultValue, type = validation_exports.any } = options;
    return new StyleProp(uniqueId, defaultValue, type);
  }
  /**
   * Define a new {@link StyleProp} as a list of possible values.
   *
   * @param uniqueId - Each StyleProp must have a unique ID. We recommend you prefix this with
   * your app/library name.
   * @param options -
   * - `defaultValue`: The default value for this style prop.
   *
   * - `values`: An array of possible values of this style prop.
   *
   * @example
   * ```ts
   * import {StyleProp} from '@tldraw/tlschema'
   *
   * const MySizeProp = StyleProp.defineEnum('myApp:size', {
   *   defaultValue: 'medium',
   *   values: ['small', 'medium', 'large'],
   * })
   * ```
   */
  static defineEnum(uniqueId, options) {
    const { defaultValue, values } = options;
    return new EnumStyleProp(uniqueId, defaultValue, values);
  }
  setDefaultValue(value) {
    this.defaultValue = value;
  }
  validate(value) {
    return this.type.validate(value);
  }
  validateUsingKnownGoodVersion(prevValue, newValue) {
    if (this.type.validateUsingKnownGoodVersion) {
      return this.type.validateUsingKnownGoodVersion(prevValue, newValue);
    } else {
      return this.validate(newValue);
    }
  }
};
var EnumStyleProp = class extends StyleProp {
  /** @internal */
  constructor(id, defaultValue, values) {
    super(id, defaultValue, validation_exports.literalEnum(...values));
    this.values = values;
  }
};

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLShape.mjs
var rootShapeVersions = createMigrationIds("com.tldraw.shape", {
  AddIsLocked: 1,
  HoistOpacity: 2,
  AddMeta: 3,
  AddWhite: 4
});
var rootShapeMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.shape",
  recordType: "shape",
  sequence: [
    {
      id: rootShapeVersions.AddIsLocked,
      up: (record) => {
        record.isLocked = false;
      },
      down: (record) => {
        delete record.isLocked;
      }
    },
    {
      id: rootShapeVersions.HoistOpacity,
      up: (record) => {
        record.opacity = Number(record.props.opacity ?? "1");
        delete record.props.opacity;
      },
      down: (record) => {
        const opacity = record.opacity;
        delete record.opacity;
        record.props.opacity = opacity < 0.175 ? "0.1" : opacity < 0.375 ? "0.25" : opacity < 0.625 ? "0.5" : opacity < 0.875 ? "0.75" : "1";
      }
    },
    {
      id: rootShapeVersions.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    },
    {
      id: rootShapeVersions.AddWhite,
      up: (_record) => {
      },
      down: (record) => {
        if (record.props.color === "white") {
          record.props.color = "black";
        }
      }
    }
  ]
});
function getShapePropKeysByStyle(props) {
  const propKeysByStyle = /* @__PURE__ */ new Map();
  for (const [key, prop] of Object.entries(props)) {
    if (prop instanceof StyleProp) {
      if (propKeysByStyle.has(prop)) {
        throw new Error(
          `Duplicate style prop ${prop.id}. Each style prop can only be used once within a shape.`
        );
      }
      propKeysByStyle.set(prop, key);
    }
  }
  return propKeysByStyle;
}
function createShapePropsMigrationSequence(migrations) {
  return migrations;
}
function createShapePropsMigrationIds(shapeType, ids) {
  return mapObjectMapValues(ids, (_k, v) => `com.tldraw.shape.${shapeType}/${v}`);
}
function createShapeRecordType(shapes) {
  return createRecordType("shape", {
    scope: "document",
    validator: validation_exports.model(
      "shape",
      validation_exports.union(
        "type",
        mapObjectMapValues(
          shapes,
          (type, { props, meta }) => createShapeValidator(type, props, meta)
        )
      )
    )
  }).withDefaultProperties(() => ({
    x: 0,
    y: 0,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {}
  }));
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/recordsWithProps.mjs
init_checked_fetch();
init_modules_watch_stub();
function processPropsMigrations(typeName, records) {
  const result = [];
  for (const [subType, { migrations }] of Object.entries(records)) {
    const sequenceId = `com.tldraw.${typeName}.${subType}`;
    if (!migrations) {
      result.push(
        createMigrationSequence({
          sequenceId,
          retroactive: false,
          sequence: []
        })
      );
    } else if ("sequenceId" in migrations) {
      assert(
        sequenceId === migrations.sequenceId,
        `sequenceId mismatch for ${subType} ${RecordType} migrations. Expected '${sequenceId}', got '${migrations.sequenceId}'`
      );
      result.push(migrations);
    } else if ("sequence" in migrations) {
      result.push(
        createMigrationSequence({
          sequenceId,
          retroactive: false,
          sequence: migrations.sequence.map(
            (m) => "id" in m ? createPropsMigration(typeName, subType, m) : m
          )
        })
      );
    } else {
      result.push(
        createMigrationSequence({
          sequenceId,
          retroactive: false,
          sequence: Object.keys(migrations.migrators).map((k) => Number(k)).sort((a2, b) => a2 - b).map(
            (version) => ({
              id: `${sequenceId}/${version}`,
              scope: "record",
              filter: (r2) => r2.typeName === typeName && r2.type === subType,
              up: (record) => {
                const result2 = migrations.migrators[version].up(record);
                if (result2) {
                  return result2;
                }
              },
              down: (record) => {
                const result2 = migrations.migrators[version].down(record);
                if (result2) {
                  return result2;
                }
              }
            })
          )
        })
      );
    }
  }
  return result;
}
function createPropsMigration(typeName, subType, m) {
  return {
    id: m.id,
    dependsOn: m.dependsOn,
    scope: "record",
    filter: (r2) => r2.typeName === typeName && r2.type === subType,
    up: (record) => {
      const result = m.up(record.props);
      if (result) {
        record.props = result;
      }
    },
    down: typeof m.down === "function" ? (record) => {
      const result = m.down(record.props);
      if (result) {
        record.props = result;
      }
    } : void 0
  };
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLColorStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var defaultColorNames = [
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white"
];
var DefaultColorStyle = StyleProp.defineEnum("tldraw:color", {
  defaultValue: "black",
  values: defaultColorNames
});
var DefaultLabelColorStyle = StyleProp.defineEnum("tldraw:labelColor", {
  defaultValue: "black",
  values: defaultColorNames
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLDashStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultDashStyle = StyleProp.defineEnum("tldraw:dash", {
  defaultValue: "draw",
  values: ["draw", "solid", "dashed", "dotted"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLFillStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultFillStyle = StyleProp.defineEnum("tldraw:fill", {
  defaultValue: "none",
  values: ["none", "semi", "solid", "pattern", "fill"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLFontStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultFontStyle = StyleProp.defineEnum("tldraw:font", {
  defaultValue: "draw",
  values: ["draw", "sans", "serif", "mono"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLSizeStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultSizeStyle = StyleProp.defineEnum("tldraw:size", {
  defaultValue: "m",
  values: ["s", "m", "l", "xl"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLArrowShape.mjs
var arrowheadTypes = [
  "arrow",
  "triangle",
  "square",
  "dot",
  "pipe",
  "diamond",
  "inverted",
  "bar",
  "none"
];
var ArrowShapeArrowheadStartStyle = StyleProp.defineEnum("tldraw:arrowheadStart", {
  defaultValue: "none",
  values: arrowheadTypes
});
var ArrowShapeArrowheadEndStyle = StyleProp.defineEnum("tldraw:arrowheadEnd", {
  defaultValue: "arrow",
  values: arrowheadTypes
});
var arrowShapeProps = {
  labelColor: DefaultLabelColorStyle,
  color: DefaultColorStyle,
  fill: DefaultFillStyle,
  dash: DefaultDashStyle,
  size: DefaultSizeStyle,
  arrowheadStart: ArrowShapeArrowheadStartStyle,
  arrowheadEnd: ArrowShapeArrowheadEndStyle,
  font: DefaultFontStyle,
  start: vecModelValidator,
  end: vecModelValidator,
  bend: validation_exports.number,
  text: validation_exports.string,
  labelPosition: validation_exports.number,
  scale: validation_exports.nonZeroNumber
};
var arrowShapeVersions = createShapePropsMigrationIds("arrow", {
  AddLabelColor: 1,
  AddIsPrecise: 2,
  AddLabelPosition: 3,
  ExtractBindings: 4,
  AddScale: 5
});
function propsMigration(migration) {
  return createPropsMigration("shape", "arrow", migration);
}
var arrowShapeMigrations = createMigrationSequence({
  sequenceId: "com.tldraw.shape.arrow",
  retroactive: false,
  sequence: [
    propsMigration({
      id: arrowShapeVersions.AddLabelColor,
      up: (props) => {
        props.labelColor = "black";
      },
      down: "retired"
    }),
    propsMigration({
      id: arrowShapeVersions.AddIsPrecise,
      up: ({ start, end }) => {
        if (start.type === "binding") {
          start.isPrecise = !(start.normalizedAnchor.x === 0.5 && start.normalizedAnchor.y === 0.5);
        }
        if (end.type === "binding") {
          end.isPrecise = !(end.normalizedAnchor.x === 0.5 && end.normalizedAnchor.y === 0.5);
        }
      },
      down: ({ start, end }) => {
        if (start.type === "binding") {
          if (!start.isPrecise) {
            start.normalizedAnchor = { x: 0.5, y: 0.5 };
          }
          delete start.isPrecise;
        }
        if (end.type === "binding") {
          if (!end.isPrecise) {
            end.normalizedAnchor = { x: 0.5, y: 0.5 };
          }
          delete end.isPrecise;
        }
      }
    }),
    propsMigration({
      id: arrowShapeVersions.AddLabelPosition,
      up: (props) => {
        props.labelPosition = 0.5;
      },
      down: (props) => {
        delete props.labelPosition;
      }
    }),
    {
      id: arrowShapeVersions.ExtractBindings,
      scope: "store",
      up: (oldStore) => {
        const arrows = Object.values(oldStore).filter(
          (r2) => r2.typeName === "shape" && r2.type === "arrow"
        );
        for (const arrow of arrows) {
          const { start, end } = arrow.props;
          if (start.type === "binding") {
            const id = createBindingId();
            const binding = {
              typeName: "binding",
              id,
              type: "arrow",
              fromId: arrow.id,
              toId: start.boundShapeId,
              meta: {},
              props: {
                terminal: "start",
                normalizedAnchor: start.normalizedAnchor,
                isExact: start.isExact,
                isPrecise: start.isPrecise
              }
            };
            oldStore[id] = binding;
            arrow.props.start = { x: 0, y: 0 };
          } else {
            delete arrow.props.start.type;
          }
          if (end.type === "binding") {
            const id = createBindingId();
            const binding = {
              typeName: "binding",
              id,
              type: "arrow",
              fromId: arrow.id,
              toId: end.boundShapeId,
              meta: {},
              props: {
                terminal: "end",
                normalizedAnchor: end.normalizedAnchor,
                isExact: end.isExact,
                isPrecise: end.isPrecise
              }
            };
            oldStore[id] = binding;
            arrow.props.end = { x: 0, y: 0 };
          } else {
            delete arrow.props.end.type;
          }
        }
      }
    },
    propsMigration({
      id: arrowShapeVersions.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    })
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/bindings/TLArrowBinding.mjs
var arrowBindingProps = {
  terminal: validation_exports.literalEnum("start", "end"),
  normalizedAnchor: vecModelValidator,
  isExact: validation_exports.boolean,
  isPrecise: validation_exports.boolean
};
var arrowBindingMigrations = createBindingPropsMigrationSequence({
  sequence: [{ dependsOn: [arrowShapeVersions.ExtractBindings] }]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/createPresenceStateDerivation.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLCamera.mjs
init_checked_fetch();
init_modules_watch_stub();
var cameraValidator = validation_exports.model(
  "camera",
  validation_exports.object({
    typeName: validation_exports.literal("camera"),
    id: idValidator("camera"),
    x: validation_exports.number,
    y: validation_exports.number,
    z: validation_exports.number,
    meta: validation_exports.jsonValue
  })
);
var cameraVersions = createMigrationIds("com.tldraw.camera", {
  AddMeta: 1
});
var cameraMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.camera",
  recordType: "camera",
  sequence: [
    {
      id: cameraVersions.AddMeta,
      up: (record) => {
        ;
        record.meta = {};
      }
    }
  ]
});
var CameraRecordType = createRecordType("camera", {
  validator: cameraValidator,
  scope: "session"
}).withDefaultProperties(
  () => ({
    x: 0,
    y: 0,
    z: 1,
    meta: {}
  })
);

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLInstance.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/TLCursor.mjs
init_checked_fetch();
init_modules_watch_stub();
var TL_CURSOR_TYPES = /* @__PURE__ */ new Set([
  "none",
  "default",
  "pointer",
  "cross",
  "grab",
  "rotate",
  "grabbing",
  "resize-edge",
  "resize-corner",
  "text",
  "move",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "nesw-rotate",
  "nwse-rotate",
  "swne-rotate",
  "senw-rotate",
  "zoom-in",
  "zoom-out"
]);
var cursorTypeValidator = validation_exports.setEnum(TL_CURSOR_TYPES);
var cursorValidator = validation_exports.object({
  type: cursorTypeValidator,
  rotation: validation_exports.number
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/TLScribble.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/TLColor.mjs
init_checked_fetch();
init_modules_watch_stub();
var TL_CANVAS_UI_COLOR_TYPES = /* @__PURE__ */ new Set([
  "accent",
  "white",
  "black",
  "selection-stroke",
  "selection-fill",
  "laser",
  "muted-1"
]);
var canvasUiColorTypeValidator = validation_exports.setEnum(TL_CANVAS_UI_COLOR_TYPES);

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/TLScribble.mjs
var TL_SCRIBBLE_STATES = /* @__PURE__ */ new Set(["starting", "paused", "active", "stopping"]);
var scribbleValidator = validation_exports.object({
  id: validation_exports.string,
  points: validation_exports.arrayOf(vecModelValidator),
  size: validation_exports.positiveNumber,
  color: canvasUiColorTypeValidator,
  opacity: validation_exports.number,
  state: validation_exports.setEnum(TL_SCRIBBLE_STATES),
  delay: validation_exports.number,
  shrink: validation_exports.number,
  taper: validation_exports.boolean
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLPage.mjs
init_checked_fetch();
init_modules_watch_stub();
var pageIdValidator = idValidator("page");
var pageValidator = validation_exports.model(
  "page",
  validation_exports.object({
    typeName: validation_exports.literal("page"),
    id: pageIdValidator,
    name: validation_exports.string,
    index: validation_exports.indexKey,
    meta: validation_exports.jsonValue
  })
);
var pageVersions = createMigrationIds("com.tldraw.page", {
  AddMeta: 1
});
var pageMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.page",
  recordType: "page",
  sequence: [
    {
      id: pageVersions.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    }
  ]
});
var PageRecordType = createRecordType("page", {
  validator: pageValidator,
  scope: "document"
}).withDefaultProperties(() => ({
  meta: {}
}));

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLInstance.mjs
var instanceIdValidator = idValidator("instance");
function createInstanceRecordType(stylesById) {
  const stylesForNextShapeValidators = {};
  for (const [id, style] of stylesById) {
    stylesForNextShapeValidators[id] = validation_exports.optional(style);
  }
  const instanceTypeValidator = validation_exports.model(
    "instance",
    validation_exports.object({
      typeName: validation_exports.literal("instance"),
      id: idValidator("instance"),
      currentPageId: pageIdValidator,
      followingUserId: validation_exports.string.nullable(),
      brush: boxModelValidator.nullable(),
      opacityForNextShape: opacityValidator,
      stylesForNextShape: validation_exports.object(stylesForNextShapeValidators),
      cursor: cursorValidator,
      scribbles: validation_exports.arrayOf(scribbleValidator),
      isFocusMode: validation_exports.boolean,
      isDebugMode: validation_exports.boolean,
      isToolLocked: validation_exports.boolean,
      exportBackground: validation_exports.boolean,
      screenBounds: boxModelValidator,
      insets: validation_exports.arrayOf(validation_exports.boolean),
      zoomBrush: boxModelValidator.nullable(),
      isPenMode: validation_exports.boolean,
      isGridMode: validation_exports.boolean,
      chatMessage: validation_exports.string,
      isChatting: validation_exports.boolean,
      highlightedUserIds: validation_exports.arrayOf(validation_exports.string),
      isFocused: validation_exports.boolean,
      devicePixelRatio: validation_exports.number,
      isCoarsePointer: validation_exports.boolean,
      isHoveringCanvas: validation_exports.boolean.nullable(),
      openMenus: validation_exports.arrayOf(validation_exports.string),
      isChangingStyle: validation_exports.boolean,
      isReadonly: validation_exports.boolean,
      meta: validation_exports.jsonValue,
      duplicateProps: validation_exports.object({
        shapeIds: validation_exports.arrayOf(idValidator("shape")),
        offset: validation_exports.object({
          x: validation_exports.number,
          y: validation_exports.number
        })
      }).nullable()
    })
  );
  return createRecordType("instance", {
    validator: instanceTypeValidator,
    scope: "session",
    ephemeralKeys: {
      currentPageId: false,
      meta: false,
      followingUserId: true,
      opacityForNextShape: true,
      stylesForNextShape: true,
      brush: true,
      cursor: true,
      scribbles: true,
      isFocusMode: true,
      isDebugMode: true,
      isToolLocked: true,
      exportBackground: true,
      screenBounds: true,
      insets: true,
      zoomBrush: true,
      isPenMode: true,
      isGridMode: true,
      chatMessage: true,
      isChatting: true,
      highlightedUserIds: true,
      isFocused: true,
      devicePixelRatio: true,
      isCoarsePointer: true,
      isHoveringCanvas: true,
      openMenus: true,
      isChangingStyle: true,
      isReadonly: true,
      duplicateProps: true
    }
  }).withDefaultProperties(
    () => ({
      followingUserId: null,
      opacityForNextShape: 1,
      stylesForNextShape: {},
      brush: null,
      scribbles: [],
      cursor: {
        type: "default",
        rotation: 0
      },
      isFocusMode: false,
      exportBackground: false,
      isDebugMode: false,
      isToolLocked: false,
      screenBounds: { x: 0, y: 0, w: 1080, h: 720 },
      insets: [false, false, false, false],
      zoomBrush: null,
      isGridMode: false,
      isPenMode: false,
      chatMessage: "",
      isChatting: false,
      highlightedUserIds: [],
      isFocused: false,
      devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
      isCoarsePointer: false,
      isHoveringCanvas: null,
      openMenus: [],
      isChangingStyle: false,
      isReadonly: false,
      meta: {},
      duplicateProps: null
    })
  );
}
var instanceVersions = createMigrationIds("com.tldraw.instance", {
  AddTransparentExportBgs: 1,
  RemoveDialog: 2,
  AddToolLockMode: 3,
  RemoveExtraPropsForNextShape: 4,
  AddLabelColor: 5,
  AddFollowingUserId: 6,
  RemoveAlignJustify: 7,
  AddZoom: 8,
  AddVerticalAlign: 9,
  AddScribbleDelay: 10,
  RemoveUserId: 11,
  AddIsPenModeAndIsGridMode: 12,
  HoistOpacity: 13,
  AddChat: 14,
  AddHighlightedUserIds: 15,
  ReplacePropsForNextShapeWithStylesForNextShape: 16,
  AddMeta: 17,
  RemoveCursorColor: 18,
  AddLonelyProperties: 19,
  ReadOnlyReadonly: 20,
  AddHoveringCanvas: 21,
  AddScribbles: 22,
  AddInset: 23,
  AddDuplicateProps: 24,
  RemoveCanMoveCamera: 25
});
var instanceMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.instance",
  recordType: "instance",
  sequence: [
    {
      id: instanceVersions.AddTransparentExportBgs,
      up: (instance) => {
        return { ...instance, exportBackground: true };
      }
    },
    {
      id: instanceVersions.RemoveDialog,
      up: ({ dialog: _, ...instance }) => {
        return instance;
      }
    },
    {
      id: instanceVersions.AddToolLockMode,
      up: (instance) => {
        return { ...instance, isToolLocked: false };
      }
    },
    {
      id: instanceVersions.RemoveExtraPropsForNextShape,
      up: ({ propsForNextShape, ...instance }) => {
        return {
          ...instance,
          propsForNextShape: Object.fromEntries(
            Object.entries(propsForNextShape).filter(
              ([key]) => [
                "color",
                "labelColor",
                "dash",
                "fill",
                "size",
                "font",
                "align",
                "verticalAlign",
                "icon",
                "geo",
                "arrowheadStart",
                "arrowheadEnd",
                "spline"
              ].includes(key)
            )
          )
        };
      }
    },
    {
      id: instanceVersions.AddLabelColor,
      up: ({ propsForNextShape, ...instance }) => {
        return {
          ...instance,
          propsForNextShape: {
            ...propsForNextShape,
            labelColor: "black"
          }
        };
      }
    },
    {
      id: instanceVersions.AddFollowingUserId,
      up: (instance) => {
        return { ...instance, followingUserId: null };
      }
    },
    {
      id: instanceVersions.RemoveAlignJustify,
      up: (instance) => {
        let newAlign = instance.propsForNextShape.align;
        if (newAlign === "justify") {
          newAlign = "start";
        }
        return {
          ...instance,
          propsForNextShape: {
            ...instance.propsForNextShape,
            align: newAlign
          }
        };
      }
    },
    {
      id: instanceVersions.AddZoom,
      up: (instance) => {
        return { ...instance, zoomBrush: null };
      }
    },
    {
      id: instanceVersions.AddVerticalAlign,
      up: (instance) => {
        return {
          ...instance,
          propsForNextShape: {
            ...instance.propsForNextShape,
            verticalAlign: "middle"
          }
        };
      }
    },
    {
      id: instanceVersions.AddScribbleDelay,
      up: (instance) => {
        if (instance.scribble !== null) {
          return { ...instance, scribble: { ...instance.scribble, delay: 0 } };
        }
        return { ...instance };
      }
    },
    {
      id: instanceVersions.RemoveUserId,
      up: ({ userId: _, ...instance }) => {
        return instance;
      }
    },
    {
      id: instanceVersions.AddIsPenModeAndIsGridMode,
      up: (instance) => {
        return { ...instance, isPenMode: false, isGridMode: false };
      }
    },
    {
      id: instanceVersions.HoistOpacity,
      up: ({ propsForNextShape: { opacity, ...propsForNextShape }, ...instance }) => {
        return { ...instance, opacityForNextShape: Number(opacity ?? "1"), propsForNextShape };
      }
    },
    {
      id: instanceVersions.AddChat,
      up: (instance) => {
        return { ...instance, chatMessage: "", isChatting: false };
      }
    },
    {
      id: instanceVersions.AddHighlightedUserIds,
      up: (instance) => {
        return { ...instance, highlightedUserIds: [] };
      }
    },
    {
      id: instanceVersions.ReplacePropsForNextShapeWithStylesForNextShape,
      up: ({ propsForNextShape: _, ...instance }) => {
        return { ...instance, stylesForNextShape: {} };
      }
    },
    {
      id: instanceVersions.AddMeta,
      up: (record) => {
        return {
          ...record,
          meta: {}
        };
      }
    },
    {
      id: instanceVersions.RemoveCursorColor,
      up: (record) => {
        const { color: _, ...cursor } = record.cursor;
        return {
          ...record,
          cursor
        };
      }
    },
    {
      id: instanceVersions.AddLonelyProperties,
      up: (record) => {
        return {
          ...record,
          canMoveCamera: true,
          isFocused: false,
          devicePixelRatio: 1,
          isCoarsePointer: false,
          openMenus: [],
          isChangingStyle: false,
          isReadOnly: false
        };
      }
    },
    {
      id: instanceVersions.ReadOnlyReadonly,
      up: ({ isReadOnly: _isReadOnly, ...record }) => {
        return {
          ...record,
          isReadonly: _isReadOnly
        };
      }
    },
    {
      id: instanceVersions.AddHoveringCanvas,
      up: (record) => {
        return {
          ...record,
          isHoveringCanvas: null
        };
      }
    },
    {
      id: instanceVersions.AddScribbles,
      up: ({ scribble: _, ...record }) => {
        return {
          ...record,
          scribbles: []
        };
      }
    },
    {
      id: instanceVersions.AddInset,
      up: (record) => {
        return {
          ...record,
          insets: [false, false, false, false]
        };
      },
      down: ({ insets: _, ...record }) => {
        return {
          ...record
        };
      }
    },
    {
      id: instanceVersions.AddDuplicateProps,
      up: (record) => {
        return {
          ...record,
          duplicateProps: null
        };
      },
      down: ({ duplicateProps: _, ...record }) => {
        return {
          ...record
        };
      }
    },
    {
      id: instanceVersions.RemoveCanMoveCamera,
      up: ({ canMoveCamera: _, ...record }) => {
        return {
          ...record
        };
      },
      down: (instance) => {
        return { ...instance, canMoveCamera: true };
      }
    }
  ]
});
var TLINSTANCE_ID = "instance:instance";

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLPageState.mjs
init_checked_fetch();
init_modules_watch_stub();
var instancePageStateValidator = validation_exports.model(
  "instance_page_state",
  validation_exports.object({
    typeName: validation_exports.literal("instance_page_state"),
    id: idValidator("instance_page_state"),
    pageId: pageIdValidator,
    selectedShapeIds: validation_exports.arrayOf(shapeIdValidator),
    hintingShapeIds: validation_exports.arrayOf(shapeIdValidator),
    erasingShapeIds: validation_exports.arrayOf(shapeIdValidator),
    hoveredShapeId: shapeIdValidator.nullable(),
    editingShapeId: shapeIdValidator.nullable(),
    croppingShapeId: shapeIdValidator.nullable(),
    focusedGroupId: shapeIdValidator.nullable(),
    meta: validation_exports.jsonValue
  })
);
var instancePageStateVersions = createMigrationIds("com.tldraw.instance_page_state", {
  AddCroppingId: 1,
  RemoveInstanceIdAndCameraId: 2,
  AddMeta: 3,
  RenameProperties: 4,
  RenamePropertiesAgain: 5
});
var instancePageStateMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.instance_page_state",
  recordType: "instance_page_state",
  sequence: [
    {
      id: instancePageStateVersions.AddCroppingId,
      up(instance) {
        instance.croppingShapeId = null;
      }
    },
    {
      id: instancePageStateVersions.RemoveInstanceIdAndCameraId,
      up(instance) {
        delete instance.instanceId;
        delete instance.cameraId;
      }
    },
    {
      id: instancePageStateVersions.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    },
    {
      id: instancePageStateVersions.RenameProperties,
      // this migration is cursed: it was written wrong and doesn't do anything.
      // rather than replace it, I've added another migration below that fixes it.
      up: (_record) => {
      },
      down: (_record) => {
      }
    },
    {
      id: instancePageStateVersions.RenamePropertiesAgain,
      up: (record) => {
        record.selectedShapeIds = record.selectedIds;
        delete record.selectedIds;
        record.hintingShapeIds = record.hintingIds;
        delete record.hintingIds;
        record.erasingShapeIds = record.erasingIds;
        delete record.erasingIds;
        record.hoveredShapeId = record.hoveredId;
        delete record.hoveredId;
        record.editingShapeId = record.editingId;
        delete record.editingId;
        record.croppingShapeId = record.croppingShapeId ?? record.croppingId ?? null;
        delete record.croppingId;
        record.focusedGroupId = record.focusLayerId;
        delete record.focusLayerId;
      },
      down: (record) => {
        record.selectedIds = record.selectedShapeIds;
        delete record.selectedShapeIds;
        record.hintingIds = record.hintingShapeIds;
        delete record.hintingShapeIds;
        record.erasingIds = record.erasingShapeIds;
        delete record.erasingShapeIds;
        record.hoveredId = record.hoveredShapeId;
        delete record.hoveredShapeId;
        record.editingId = record.editingShapeId;
        delete record.editingShapeId;
        record.croppingId = record.croppingShapeId;
        delete record.croppingShapeId;
        record.focusLayerId = record.focusedGroupId;
        delete record.focusedGroupId;
      }
    }
  ]
});
var InstancePageStateRecordType = createRecordType(
  "instance_page_state",
  {
    validator: instancePageStateValidator,
    scope: "session",
    ephemeralKeys: {
      pageId: false,
      selectedShapeIds: false,
      editingShapeId: false,
      croppingShapeId: false,
      meta: false,
      hintingShapeIds: true,
      erasingShapeIds: true,
      hoveredShapeId: true,
      focusedGroupId: true
    }
  }
).withDefaultProperties(
  () => ({
    editingShapeId: null,
    croppingShapeId: null,
    selectedShapeIds: [],
    hoveredShapeId: null,
    erasingShapeIds: [],
    hintingShapeIds: [],
    focusedGroupId: null,
    meta: {}
  })
);

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLPointer.mjs
init_checked_fetch();
init_modules_watch_stub();
var pointerValidator = validation_exports.model(
  "pointer",
  validation_exports.object({
    typeName: validation_exports.literal("pointer"),
    id: idValidator("pointer"),
    x: validation_exports.number,
    y: validation_exports.number,
    lastActivityTimestamp: validation_exports.number,
    meta: validation_exports.jsonValue
  })
);
var pointerVersions = createMigrationIds("com.tldraw.pointer", {
  AddMeta: 1
});
var pointerMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.pointer",
  recordType: "pointer",
  sequence: [
    {
      id: pointerVersions.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    }
  ]
});
var PointerRecordType = createRecordType("pointer", {
  validator: pointerValidator,
  scope: "session"
}).withDefaultProperties(
  () => ({
    x: 0,
    y: 0,
    lastActivityTimestamp: 0,
    meta: {}
  })
);
var TLPOINTER_ID = PointerRecordType.createId("pointer");

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLPresence.mjs
init_checked_fetch();
init_modules_watch_stub();
var instancePresenceValidator = validation_exports.model(
  "instance_presence",
  validation_exports.object({
    typeName: validation_exports.literal("instance_presence"),
    id: idValidator("instance_presence"),
    userId: validation_exports.string,
    userName: validation_exports.string,
    lastActivityTimestamp: validation_exports.number,
    followingUserId: validation_exports.string.nullable(),
    cursor: validation_exports.object({
      x: validation_exports.number,
      y: validation_exports.number,
      type: cursorTypeValidator,
      rotation: validation_exports.number
    }),
    color: validation_exports.string,
    camera: validation_exports.object({
      x: validation_exports.number,
      y: validation_exports.number,
      z: validation_exports.number
    }),
    screenBounds: boxModelValidator,
    selectedShapeIds: validation_exports.arrayOf(idValidator("shape")),
    currentPageId: idValidator("page"),
    brush: boxModelValidator.nullable(),
    scribbles: validation_exports.arrayOf(scribbleValidator),
    chatMessage: validation_exports.string,
    meta: validation_exports.jsonValue
  })
);
var instancePresenceVersions = createMigrationIds("com.tldraw.instance_presence", {
  AddScribbleDelay: 1,
  RemoveInstanceId: 2,
  AddChatMessage: 3,
  AddMeta: 4,
  RenameSelectedShapeIds: 5
});
var instancePresenceMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.instance_presence",
  recordType: "instance_presence",
  sequence: [
    {
      id: instancePresenceVersions.AddScribbleDelay,
      up: (instance) => {
        if (instance.scribble !== null) {
          instance.scribble.delay = 0;
        }
      }
    },
    {
      id: instancePresenceVersions.RemoveInstanceId,
      up: (instance) => {
        delete instance.instanceId;
      }
    },
    {
      id: instancePresenceVersions.AddChatMessage,
      up: (instance) => {
        instance.chatMessage = "";
      }
    },
    {
      id: instancePresenceVersions.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    },
    {
      id: instancePresenceVersions.RenameSelectedShapeIds,
      up: (_record) => {
      }
    }
  ]
});
var InstancePresenceRecordType = createRecordType(
  "instance_presence",
  {
    validator: instancePresenceValidator,
    scope: "presence"
  }
).withDefaultProperties(() => ({
  lastActivityTimestamp: 0,
  followingUserId: null,
  color: "#FF0000",
  camera: {
    x: 0,
    y: 0,
    z: 1
  },
  cursor: {
    x: 0,
    y: 0,
    type: "default",
    rotation: 0
  },
  screenBounds: {
    x: 0,
    y: 0,
    w: 1,
    h: 1
  },
  selectedShapeIds: [],
  brush: null,
  scribbles: [],
  chatMessage: "",
  meta: {}
}));

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/createTLSchema.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/TLStore.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLDocument.mjs
init_checked_fetch();
init_modules_watch_stub();
var documentValidator = validation_exports.model(
  "document",
  validation_exports.object({
    typeName: validation_exports.literal("document"),
    id: validation_exports.literal("document:document"),
    gridSize: validation_exports.number,
    name: validation_exports.string,
    meta: validation_exports.jsonValue
  })
);
var documentVersions = createMigrationIds("com.tldraw.document", {
  AddName: 1,
  AddMeta: 2
});
var documentMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.document",
  recordType: "document",
  sequence: [
    {
      id: documentVersions.AddName,
      up: (document2) => {
        ;
        document2.name = "";
      },
      down: (document2) => {
        delete document2.name;
      }
    },
    {
      id: documentVersions.AddMeta,
      up: (record) => {
        ;
        record.meta = {};
      }
    }
  ]
});
var DocumentRecordType = createRecordType("document", {
  validator: documentValidator,
  scope: "document"
}).withDefaultProperties(
  () => ({
    gridSize: 10,
    name: "",
    meta: {}
  })
);
var TLDOCUMENT_ID = DocumentRecordType.createId("document");

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/TLStore.mjs
function sortByIndex2(a2, b) {
  if (a2.index < b.index) {
    return -1;
  } else if (a2.index > b.index) {
    return 1;
  }
  return 0;
}
function redactRecordForErrorReporting(record) {
  if (record.typeName === "asset") {
    if ("src" in record) {
      record.src = "<redacted>";
    }
    if ("src" in record.props) {
      record.props.src = "<redacted>";
    }
  }
}
var onValidationFailure = ({ error, phase, record, recordBefore }) => {
  const isExistingValidationIssue = (
    // if we're initializing the store for the first time, we should
    // allow invalid records so people can load old buggy data:
    phase === "initialize"
  );
  annotateError(error, {
    tags: {
      origin: "store.validateRecord",
      storePhase: phase,
      isExistingValidationIssue
    },
    extras: {
      recordBefore: recordBefore ? redactRecordForErrorReporting(structuredClone(recordBefore)) : void 0,
      recordAfter: redactRecordForErrorReporting(structuredClone(record))
    }
  });
  throw error;
};
function getDefaultPages() {
  return [
    PageRecordType.create({
      id: "page:page",
      name: "Page 1",
      index: "a1",
      meta: {}
    })
  ];
}
function createIntegrityChecker(store) {
  const $pageIds = store.query.ids("page");
  const ensureStoreIsUsable = () => {
    if (!store.has(TLDOCUMENT_ID)) {
      store.put([DocumentRecordType.create({ id: TLDOCUMENT_ID, name: store.props.defaultName })]);
      return ensureStoreIsUsable();
    }
    if (!store.has(TLPOINTER_ID)) {
      store.put([PointerRecordType.create({ id: TLPOINTER_ID })]);
      return ensureStoreIsUsable();
    }
    const pageIds = $pageIds.get();
    if (pageIds.size === 0) {
      store.put(getDefaultPages());
      return ensureStoreIsUsable();
    }
    const getFirstPageId = () => [...pageIds].map((id) => store.get(id)).sort(sortByIndex2)[0].id;
    const instanceState = store.get(TLINSTANCE_ID);
    if (!instanceState) {
      store.put([
        store.schema.types.instance.create({
          id: TLINSTANCE_ID,
          currentPageId: getFirstPageId(),
          exportBackground: true
        })
      ]);
      return ensureStoreIsUsable();
    } else if (!pageIds.has(instanceState.currentPageId)) {
      store.put([{ ...instanceState, currentPageId: getFirstPageId() }]);
      return ensureStoreIsUsable();
    }
    const missingPageStateIds = /* @__PURE__ */ new Set();
    const missingCameraIds = /* @__PURE__ */ new Set();
    for (const id of pageIds) {
      const pageStateId = InstancePageStateRecordType.createId(id);
      if (!store.has(pageStateId)) {
        missingPageStateIds.add(pageStateId);
      }
      const cameraId = CameraRecordType.createId(id);
      if (!store.has(cameraId)) {
        missingCameraIds.add(cameraId);
      }
    }
    if (missingPageStateIds.size > 0) {
      store.put(
        [...missingPageStateIds].map(
          (id) => InstancePageStateRecordType.create({
            id,
            pageId: InstancePageStateRecordType.parseId(id)
          })
        )
      );
    }
    if (missingCameraIds.size > 0) {
      store.put([...missingCameraIds].map((id) => CameraRecordType.create({ id })));
    }
  };
  return ensureStoreIsUsable;
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/assets/TLBookmarkAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var bookmarkAssetValidator = createAssetValidator(
  "bookmark",
  validation_exports.object({
    title: validation_exports.string,
    description: validation_exports.string,
    image: validation_exports.string,
    favicon: validation_exports.string,
    src: validation_exports.srcUrl.nullable()
  })
);
var Versions = createMigrationIds("com.tldraw.asset.bookmark", {
  MakeUrlsValid: 1,
  AddFavicon: 2
});
var bookmarkAssetMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset.bookmark",
  recordType: "asset",
  filter: (asset) => asset.type === "bookmark",
  sequence: [
    {
      id: Versions.MakeUrlsValid,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.src)) {
          asset.props.src = "";
        }
      },
      down: (_asset) => {
      }
    },
    {
      id: Versions.AddFavicon,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.favicon)) {
          asset.props.favicon = "";
        }
      },
      down: (asset) => {
        delete asset.props.favicon;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/assets/TLImageAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var imageAssetValidator = createAssetValidator(
  "image",
  validation_exports.object({
    w: validation_exports.number,
    h: validation_exports.number,
    name: validation_exports.string,
    isAnimated: validation_exports.boolean,
    mimeType: validation_exports.string.nullable(),
    src: validation_exports.srcUrl.nullable(),
    fileSize: validation_exports.nonZeroNumber.optional()
  })
);
var Versions2 = createMigrationIds("com.tldraw.asset.image", {
  AddIsAnimated: 1,
  RenameWidthHeight: 2,
  MakeUrlsValid: 3,
  AddFileSize: 4,
  MakeFileSizeOptional: 5
});
var imageAssetMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset.image",
  recordType: "asset",
  filter: (asset) => asset.type === "image",
  sequence: [
    {
      id: Versions2.AddIsAnimated,
      up: (asset) => {
        asset.props.isAnimated = false;
      },
      down: (asset) => {
        delete asset.props.isAnimated;
      }
    },
    {
      id: Versions2.RenameWidthHeight,
      up: (asset) => {
        asset.props.w = asset.props.width;
        asset.props.h = asset.props.height;
        delete asset.props.width;
        delete asset.props.height;
      },
      down: (asset) => {
        asset.props.width = asset.props.w;
        asset.props.height = asset.props.h;
        delete asset.props.w;
        delete asset.props.h;
      }
    },
    {
      id: Versions2.MakeUrlsValid,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.src)) {
          asset.props.src = "";
        }
      },
      down: (_asset) => {
      }
    },
    {
      id: Versions2.AddFileSize,
      up: (asset) => {
        asset.props.fileSize = -1;
      },
      down: (asset) => {
        delete asset.props.fileSize;
      }
    },
    {
      id: Versions2.MakeFileSizeOptional,
      up: (asset) => {
        if (asset.props.fileSize === -1) {
          asset.props.fileSize = void 0;
        }
      },
      down: (asset) => {
        if (asset.props.fileSize === void 0) {
          asset.props.fileSize = -1;
        }
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/assets/TLVideoAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var videoAssetValidator = createAssetValidator(
  "video",
  validation_exports.object({
    w: validation_exports.number,
    h: validation_exports.number,
    name: validation_exports.string,
    isAnimated: validation_exports.boolean,
    mimeType: validation_exports.string.nullable(),
    src: validation_exports.srcUrl.nullable(),
    fileSize: validation_exports.number.optional()
  })
);
var Versions3 = createMigrationIds("com.tldraw.asset.video", {
  AddIsAnimated: 1,
  RenameWidthHeight: 2,
  MakeUrlsValid: 3,
  AddFileSize: 4,
  MakeFileSizeOptional: 5
});
var videoAssetMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset.video",
  recordType: "asset",
  filter: (asset) => asset.type === "video",
  sequence: [
    {
      id: Versions3.AddIsAnimated,
      up: (asset) => {
        asset.props.isAnimated = false;
      },
      down: (asset) => {
        delete asset.props.isAnimated;
      }
    },
    {
      id: Versions3.RenameWidthHeight,
      up: (asset) => {
        asset.props.w = asset.props.width;
        asset.props.h = asset.props.height;
        delete asset.props.width;
        delete asset.props.height;
      },
      down: (asset) => {
        asset.props.width = asset.props.w;
        asset.props.height = asset.props.h;
        delete asset.props.w;
        delete asset.props.h;
      }
    },
    {
      id: Versions3.MakeUrlsValid,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.src)) {
          asset.props.src = "";
        }
      },
      down: (_asset) => {
      }
    },
    {
      id: Versions3.AddFileSize,
      up: (asset) => {
        asset.props.fileSize = -1;
      },
      down: (asset) => {
        delete asset.props.fileSize;
      }
    },
    {
      id: Versions3.MakeFileSizeOptional,
      up: (asset) => {
        if (asset.props.fileSize === -1) {
          asset.props.fileSize = void 0;
        }
      },
      down: (asset) => {
        if (asset.props.fileSize === void 0) {
          asset.props.fileSize = -1;
        }
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/records/TLAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var assetValidator = validation_exports.model(
  "asset",
  validation_exports.union("type", {
    image: imageAssetValidator,
    video: videoAssetValidator,
    bookmark: bookmarkAssetValidator
  })
);
var assetVersions = createMigrationIds("com.tldraw.asset", {
  AddMeta: 1
});
var assetMigrations = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset",
  recordType: "asset",
  sequence: [
    {
      id: assetVersions.AddMeta,
      up: (record) => {
        ;
        record.meta = {};
      }
    }
  ]
});
var AssetRecordType = createRecordType("asset", {
  validator: assetValidator,
  scope: "document"
}).withDefaultProperties(() => ({
  meta: {}
}));

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLBookmarkShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var bookmarkShapeProps = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  assetId: assetIdValidator.nullable(),
  url: validation_exports.linkUrl
};
var Versions4 = createShapePropsMigrationIds("bookmark", {
  NullAssetId: 1,
  MakeUrlsValid: 2
});
var bookmarkShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions4.NullAssetId,
      up: (props) => {
        if (props.assetId === void 0) {
          props.assetId = null;
        }
      },
      down: "retired"
    },
    {
      id: Versions4.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLDrawShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var DrawShapeSegment = validation_exports.object({
  type: validation_exports.literalEnum("free", "straight"),
  points: validation_exports.arrayOf(vecModelValidator)
});
var drawShapeProps = {
  color: DefaultColorStyle,
  fill: DefaultFillStyle,
  dash: DefaultDashStyle,
  size: DefaultSizeStyle,
  segments: validation_exports.arrayOf(DrawShapeSegment),
  isComplete: validation_exports.boolean,
  isClosed: validation_exports.boolean,
  isPen: validation_exports.boolean,
  scale: validation_exports.nonZeroNumber
};
var Versions5 = createShapePropsMigrationIds("draw", {
  AddInPen: 1,
  AddScale: 2
});
var drawShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions5.AddInPen,
      up: (props) => {
        const { points } = props.segments[0];
        if (points.length === 0) {
          props.isPen = false;
          return;
        }
        let isPen = !(points[0].z === 0 || points[0].z === 0.5);
        if (points[1]) {
          isPen = isPen && !(points[1].z === 0 || points[1].z === 0.5);
        }
        props.isPen = isPen;
      },
      down: "retired"
    },
    {
      id: Versions5.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLEmbedShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var TLDRAW_APP_RE = /(^\/r\/[^/]+\/?$)/;
var safeParseUrl = (url) => {
  try {
    return new URL(url);
  } catch (err) {
    return;
  }
};
var EMBED_DEFINITIONS = [
  {
    type: "tldraw",
    title: "tldraw",
    hostnames: ["beta.tldraw.com", "tldraw.com", "localhost:3000"],
    minWidth: 300,
    minHeight: 300,
    width: 720,
    height: 500,
    doesResize: true,
    overridePermissions: {
      "allow-top-navigation": true
    },
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(TLDRAW_APP_RE)) {
        return url;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(TLDRAW_APP_RE)) {
        return url;
      }
      return;
    }
  },
  {
    type: "figma",
    title: "Figma",
    hostnames: ["figma.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      if (!!url.match(
        // eslint-disable-next-line no-useless-escape
        /https:\/\/([\w\.-]+\.)?figma.com\/(file|proto)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/
      ) && !url.includes("figma.com/embed")) {
        return `https://www.figma.com/embed?embed_host=share&url=${url}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/?$/)) {
        const outUrl = urlObj.searchParams.get("url");
        if (outUrl) {
          return outUrl;
        }
      }
      return;
    }
  },
  {
    type: "google_maps",
    title: "Google Maps",
    hostnames: ["google.*"],
    width: 720,
    height: 500,
    doesResize: true,
    overridePermissions: {
      "allow-presentation": true
    },
    toEmbedUrl: (url) => {
      if (url.includes("/maps/")) {
        const match = url.match(/@(.*),(.*),(.*)z/);
        let result;
        if (match) {
          const [, lat, lng, z] = match;
          const host = new URL(url).host.replace("www.", "");
          result = `https://${host}/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GC_API_KEY}&center=${lat},${lng}&zoom=${z}`;
        } else {
          result = "";
        }
        return result;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (!urlObj)
        return;
      const matches = urlObj.pathname.match(/^\/maps\/embed\/v1\/view\/?$/);
      if (matches && urlObj.searchParams.has("center") && urlObj.searchParams.get("zoom")) {
        const zoom = urlObj.searchParams.get("zoom");
        const [lat, lon] = urlObj.searchParams.get("center").split(",");
        return `https://www.google.com/maps/@${lat},${lon},${zoom}z`;
      }
      return;
    }
  },
  {
    type: "val_town",
    title: "Val Town",
    hostnames: ["val.town"],
    minWidth: 260,
    minHeight: 100,
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      const matches = urlObj && urlObj.pathname.match(/\/v\/(.+)\/?/);
      if (matches) {
        return `https://www.val.town/embed/${matches[1]}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      const matches = urlObj && urlObj.pathname.match(/\/embed\/(.+)\/?/);
      if (matches) {
        return `https://www.val.town/v/${matches[1]}`;
      }
      return;
    }
  },
  {
    type: "codesandbox",
    title: "CodeSandbox",
    hostnames: ["codesandbox.io"],
    minWidth: 300,
    minHeight: 300,
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      const matches = urlObj && urlObj.pathname.match(/\/s\/([^/]+)\/?/);
      if (matches) {
        return `https://codesandbox.io/embed/${matches[1]}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      const matches = urlObj && urlObj.pathname.match(/\/embed\/([^/]+)\/?/);
      if (matches) {
        return `https://codesandbox.io/s/${matches[1]}`;
      }
      return;
    }
  },
  {
    type: "codepen",
    title: "Codepen",
    hostnames: ["codepen.io"],
    minWidth: 300,
    minHeight: 300,
    width: 520,
    height: 400,
    doesResize: true,
    toEmbedUrl: (url) => {
      const CODEPEN_URL_REGEXP = /https:\/\/codepen.io\/([^/]+)\/pen\/([^/]+)/;
      const matches = url.match(CODEPEN_URL_REGEXP);
      if (matches) {
        const [_, user, id] = matches;
        return `https://codepen.io/${user}/embed/${id}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const CODEPEN_EMBED_REGEXP = /https:\/\/codepen.io\/([^/]+)\/embed\/([^/]+)/;
      const matches = url.match(CODEPEN_EMBED_REGEXP);
      if (matches) {
        const [_, user, id] = matches;
        return `https://codepen.io/${user}/pen/${id}`;
      }
      return;
    }
  },
  {
    type: "scratch",
    title: "Scratch",
    hostnames: ["scratch.mit.edu"],
    width: 520,
    height: 400,
    doesResize: false,
    toEmbedUrl: (url) => {
      const SCRATCH_URL_REGEXP = /https?:\/\/scratch.mit.edu\/projects\/([^/]+)/;
      const matches = url.match(SCRATCH_URL_REGEXP);
      if (matches) {
        const [_, id] = matches;
        return `https://scratch.mit.edu/projects/embed/${id}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const SCRATCH_EMBED_REGEXP = /https:\/\/scratch.mit.edu\/projects\/embed\/([^/]+)/;
      const matches = url.match(SCRATCH_EMBED_REGEXP);
      if (matches) {
        const [_, id] = matches;
        return `https://scratch.mit.edu/projects/${id}`;
      }
      return;
    }
  },
  {
    type: "youtube",
    title: "YouTube",
    hostnames: ["*.youtube.com", "youtube.com", "youtu.be"],
    width: 800,
    height: 450,
    doesResize: true,
    overridePermissions: {
      "allow-presentation": true,
      "allow-popups-to-escape-sandbox": true
    },
    isAspectRatioLocked: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (!urlObj)
        return;
      const hostname = urlObj.hostname.replace(/^www./, "");
      if (hostname === "youtu.be") {
        const videoId = urlObj.pathname.split("/").filter(Boolean)[0];
        return `https://www.youtube.com/embed/${videoId}`;
      } else if ((hostname === "youtube.com" || hostname === "m.youtube.com") && urlObj.pathname.match(/^\/watch/)) {
        const videoId = urlObj.searchParams.get("v");
        return `https://www.youtube.com/embed/${videoId}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (!urlObj)
        return;
      const hostname = urlObj.hostname.replace(/^www./, "");
      if (hostname === "youtube.com") {
        const matches = urlObj.pathname.match(/^\/embed\/([^/]+)\/?/);
        if (matches) {
          return `https://www.youtube.com/watch?v=${matches[1]}`;
        }
      }
      return;
    }
  },
  {
    type: "google_calendar",
    title: "Google Calendar",
    hostnames: ["calendar.google.*"],
    width: 720,
    height: 500,
    minWidth: 460,
    minHeight: 360,
    doesResize: true,
    instructionLink: "https://support.google.com/calendar/answer/41207?hl=en",
    overridePermissions: {
      "allow-popups-to-escape-sandbox": true
    },
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      const cidQs = urlObj?.searchParams.get("cid");
      if (urlObj?.pathname.match(/\/calendar\/u\/0/) && cidQs) {
        urlObj.pathname = "/calendar/embed";
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        urlObj.searchParams.set("src", cidQs);
        return urlObj.href;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      const srcQs = urlObj?.searchParams.get("src");
      if (urlObj?.pathname.match(/\/calendar\/embed/) && srcQs) {
        urlObj.pathname = "/calendar/u/0";
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        urlObj.searchParams.set("cid", srcQs);
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "google_slides",
    title: "Google Slides",
    hostnames: ["docs.google.*"],
    width: 720,
    height: 500,
    minWidth: 460,
    minHeight: 360,
    doesResize: true,
    overridePermissions: {
      "allow-popups-to-escape-sandbox": true
    },
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj?.pathname.match(/^\/presentation/) && urlObj?.pathname.match(/\/pub\/?$/)) {
        urlObj.pathname = urlObj.pathname.replace(/\/pub$/, "/embed");
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        return urlObj.href;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj?.pathname.match(/^\/presentation/) && urlObj?.pathname.match(/\/embed\/?$/)) {
        urlObj.pathname = urlObj.pathname.replace(/\/embed$/, "/pub");
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "github_gist",
    title: "GitHub Gist",
    hostnames: ["gist.github.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/\/([^/]+)\/([^/]+)/)) {
        if (!url.split("/").pop())
          return;
        return url;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/\/([^/]+)\/([^/]+)/)) {
        if (!url.split("/").pop())
          return;
        return url;
      }
      return;
    }
  },
  {
    type: "replit",
    title: "Replit",
    hostnames: ["replit.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/\/@([^/]+)\/([^/]+)/)) {
        return `${url}?embed=true`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/\/@([^/]+)\/([^/]+)/) && urlObj.searchParams.has("embed")) {
        urlObj.searchParams.delete("embed");
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "felt",
    title: "Felt",
    hostnames: ["felt.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/map\//)) {
        return urlObj.origin + "/embed" + urlObj.pathname;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/map\//)) {
        urlObj.pathname = urlObj.pathname.replace(/^\/embed/, "");
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "spotify",
    title: "Spotify",
    hostnames: ["open.spotify.com"],
    width: 720,
    height: 500,
    minHeight: 500,
    overrideOutlineRadius: 12,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/(artist|album)\//)) {
        return urlObj.origin + "/embed" + urlObj.pathname;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/(artist|album)\//)) {
        return urlObj.origin + urlObj.pathname.replace(/^\/embed/, "");
      }
      return;
    }
  },
  {
    type: "vimeo",
    title: "Vimeo",
    hostnames: ["vimeo.com", "player.vimeo.com"],
    width: 640,
    height: 360,
    doesResize: true,
    isAspectRatioLocked: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.hostname === "vimeo.com") {
        if (urlObj.pathname.match(/^\/[0-9]+/)) {
          return "https://player.vimeo.com/video/" + urlObj.pathname.split("/")[1] + "?title=0&byline=0";
        }
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.hostname === "player.vimeo.com") {
        const matches = urlObj.pathname.match(/^\/video\/([^/]+)\/?$/);
        if (matches) {
          return "https://vimeo.com/" + matches[1];
        }
      }
      return;
    }
  },
  {
    type: "excalidraw",
    title: "Excalidraw",
    hostnames: ["excalidraw.com"],
    width: 720,
    height: 500,
    doesResize: true,
    isAspectRatioLocked: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.hash.match(/#room=/)) {
        return url;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.hash.match(/#room=/)) {
        return url;
      }
      return;
    }
  },
  {
    type: "observable",
    title: "Observable",
    hostnames: ["observablehq.com"],
    width: 720,
    height: 500,
    doesResize: true,
    isAspectRatioLocked: false,
    backgroundColor: "#fff",
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/@([^/]+)\/([^/]+)\/?$/)) {
        return `${urlObj.origin}/embed${urlObj.pathname}?cell=*`;
      }
      if (urlObj && urlObj.pathname.match(/^\/d\/([^/]+)\/?$/)) {
        const pathName = urlObj.pathname.replace(/^\/d/, "");
        return `${urlObj.origin}/embed${pathName}?cell=*`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/@([^/]+)\/([^/]+)\/?$/)) {
        return `${urlObj.origin}${urlObj.pathname.replace("/embed", "")}#cell-*`;
      }
      if (urlObj && urlObj.pathname.match(/^\/embed\/([^/]+)\/?$/)) {
        return `${urlObj.origin}${urlObj.pathname.replace("/embed", "/d")}#cell-*`;
      }
      return;
    }
  },
  {
    type: "desmos",
    title: "Desmos",
    hostnames: ["desmos.com"],
    width: 700,
    height: 450,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.hostname === "www.desmos.com" && urlObj.pathname.match(/^\/calculator\/([^/]+)\/?$/) && urlObj.search === "" && urlObj.hash === "") {
        return `${url}?embed`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl(url);
      if (urlObj && urlObj.hostname === "www.desmos.com" && urlObj.pathname.match(/^\/calculator\/([^/]+)\/?$/) && urlObj.search === "?embed" && urlObj.hash === "") {
        return url.replace("?embed", "");
      }
      return;
    }
  }
];
var embedShapeProps = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  url: validation_exports.string
};
var Versions6 = createShapePropsMigrationIds("embed", {
  GenOriginalUrlInEmbed: 1,
  RemoveDoesResize: 2,
  RemoveTmpOldUrl: 3,
  RemovePermissionOverrides: 4
});
var embedShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions6.GenOriginalUrlInEmbed,
      // add tmpOldUrl property
      up: (props) => {
        try {
          const url = props.url;
          const host = new URL(url).host.replace("www.", "");
          let originalUrl;
          for (const localEmbedDef of EMBED_DEFINITIONS) {
            if (localEmbedDef.hostnames.includes(host)) {
              try {
                originalUrl = localEmbedDef.fromEmbedUrl(url);
              } catch (err) {
                console.warn(err);
              }
            }
          }
          props.tmpOldUrl = props.url;
          props.url = originalUrl ?? "";
        } catch (e) {
          props.url = "";
          props.tmpOldUrl = props.url;
        }
      },
      down: "retired"
    },
    {
      id: Versions6.RemoveDoesResize,
      up: (props) => {
        delete props.doesResize;
      },
      down: "retired"
    },
    {
      id: Versions6.RemoveTmpOldUrl,
      up: (props) => {
        delete props.tmpOldUrl;
      },
      down: "retired"
    },
    {
      id: Versions6.RemovePermissionOverrides,
      up: (props) => {
        delete props.overridePermissions;
      },
      down: "retired"
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLFrameShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var frameShapeProps = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  name: validation_exports.string
};
var frameShapeMigrations = createShapePropsMigrationSequence({
  sequence: []
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLGeoShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLHorizontalAlignStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultHorizontalAlignStyle = StyleProp.defineEnum("tldraw:horizontalAlign", {
  defaultValue: "middle",
  values: ["start", "middle", "end", "start-legacy", "end-legacy", "middle-legacy"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLVerticalAlignStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultVerticalAlignStyle = StyleProp.defineEnum("tldraw:verticalAlign", {
  defaultValue: "middle",
  values: ["start", "middle", "end"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLGeoShape.mjs
var GeoShapeGeoStyle = StyleProp.defineEnum("tldraw:geo", {
  defaultValue: "rectangle",
  values: [
    "cloud",
    "rectangle",
    "ellipse",
    "triangle",
    "diamond",
    "pentagon",
    "hexagon",
    "octagon",
    "star",
    "rhombus",
    "rhombus-2",
    "oval",
    "trapezoid",
    "arrow-right",
    "arrow-left",
    "arrow-up",
    "arrow-down",
    "x-box",
    "check-box",
    "heart"
  ]
});
var geoShapeProps = {
  geo: GeoShapeGeoStyle,
  labelColor: DefaultLabelColorStyle,
  color: DefaultColorStyle,
  fill: DefaultFillStyle,
  dash: DefaultDashStyle,
  size: DefaultSizeStyle,
  font: DefaultFontStyle,
  align: DefaultHorizontalAlignStyle,
  verticalAlign: DefaultVerticalAlignStyle,
  url: validation_exports.linkUrl,
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  growY: validation_exports.positiveNumber,
  text: validation_exports.string,
  scale: validation_exports.nonZeroNumber
};
var geoShapeVersions = createShapePropsMigrationIds("geo", {
  AddUrlProp: 1,
  AddLabelColor: 2,
  RemoveJustify: 3,
  AddCheckBox: 4,
  AddVerticalAlign: 5,
  MigrateLegacyAlign: 6,
  AddCloud: 7,
  MakeUrlsValid: 8,
  AddScale: 9
});
var geoShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: geoShapeVersions.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.AddLabelColor,
      up: (props) => {
        props.labelColor = "black";
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.RemoveJustify,
      up: (props) => {
        if (props.align === "justify") {
          props.align = "start";
        }
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.AddCheckBox,
      up: (_props) => {
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.AddVerticalAlign,
      up: (props) => {
        props.verticalAlign = "middle";
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.MigrateLegacyAlign,
      up: (props) => {
        let newAlign;
        switch (props.align) {
          case "start":
            newAlign = "start-legacy";
            break;
          case "end":
            newAlign = "end-legacy";
            break;
          default:
            newAlign = "middle-legacy";
            break;
        }
        props.align = newAlign;
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.AddCloud,
      up: (_props) => {
      },
      down: "retired"
    },
    {
      id: geoShapeVersions.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    },
    {
      id: geoShapeVersions.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLGroupShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var groupShapeProps = {};
var groupShapeMigrations = createShapePropsMigrationSequence({ sequence: [] });

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLHighlightShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var highlightShapeProps = {
  color: DefaultColorStyle,
  size: DefaultSizeStyle,
  segments: validation_exports.arrayOf(DrawShapeSegment),
  isComplete: validation_exports.boolean,
  isPen: validation_exports.boolean,
  scale: validation_exports.nonZeroNumber
};
var Versions7 = createShapePropsMigrationIds("highlight", {
  AddScale: 1
});
var highlightShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions7.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLImageShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var ImageShapeCrop = validation_exports.object({
  topLeft: vecModelValidator,
  bottomRight: vecModelValidator
});
var imageShapeProps = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  playing: validation_exports.boolean,
  url: validation_exports.linkUrl,
  assetId: assetIdValidator.nullable(),
  crop: ImageShapeCrop.nullable(),
  flipX: validation_exports.boolean,
  flipY: validation_exports.boolean
};
var Versions8 = createShapePropsMigrationIds("image", {
  AddUrlProp: 1,
  AddCropProp: 2,
  MakeUrlsValid: 3,
  AddFlipProps: 4
});
var imageShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions8.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: Versions8.AddCropProp,
      up: (props) => {
        props.crop = null;
      },
      down: (props) => {
        delete props.crop;
      }
    },
    {
      id: Versions8.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    },
    {
      id: Versions8.AddFlipProps,
      up: (props) => {
        props.flipX = false;
        props.flipY = false;
      },
      down: (props) => {
        delete props.flipX;
        delete props.flipY;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLLineShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var LineShapeSplineStyle = StyleProp.defineEnum("tldraw:spline", {
  defaultValue: "line",
  values: ["cubic", "line"]
});
var lineShapePointValidator = validation_exports.object({
  id: validation_exports.string,
  index: validation_exports.indexKey,
  x: validation_exports.number,
  y: validation_exports.number
});
var lineShapeProps = {
  color: DefaultColorStyle,
  dash: DefaultDashStyle,
  size: DefaultSizeStyle,
  spline: LineShapeSplineStyle,
  points: validation_exports.dict(validation_exports.string, lineShapePointValidator),
  scale: validation_exports.nonZeroNumber
};
var lineShapeVersions = createShapePropsMigrationIds("line", {
  AddSnapHandles: 1,
  RemoveExtraHandleProps: 2,
  HandlesToPoints: 3,
  PointIndexIds: 4,
  AddScale: 5
});
var lineShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: lineShapeVersions.AddSnapHandles,
      up: (props) => {
        for (const handle of Object.values(props.handles)) {
          ;
          handle.canSnap = true;
        }
      },
      down: "retired"
    },
    {
      id: lineShapeVersions.RemoveExtraHandleProps,
      up: (props) => {
        props.handles = objectMapFromEntries(
          Object.values(props.handles).map((handle) => [
            handle.index,
            {
              x: handle.x,
              y: handle.y
            }
          ])
        );
      },
      down: (props) => {
        const handles = Object.entries(props.handles).map(([index, handle]) => ({ index, ...handle })).sort(sortByIndex);
        props.handles = Object.fromEntries(
          handles.map((handle, i) => {
            const id = i === 0 ? "start" : i === handles.length - 1 ? "end" : `handle:${handle.index}`;
            return [
              id,
              {
                id,
                type: "vertex",
                canBind: false,
                canSnap: true,
                index: handle.index,
                x: handle.x,
                y: handle.y
              }
            ];
          })
        );
      }
    },
    {
      id: lineShapeVersions.HandlesToPoints,
      up: (props) => {
        const sortedHandles = Object.entries(props.handles).map(([index, { x, y: y2 }]) => ({ x, y: y2, index })).sort(sortByIndex);
        props.points = sortedHandles.map(({ x, y: y2 }) => ({ x, y: y2 }));
        delete props.handles;
      },
      down: (props) => {
        const indices = getIndices(props.points.length);
        props.handles = Object.fromEntries(
          props.points.map((handle, i) => {
            const index = indices[i];
            return [
              index,
              {
                x: handle.x,
                y: handle.y
              }
            ];
          })
        );
        delete props.points;
      }
    },
    {
      id: lineShapeVersions.PointIndexIds,
      up: (props) => {
        const indices = getIndices(props.points.length);
        props.points = Object.fromEntries(
          props.points.map((point, i) => {
            const id = indices[i];
            return [
              id,
              {
                id,
                index: id,
                x: point.x,
                y: point.y
              }
            ];
          })
        );
      },
      down: (props) => {
        const sortedHandles = Object.values(props.points).sort(sortByIndex);
        props.points = sortedHandles.map(({ x, y: y2 }) => ({ x, y: y2 }));
      }
    },
    {
      id: lineShapeVersions.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLNoteShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var noteShapeProps = {
  color: DefaultColorStyle,
  size: DefaultSizeStyle,
  font: DefaultFontStyle,
  fontSizeAdjustment: validation_exports.positiveNumber,
  align: DefaultHorizontalAlignStyle,
  verticalAlign: DefaultVerticalAlignStyle,
  growY: validation_exports.positiveNumber,
  url: validation_exports.linkUrl,
  text: validation_exports.string,
  scale: validation_exports.nonZeroNumber
};
var Versions9 = createShapePropsMigrationIds("note", {
  AddUrlProp: 1,
  RemoveJustify: 2,
  MigrateLegacyAlign: 3,
  AddVerticalAlign: 4,
  MakeUrlsValid: 5,
  AddFontSizeAdjustment: 6,
  AddScale: 7
});
var noteShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions9.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: Versions9.RemoveJustify,
      up: (props) => {
        if (props.align === "justify") {
          props.align = "start";
        }
      },
      down: "retired"
    },
    {
      id: Versions9.MigrateLegacyAlign,
      up: (props) => {
        switch (props.align) {
          case "start":
            props.align = "start-legacy";
            return;
          case "end":
            props.align = "end-legacy";
            return;
          default:
            props.align = "middle-legacy";
            return;
        }
      },
      down: "retired"
    },
    {
      id: Versions9.AddVerticalAlign,
      up: (props) => {
        props.verticalAlign = "middle";
      },
      down: "retired"
    },
    {
      id: Versions9.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    },
    {
      id: Versions9.AddFontSizeAdjustment,
      up: (props) => {
        props.fontSizeAdjustment = 0;
      },
      down: (props) => {
        delete props.fontSizeAdjustment;
      }
    },
    {
      id: Versions9.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLTextShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/styles/TLTextAlignStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultTextAlignStyle = StyleProp.defineEnum("tldraw:textAlign", {
  defaultValue: "start",
  values: ["start", "middle", "end"]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLTextShape.mjs
var textShapeProps = {
  color: DefaultColorStyle,
  size: DefaultSizeStyle,
  font: DefaultFontStyle,
  textAlign: DefaultTextAlignStyle,
  w: validation_exports.nonZeroNumber,
  text: validation_exports.string,
  scale: validation_exports.nonZeroNumber,
  autoSize: validation_exports.boolean
};
var Versions10 = createShapePropsMigrationIds("text", {
  RemoveJustify: 1,
  AddTextAlign: 2
});
var textShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions10.RemoveJustify,
      up: (props) => {
        if (props.align === "justify") {
          props.align = "start";
        }
      },
      down: "retired"
    },
    {
      id: Versions10.AddTextAlign,
      up: (props) => {
        props.textAlign = props.align;
        delete props.align;
      },
      down: (props) => {
        props.align = props.textAlign;
        delete props.textAlign;
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/shapes/TLVideoShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var videoShapeProps = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  time: validation_exports.number,
  playing: validation_exports.boolean,
  url: validation_exports.linkUrl,
  assetId: assetIdValidator.nullable()
};
var Versions11 = createShapePropsMigrationIds("video", {
  AddUrlProp: 1,
  MakeUrlsValid: 2
});
var videoShapeMigrations = createShapePropsMigrationSequence({
  sequence: [
    {
      id: Versions11.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: Versions11.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/store-migrations.mjs
init_checked_fetch();
init_modules_watch_stub();
var Versions12 = createMigrationIds("com.tldraw.store", {
  RemoveCodeAndIconShapeTypes: 1,
  AddInstancePresenceType: 2,
  RemoveTLUserAndPresenceAndAddPointer: 3,
  RemoveUserDocument: 4
});
var storeMigrations = createMigrationSequence({
  sequenceId: "com.tldraw.store",
  retroactive: false,
  sequence: [
    {
      id: Versions12.RemoveCodeAndIconShapeTypes,
      scope: "store",
      up: (store) => {
        for (const [id, record] of objectMapEntries(store)) {
          if (record.typeName === "shape" && (record.type === "icon" || record.type === "code")) {
            delete store[id];
          }
        }
      }
    },
    {
      id: Versions12.AddInstancePresenceType,
      scope: "store",
      up(_store) {
      }
    },
    {
      // remove user and presence records and add pointer records
      id: Versions12.RemoveTLUserAndPresenceAndAddPointer,
      scope: "store",
      up: (store) => {
        for (const [id, record] of objectMapEntries(store)) {
          if (record.typeName.match(/^(user|user_presence)$/)) {
            delete store[id];
          }
        }
      }
    },
    {
      // remove user document records
      id: Versions12.RemoveUserDocument,
      scope: "store",
      up: (store) => {
        for (const [id, record] of objectMapEntries(store)) {
          if (record.typeName.match("user_document")) {
            delete store[id];
          }
        }
      }
    }
  ]
});

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/createTLSchema.mjs
var defaultShapeSchemas = {
  arrow: { migrations: arrowShapeMigrations, props: arrowShapeProps },
  bookmark: { migrations: bookmarkShapeMigrations, props: bookmarkShapeProps },
  draw: { migrations: drawShapeMigrations, props: drawShapeProps },
  embed: { migrations: embedShapeMigrations, props: embedShapeProps },
  frame: { migrations: frameShapeMigrations, props: frameShapeProps },
  geo: { migrations: geoShapeMigrations, props: geoShapeProps },
  group: { migrations: groupShapeMigrations, props: groupShapeProps },
  highlight: { migrations: highlightShapeMigrations, props: highlightShapeProps },
  image: { migrations: imageShapeMigrations, props: imageShapeProps },
  line: { migrations: lineShapeMigrations, props: lineShapeProps },
  note: { migrations: noteShapeMigrations, props: noteShapeProps },
  text: { migrations: textShapeMigrations, props: textShapeProps },
  video: { migrations: videoShapeMigrations, props: videoShapeProps }
};
var defaultBindingSchemas = {
  arrow: { migrations: arrowBindingMigrations, props: arrowBindingProps }
};
function createTLSchema({
  shapes = defaultShapeSchemas,
  bindings = defaultBindingSchemas,
  migrations
} = {}) {
  const stylesById = /* @__PURE__ */ new Map();
  for (const shape of objectMapValues(shapes)) {
    for (const style of getShapePropKeysByStyle(shape.props ?? {}).keys()) {
      if (stylesById.has(style.id) && stylesById.get(style.id) !== style) {
        throw new Error(`Multiple StyleProp instances with the same id: ${style.id}`);
      }
      stylesById.set(style.id, style);
    }
  }
  const ShapeRecordType = createShapeRecordType(shapes);
  const BindingRecordType = createBindingRecordType(bindings);
  const InstanceRecordType = createInstanceRecordType(stylesById);
  return StoreSchema.create(
    {
      asset: AssetRecordType,
      binding: BindingRecordType,
      camera: CameraRecordType,
      document: DocumentRecordType,
      instance: InstanceRecordType,
      instance_page_state: InstancePageStateRecordType,
      page: PageRecordType,
      instance_presence: InstancePresenceRecordType,
      pointer: PointerRecordType,
      shape: ShapeRecordType
    },
    {
      migrations: [
        storeMigrations,
        assetMigrations,
        cameraMigrations,
        documentMigrations,
        instanceMigrations,
        instancePageStateMigrations,
        pageMigrations,
        instancePresenceMigrations,
        pointerMigrations,
        rootShapeMigrations,
        bookmarkAssetMigrations,
        imageAssetMigrations,
        videoAssetMigrations,
        ...processPropsMigrations("shape", shapes),
        ...processPropsMigrations("binding", bindings),
        ...migrations ?? []
      ],
      onValidationFailure,
      createIntegrityChecker
    }
  );
}

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/misc/TLHandle.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/translations/translations.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/node_modules/@tldraw/tlschema/dist-esm/translations/languages.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/sync-core/dist-esm/lib/ServerSocketAdapter.mjs
init_checked_fetch();
init_modules_watch_stub();
var ServerSocketAdapter = class {
  constructor(opts) {
    this.opts = opts;
  }
  // eslint-disable-next-line no-restricted-syntax
  get isOpen() {
    return this.opts.ws.readyState === 1;
  }
  // see TLRoomSocket for details on why this accepts a union and not just arrays
  sendMessage(msg) {
    const message = JSON.stringify(msg);
    this.opts.onBeforeSendMessage?.(msg, message);
    this.opts.ws.send(message);
  }
  close() {
    this.opts.ws.close();
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncRoom.mjs
init_checked_fetch();
init_modules_watch_stub();
var import_lodash6 = __toESM(require_lodash3(), 1);

// node_modules/nanoevents/index.js
init_checked_fetch();
init_modules_watch_stub();
var createNanoEvents = () => ({
  events: {},
  emit(event, ...args) {
    let callbacks = this.events[event] || [];
    for (let i = 0, length = callbacks.length; i < length; i++) {
      callbacks[i](...args);
    }
  },
  on(event, cb) {
    this.events[event]?.push(cb) || (this.events[event] = [cb]);
    return () => {
      this.events[event] = this.events[event]?.filter((i) => cb !== i);
    };
  }
});

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncRoom.mjs
var MAX_TOMBSTONES = 3e3;
var TOMBSTONE_PRUNE_BUFFER_SIZE = 300;
var DATA_MESSAGE_DEBOUNCE_INTERVAL = 1e3 / 60;
var timeSince = (time) => Date.now() - time;
var DocumentState = class {
  constructor(state, lastChangedClock, recordType) {
    this.recordType = recordType;
    this._atom = atom("document:" + state.id, { state, lastChangedClock });
  }
  _atom;
  static createWithoutValidating(state, lastChangedClock, recordType) {
    return new DocumentState(state, lastChangedClock, recordType);
  }
  static createAndValidate(state, lastChangedClock, recordType) {
    try {
      recordType.validate(state);
    } catch (error) {
      return Result.err(error);
    }
    return Result.ok(new DocumentState(state, lastChangedClock, recordType));
  }
  // eslint-disable-next-line no-restricted-syntax
  get state() {
    return this._atom.get().state;
  }
  // eslint-disable-next-line no-restricted-syntax
  get lastChangedClock() {
    return this._atom.get().lastChangedClock;
  }
  replaceState(state, clock) {
    const diff = diffRecord(this.state, state);
    if (!diff)
      return Result.ok(null);
    try {
      this.recordType.validate(state);
    } catch (error) {
      return Result.err(error);
    }
    this._atom.set({ state, lastChangedClock: clock });
    return Result.ok(diff);
  }
  mergeDiff(diff, clock) {
    const newState = applyObjectDiff(this.state, diff);
    return this.replaceState(newState, clock);
  }
};
var TLSyncRoom = class {
  // A table of connected clients
  sessions = /* @__PURE__ */ new Map();
  pruneSessions = () => {
    for (const client of this.sessions.values()) {
      switch (client.state) {
        case RoomSessionState.Connected: {
          const hasTimedOut = timeSince(client.lastInteractionTime) > SESSION_IDLE_TIMEOUT;
          if (hasTimedOut || !client.socket.isOpen) {
            this.cancelSession(client.sessionId);
          }
          break;
        }
        case RoomSessionState.AwaitingConnectMessage: {
          const hasTimedOut = timeSince(client.sessionStartTime) > SESSION_START_WAIT_TIME;
          if (hasTimedOut || !client.socket.isOpen) {
            this.removeSession(client.sessionId);
          }
          break;
        }
        case RoomSessionState.AwaitingRemoval: {
          const hasTimedOut = timeSince(client.cancellationTime) > SESSION_REMOVAL_WAIT_TIME;
          if (hasTimedOut) {
            this.removeSession(client.sessionId);
          }
          break;
        }
        default: {
          exhaustiveSwitchError(client);
        }
      }
    }
  };
  disposables = [interval(this.pruneSessions, 2e3)];
  _isClosed = false;
  close() {
    this.disposables.forEach((d) => d());
    this.sessions.forEach((session) => {
      session.socket.close();
    });
    this._isClosed = true;
  }
  isClosed() {
    return this._isClosed;
  }
  events = createNanoEvents();
  // Values associated with each uid (must be serializable).
  /** @internal */
  state = atom("room state", {
    documents: {},
    tombstones: {}
  });
  // this clock should start higher than the client, to make sure that clients who sync with their
  // initial lastServerClock value get the full state
  // in this case clients will start with 0, and the server will start with 1
  clock = 1;
  documentClock = 1;
  tombstoneHistoryStartsAtClock = this.clock;
  // map from record id to clock upon deletion
  serializedSchema;
  documentTypes;
  presenceType;
  log;
  schema;
  constructor(opts) {
    this.schema = opts.schema;
    let snapshot = opts.snapshot;
    this.log = opts.log;
    assert(
      isNativeStructuredClone,
      "TLSyncRoom is supposed to run either on Cloudflare Workersor on a 18+ version of Node.js, which both support the native structuredClone API"
    );
    this.serializedSchema = JSON.parse(JSON.stringify(this.schema.serialize()));
    this.documentTypes = new Set(
      Object.values(this.schema.types).filter((t2) => t2.scope === "document").map((t2) => t2.typeName)
    );
    const presenceTypes = new Set(
      Object.values(this.schema.types).filter((t2) => t2.scope === "presence")
    );
    if (presenceTypes.size != 1) {
      throw new Error(
        `TLSyncRoom: exactly one presence type is expected, but found ${presenceTypes.size}`
      );
    }
    this.presenceType = presenceTypes.values().next().value;
    if (!snapshot) {
      snapshot = {
        clock: 0,
        documents: [
          {
            state: DocumentRecordType.create({ id: TLDOCUMENT_ID }),
            lastChangedClock: 0
          },
          {
            state: PageRecordType.create({ name: "Page 1", index: "a1" }),
            lastChangedClock: 0
          }
        ]
      };
    }
    this.clock = snapshot.clock;
    let didIncrementClock = false;
    const ensureClockDidIncrement = (_reason) => {
      if (!didIncrementClock) {
        didIncrementClock = true;
        this.clock++;
      }
    };
    const tombstones = { ...snapshot.tombstones };
    const filteredDocuments = [];
    for (const doc of snapshot.documents) {
      if (this.documentTypes.has(doc.state.typeName)) {
        filteredDocuments.push(doc);
      } else {
        ensureClockDidIncrement("doc type was not doc type");
        tombstones[doc.state.id] = this.clock;
      }
    }
    const documents = Object.fromEntries(
      filteredDocuments.map((r2) => [
        r2.state.id,
        DocumentState.createWithoutValidating(
          r2.state,
          r2.lastChangedClock,
          assertExists(getOwnProperty(this.schema.types, r2.state.typeName))
        )
      ])
    );
    const migrationResult = this.schema.migrateStoreSnapshot({
      store: Object.fromEntries(
        objectMapEntries(documents).map(([id, { state }]) => [id, state])
      ),
      // eslint-disable-next-line deprecation/deprecation
      schema: snapshot.schema ?? this.schema.serializeEarliestVersion()
    });
    if (migrationResult.type === "error") {
      throw new Error("Failed to migrate: " + migrationResult.reason);
    }
    for (const [id, r2] of objectMapEntries(migrationResult.value)) {
      const existing = documents[id];
      if (!existing) {
        ensureClockDidIncrement("record was added during migration");
        documents[id] = DocumentState.createWithoutValidating(
          r2,
          this.clock,
          assertExists(getOwnProperty(this.schema.types, r2.typeName))
        );
      } else if (!(0, import_lodash6.default)(existing.state, r2)) {
        ensureClockDidIncrement("record was maybe updated during migration");
        existing.replaceState(r2, this.clock);
      }
    }
    for (const id of objectMapKeys(documents)) {
      if (!migrationResult.value[id]) {
        ensureClockDidIncrement("record was removed during migration");
        tombstones[id] = this.clock;
        delete documents[id];
      }
    }
    this.state.set({ documents, tombstones });
    this.pruneTombstones();
    this.documentClock = this.clock;
  }
  pruneTombstones = () => {
    this.state.update(({ tombstones, documents }) => {
      const entries = Object.entries(this.state.get().tombstones);
      if (entries.length > MAX_TOMBSTONES) {
        entries.sort((a2, b) => a2[1] - b[1]);
        const excessQuantity = entries.length - MAX_TOMBSTONES;
        tombstones = Object.fromEntries(entries.slice(excessQuantity + TOMBSTONE_PRUNE_BUFFER_SIZE));
      }
      return {
        documents,
        tombstones
      };
    });
  };
  getDocument(id) {
    return this.state.get().documents[id];
  }
  addDocument(id, state, clock) {
    let { documents, tombstones } = this.state.get();
    if (hasOwnProperty(tombstones, id)) {
      tombstones = { ...tombstones };
      delete tombstones[id];
    }
    const createResult = DocumentState.createAndValidate(
      state,
      clock,
      assertExists(getOwnProperty(this.schema.types, state.typeName))
    );
    if (!createResult.ok)
      return createResult;
    documents = { ...documents, [id]: createResult.value };
    this.state.set({ documents, tombstones });
    return Result.ok(void 0);
  }
  removeDocument(id, clock) {
    this.state.update(({ documents, tombstones }) => {
      documents = { ...documents };
      delete documents[id];
      tombstones = { ...tombstones, [id]: clock };
      return { documents, tombstones };
    });
  }
  getSnapshot() {
    const { documents, tombstones } = this.state.get();
    return {
      clock: this.clock,
      tombstones,
      schema: this.serializedSchema,
      documents: Object.values(documents).map((doc) => ({
        state: doc.state,
        lastChangedClock: doc.lastChangedClock
      })).filter((d) => this.documentTypes.has(d.state.typeName))
    };
  }
  /**
   * Send a message to a particular client. Debounces data events
   *
   * @param sessionId - The id of the session to send the message to.
   * @param message - The message to send.
   */
  sendMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.log?.warn?.("Tried to send message to unknown session", message.type);
      return;
    }
    if (session.state !== RoomSessionState.Connected) {
      this.log?.warn?.("Tried to send message to disconnected client", message.type);
      return;
    }
    if (session.socket.isOpen) {
      if (message.type !== "patch" && message.type !== "push_result") {
        if (message.type !== "pong") {
          this._flushDataMessages(sessionId);
        }
        session.socket.sendMessage(message);
      } else {
        if (session.debounceTimer === null) {
          session.socket.sendMessage({ type: "data", data: [message] });
          session.debounceTimer = setTimeout(
            () => this._flushDataMessages(sessionId),
            DATA_MESSAGE_DEBOUNCE_INTERVAL
          );
        } else {
          session.outstandingDataMessages.push(message);
        }
      }
    } else {
      this.cancelSession(session.sessionId);
    }
  }
  // needs to accept sessionId and not a session because the session might be dead by the time
  // the timer fires
  _flushDataMessages(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== RoomSessionState.Connected) {
      return;
    }
    session.debounceTimer = null;
    if (session.outstandingDataMessages.length > 0) {
      session.socket.sendMessage({ type: "data", data: session.outstandingDataMessages });
      session.outstandingDataMessages.length = 0;
    }
  }
  removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.log?.warn?.("Tried to remove unknown session");
      return;
    }
    this.sessions.delete(sessionId);
    const presence = this.getDocument(session.presenceId);
    try {
      if (session.socket.isOpen) {
        session.socket.close();
      }
    } catch (_e) {
    }
    if (presence) {
      this.state.update(({ tombstones, documents }) => {
        documents = { ...documents };
        delete documents[session.presenceId];
        return { documents, tombstones };
      });
      this.broadcastPatch({
        diff: { [session.presenceId]: [RecordOpType.Remove] },
        sourceSessionId: sessionId
      });
    }
    this.events.emit("session_removed", { sessionId, meta: session.meta });
    if (this.sessions.size === 0) {
      this.events.emit("room_became_empty");
    }
  }
  cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.state === RoomSessionState.AwaitingRemoval) {
      this.log?.warn?.("Tried to cancel session that is already awaiting removal");
      return;
    }
    this.sessions.set(sessionId, {
      state: RoomSessionState.AwaitingRemoval,
      sessionId,
      presenceId: session.presenceId,
      socket: session.socket,
      cancellationTime: Date.now(),
      meta: session.meta
    });
  }
  /**
   * Broadcast a message to all connected clients except the one with the sessionId provided.
   *
   * @param message - The message to broadcast.
   * @param sourceSessionId - The session to exclude.
   */
  broadcastPatch({ diff, sourceSessionId }) {
    this.sessions.forEach((session) => {
      if (session.state !== RoomSessionState.Connected)
        return;
      if (sourceSessionId === session.sessionId)
        return;
      if (!session.socket.isOpen) {
        this.cancelSession(session.sessionId);
        return;
      }
      const res = this.migrateDiffForSession(session.serializedSchema, diff);
      if (!res.ok) {
        this.rejectSession(
          session,
          res.error === MigrationFailureReason.TargetVersionTooNew ? TLIncompatibilityReason.ServerTooOld : TLIncompatibilityReason.ClientTooOld
        );
        return;
      }
      this.sendMessage(session.sessionId, {
        type: "patch",
        diff: res.value,
        serverClock: this.clock
      });
    });
    return this;
  }
  /**
   * When a client connects to the room, add them to the list of clients and then merge the history
   * down into the snapshots.
   *
   * @param sessionId - The session of the client that connected to the room.
   * @param socket - Their socket.
   */
  handleNewSession = (sessionId, socket, meta) => {
    const existing = this.sessions.get(sessionId);
    this.sessions.set(sessionId, {
      state: RoomSessionState.AwaitingConnectMessage,
      sessionId,
      socket,
      presenceId: existing?.presenceId ?? this.presenceType.createId(),
      sessionStartTime: Date.now(),
      meta
    });
    return this;
  };
  /**
   * When we send a diff to a client, if that client is on a lower version than us, we need to make
   * the diff compatible with their version. At the moment this means migrating each affected record
   * to the client's version and sending the whole record again. We can optimize this later by
   * keeping the previous versions of records around long enough to recalculate these diffs for
   * older client versions.
   */
  migrateDiffForSession(serializedSchema, diff) {
    if (serializedSchema === this.serializedSchema) {
      return Result.ok(diff);
    }
    const result = {};
    for (const [id, op] of Object.entries(diff)) {
      if (op[0] === RecordOpType.Remove) {
        result[id] = op;
        continue;
      }
      const migrationResult = this.schema.migratePersistedRecord(
        this.getDocument(id).state,
        serializedSchema,
        "down"
      );
      if (migrationResult.type === "error") {
        return Result.err(migrationResult.reason);
      }
      result[id] = [RecordOpType.Put, migrationResult.value];
    }
    return Result.ok(result);
  }
  /**
   * When the server receives a message from the clients Currently, supports connect and patches.
   * Invalid messages types throws an error. Currently, doesn't validate data.
   *
   * @param sessionId - The session that sent the message
   * @param message - The message that was sent
   */
  handleMessage = async (sessionId, message) => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.log?.warn?.("Received message from unknown session");
      return;
    }
    switch (message.type) {
      case "connect": {
        return this.handleConnectRequest(session, message);
      }
      case "push": {
        return this.handlePushRequest(session, message);
      }
      case "ping": {
        if (session.state === RoomSessionState.Connected) {
          session.lastInteractionTime = Date.now();
        }
        return this.sendMessage(session.sessionId, { type: "pong" });
      }
      default: {
        exhaustiveSwitchError(message);
      }
    }
  };
  /** If the client is out of date, or we are out of date, we need to let them know */
  rejectSession(session, reason) {
    try {
      if (session.socket.isOpen) {
        session.socket.sendMessage({
          type: "incompatibility_error",
          reason
        });
      }
    } catch (e) {
    } finally {
      this.removeSession(session.sessionId);
    }
  }
  handleConnectRequest(session, message) {
    let theirProtocolVersion = message.protocolVersion;
    if (theirProtocolVersion === 5) {
      theirProtocolVersion = 6;
    }
    if (theirProtocolVersion == null || theirProtocolVersion < getTlsyncProtocolVersion()) {
      this.rejectSession(session, TLIncompatibilityReason.ClientTooOld);
      return;
    } else if (theirProtocolVersion > getTlsyncProtocolVersion()) {
      this.rejectSession(session, TLIncompatibilityReason.ServerTooOld);
      return;
    }
    if (message.schema == null) {
      this.rejectSession(session, TLIncompatibilityReason.ClientTooOld);
      return;
    }
    const migrations = this.schema.getMigrationsSince(message.schema);
    if (!migrations.ok || migrations.value.some((m) => m.scope === "store" || !m.down)) {
      this.rejectSession(session, TLIncompatibilityReason.ClientTooOld);
      return;
    }
    const sessionSchema = (0, import_lodash6.default)(message.schema, this.serializedSchema) ? this.serializedSchema : message.schema;
    const connect = (msg) => {
      this.sessions.set(session.sessionId, {
        state: RoomSessionState.Connected,
        sessionId: session.sessionId,
        presenceId: session.presenceId,
        socket: session.socket,
        serializedSchema: sessionSchema,
        lastInteractionTime: Date.now(),
        debounceTimer: null,
        outstandingDataMessages: [],
        meta: session.meta
      });
      this.sendMessage(session.sessionId, msg);
    };
    transaction((rollback) => {
      if (
        // if the client requests changes since a time before we have tombstone history, send them the full state
        message.lastServerClock < this.tombstoneHistoryStartsAtClock || // similarly, if they ask for a time we haven't reached yet, send them the full state
        // this will only happen if the DB is reset (or there is no db) and the server restarts
        // or if the server exits/crashes with unpersisted changes
        message.lastServerClock > this.clock
      ) {
        const diff = {};
        for (const [id, doc] of Object.entries(this.state.get().documents)) {
          if (id !== session.presenceId) {
            diff[id] = [RecordOpType.Put, doc.state];
          }
        }
        const migrated = this.migrateDiffForSession(sessionSchema, diff);
        if (!migrated.ok) {
          rollback();
          this.rejectSession(
            session,
            migrated.error === MigrationFailureReason.TargetVersionTooNew ? TLIncompatibilityReason.ServerTooOld : TLIncompatibilityReason.ClientTooOld
          );
          return;
        }
        connect({
          type: "connect",
          connectRequestId: message.connectRequestId,
          hydrationType: "wipe_all",
          protocolVersion: getTlsyncProtocolVersion(),
          schema: this.schema.serialize(),
          serverClock: this.clock,
          diff: migrated.value
        });
      } else {
        const diff = {};
        const updatedDocs = Object.values(this.state.get().documents).filter(
          (doc) => doc.lastChangedClock > message.lastServerClock
        );
        const presenceDocs = Object.values(this.state.get().documents).filter(
          (doc) => this.presenceType.typeName === doc.state.typeName && doc.state.id !== session.presenceId
        );
        const deletedDocsIds = Object.entries(this.state.get().tombstones).filter(([_id, deletedAtClock]) => deletedAtClock > message.lastServerClock).map(([id]) => id);
        for (const doc of updatedDocs) {
          diff[doc.state.id] = [RecordOpType.Put, doc.state];
        }
        for (const doc of presenceDocs) {
          diff[doc.state.id] = [RecordOpType.Put, doc.state];
        }
        for (const docId of deletedDocsIds) {
          diff[docId] = [RecordOpType.Remove];
        }
        const migrated = this.migrateDiffForSession(sessionSchema, diff);
        if (!migrated.ok) {
          rollback();
          this.rejectSession(
            session,
            migrated.error === MigrationFailureReason.TargetVersionTooNew ? TLIncompatibilityReason.ServerTooOld : TLIncompatibilityReason.ClientTooOld
          );
          return;
        }
        connect({
          type: "connect",
          connectRequestId: message.connectRequestId,
          hydrationType: "wipe_presence",
          schema: this.schema.serialize(),
          protocolVersion: getTlsyncProtocolVersion(),
          serverClock: this.clock,
          diff: migrated.value
        });
      }
    });
  }
  handlePushRequest(session, message) {
    if (session.state !== RoomSessionState.Connected) {
      return;
    }
    session.lastInteractionTime = Date.now();
    this.clock++;
    transaction((rollback) => {
      const docChanges = { diff: null };
      const presenceChanges = { diff: null };
      const propagateOp = (changes, id, op) => {
        if (!changes.diff)
          changes.diff = {};
        changes.diff[id] = op;
      };
      const fail = (reason) => {
        rollback();
        this.rejectSession(session, reason);
        if (typeof process !== "undefined" && true) {
          this.log?.error?.("failed to apply push", reason, message);
        }
        return Result.err(void 0);
      };
      const addDocument = (changes, id, _state) => {
        const res = this.schema.migratePersistedRecord(_state, session.serializedSchema, "up");
        if (res.type === "error") {
          return fail(
            res.reason === MigrationFailureReason.TargetVersionTooOld ? TLIncompatibilityReason.ServerTooOld : TLIncompatibilityReason.ClientTooOld
          );
        }
        const { value: state } = res;
        const doc = this.getDocument(id);
        if (doc) {
          const diff = doc.replaceState(state, this.clock);
          if (!diff.ok) {
            return fail(TLIncompatibilityReason.InvalidRecord);
          }
          if (diff.value) {
            propagateOp(changes, id, [RecordOpType.Patch, diff.value]);
          }
        } else {
          const result = this.addDocument(id, state, this.clock);
          if (!result.ok) {
            return fail(TLIncompatibilityReason.InvalidRecord);
          }
          propagateOp(changes, id, [RecordOpType.Put, state]);
        }
        return Result.ok(void 0);
      };
      const patchDocument = (changes, id, patch) => {
        const doc = this.getDocument(id);
        if (!doc)
          return Result.ok(void 0);
        const downgraded = this.schema.migratePersistedRecord(
          doc.state,
          session.serializedSchema,
          "down"
        );
        if (downgraded.type === "error") {
          return fail(TLIncompatibilityReason.ClientTooOld);
        }
        if (downgraded.value === doc.state) {
          const diff = doc.mergeDiff(patch, this.clock);
          if (!diff.ok) {
            return fail(TLIncompatibilityReason.InvalidRecord);
          }
          if (diff.value) {
            propagateOp(changes, id, [RecordOpType.Patch, diff.value]);
          }
        } else {
          const patched = applyObjectDiff(downgraded.value, patch);
          const upgraded = this.schema.migratePersistedRecord(
            patched,
            session.serializedSchema,
            "up"
          );
          if (upgraded.type === "error") {
            return fail(TLIncompatibilityReason.ClientTooOld);
          }
          const diff = doc.replaceState(upgraded.value, this.clock);
          if (!diff.ok) {
            return fail(TLIncompatibilityReason.InvalidRecord);
          }
          if (diff.value) {
            propagateOp(changes, id, [RecordOpType.Patch, diff.value]);
          }
        }
        return Result.ok(void 0);
      };
      const { clientClock } = message;
      if ("presence" in message && message.presence) {
        const id = session.presenceId;
        const [type, val] = message.presence;
        const { typeName } = this.presenceType;
        switch (type) {
          case RecordOpType.Put: {
            const res = addDocument(presenceChanges, id, { ...val, id, typeName });
            if (!res.ok)
              return;
            break;
          }
          case RecordOpType.Patch: {
            const res = patchDocument(presenceChanges, id, {
              ...val,
              id: [ValueOpType.Put, id],
              typeName: [ValueOpType.Put, typeName]
            });
            if (!res.ok)
              return;
            break;
          }
        }
      }
      if (message.diff) {
        for (const [id, op] of Object.entries(message.diff)) {
          switch (op[0]) {
            case RecordOpType.Put: {
              if (!this.documentTypes.has(op[1].typeName)) {
                return fail(TLIncompatibilityReason.InvalidRecord);
              }
              const res = addDocument(docChanges, id, op[1]);
              if (!res.ok)
                return;
              break;
            }
            case RecordOpType.Patch: {
              const res = patchDocument(docChanges, id, op[1]);
              if (!res.ok)
                return;
              break;
            }
            case RecordOpType.Remove: {
              const doc = this.getDocument(id);
              if (!doc) {
                continue;
              }
              if (!this.documentTypes.has(doc.state.typeName)) {
                return fail(TLIncompatibilityReason.InvalidOperation);
              }
              this.removeDocument(id, this.clock);
              setTimeout(this.pruneTombstones, 0);
              propagateOp(docChanges, id, op);
              break;
            }
          }
        }
      }
      if (
        // if there was only a presence push, the client doesn't need to do anything aside from
        // shift the push request.
        !message.diff || (0, import_lodash6.default)(docChanges.diff, message.diff)
      ) {
        this.sendMessage(session.sessionId, {
          type: "push_result",
          serverClock: this.clock,
          clientClock,
          action: "commit"
        });
      } else if (!docChanges.diff) {
        this.sendMessage(session.sessionId, {
          type: "push_result",
          serverClock: this.clock,
          clientClock,
          action: "discard"
        });
      } else {
        const migrateResult = this.migrateDiffForSession(session.serializedSchema, docChanges.diff);
        if (!migrateResult.ok) {
          return fail(
            migrateResult.error === MigrationFailureReason.TargetVersionTooNew ? TLIncompatibilityReason.ServerTooOld : TLIncompatibilityReason.ClientTooOld
          );
        }
        this.sendMessage(session.sessionId, {
          type: "push_result",
          serverClock: this.clock,
          clientClock,
          action: { rebaseWithDiff: migrateResult.value }
        });
      }
      if (docChanges.diff || presenceChanges.diff) {
        this.broadcastPatch({
          sourceSessionId: session.sessionId,
          diff: {
            ...docChanges.diff,
            ...presenceChanges.diff
          }
        });
      }
      if (docChanges.diff) {
        this.documentClock = this.clock;
      }
      return;
    });
  }
  /**
   * Handle the event when a client disconnects.
   *
   * @param sessionId - The session that disconnected.
   */
  handleClose = (sessionId) => {
    this.cancelSession(sessionId);
  };
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSocketRoom.mjs
var TLSocketRoom = class {
  constructor(opts) {
    this.opts = opts;
    const initialSnapshot = opts.initialSnapshot && "store" in opts.initialSnapshot ? convertStoreSnapshotToRoomSnapshot(opts.initialSnapshot) : opts.initialSnapshot;
    const initialClock = initialSnapshot?.clock ?? 0;
    this.room = new TLSyncRoom({
      schema: opts.schema ?? createTLSchema(),
      snapshot: initialSnapshot,
      log: opts.log
    });
    if (this.room.clock !== initialClock) {
      this.opts?.onDataChange?.();
    }
    this.room.events.on("session_removed", (args) => {
      this.sessions.delete(args.sessionId);
      if (this.opts.onSessionRemoved) {
        this.opts.onSessionRemoved(this, {
          sessionId: args.sessionId,
          numSessionsRemaining: this.room.sessions.size,
          meta: args.meta
        });
      }
    });
    this.log = "log" in opts ? opts.log : { error: console.error };
  }
  room;
  sessions = /* @__PURE__ */ new Map();
  log;
  /**
   * Returns the number of active sessions.
   * Note that this is not the same as the number of connected sockets!
   * Sessions time out a few moments after sockets close, to smooth over network hiccups.
   *
   * @returns the number of active sessions
   */
  getNumActiveSessions() {
    return this.room.sessions.size;
  }
  /**
   * Call this when a client establishes a new socket connection.
   *
   * - `sessionId` is a unique ID for a browser tab. This is passed as a query param by the useSync hook.
   * - `socket` is a WebSocket-like object that the server uses to communicate with the client.
   * - `meta` is an optional object that can be used to store additional information about the session.
   *
   * @param opts - The options object
   */
  handleSocketConnect(opts) {
    const { sessionId, socket } = opts;
    const handleSocketMessage = (event) => this.handleSocketMessage(sessionId, event.data);
    const handleSocketError = this.handleSocketError.bind(this, sessionId);
    const handleSocketClose = this.handleSocketClose.bind(this, sessionId);
    this.sessions.set(sessionId, {
      assembler: new JsonChunkAssembler(),
      socket,
      unlisten: () => {
        socket.removeEventListener?.("message", handleSocketMessage);
        socket.removeEventListener?.("close", handleSocketClose);
        socket.removeEventListener?.("error", handleSocketError);
      }
    });
    this.room.handleNewSession(
      sessionId,
      new ServerSocketAdapter({
        ws: socket,
        onBeforeSendMessage: this.opts.onBeforeSendMessage ? (message, stringified) => this.opts.onBeforeSendMessage({
          sessionId,
          message,
          stringified,
          meta: this.room.sessions.get(sessionId)?.meta
        }) : void 0
      }),
      "meta" in opts ? opts.meta : void 0
    );
    socket.addEventListener?.("message", handleSocketMessage);
    socket.addEventListener?.("close", handleSocketClose);
    socket.addEventListener?.("error", handleSocketError);
  }
  /**
   * If executing in a server environment where sockets do not have instance-level listeners
   * (e.g. Bun.serve, Cloudflare Worker with WebSocket hibernation), you should call this
   * method when messages are received. See our self-hosting example for Bun.serve for an example.
   *
   * @param sessionId - The id of the session. (should match the one used when calling handleSocketConnect)
   * @param message - The message received from the client.
   */
  handleSocketMessage(sessionId, message) {
    const documentClockAtStart = this.room.documentClock;
    const assembler = this.sessions.get(sessionId)?.assembler;
    if (!assembler) {
      this.log?.warn?.("Received message from unknown session", sessionId);
      return;
    }
    try {
      const messageString = typeof message === "string" ? message : new TextDecoder().decode(message);
      const res = assembler.handleMessage(messageString);
      if (!res) {
        return;
      }
      if ("data" in res) {
        if (this.opts.onAfterReceiveMessage) {
          const session = this.room.sessions.get(sessionId);
          if (session) {
            this.opts.onAfterReceiveMessage({
              sessionId,
              message: res.data,
              stringified: res.stringified,
              meta: session.meta
            });
          }
        }
        this.room.handleMessage(sessionId, res.data);
      } else {
        this.log?.error?.("Error assembling message", res.error);
        this.handleSocketError(sessionId);
      }
    } catch (e) {
      this.log?.error?.(e);
      const socket = this.sessions.get(sessionId)?.socket;
      if (socket) {
        socket.send(
          JSON.stringify({
            type: "error",
            error: typeof e?.toString === "function" ? e.toString() : e
          })
        );
        socket.close();
      }
    } finally {
      if (this.room.documentClock !== documentClockAtStart) {
        this.opts.onDataChange?.();
      }
    }
  }
  /**
   * If executing in a server environment where sockets do not have instance-level listeners,
   * call this when a socket error occurs.
   * @param sessionId - The id of the session. (should match the one used when calling handleSocketConnect)
   */
  handleSocketError(sessionId) {
    this.room.handleClose(sessionId);
  }
  /**
   * If executing in a server environment where sockets do not have instance-level listeners,
   * call this when a socket is closed.
   * @param sessionId - The id of the session. (should match the one used when calling handleSocketConnect)
   */
  handleSocketClose(sessionId) {
    this.room.handleClose(sessionId);
  }
  /**
   * Returns the current 'clock' of the document.
   * The clock is an integer that increments every time the document changes.
   * The clock is stored as part of the snapshot of the document for consistency purposes.
   *
   * @returns The clock
   */
  getCurrentDocumentClock() {
    return this.room.documentClock;
  }
  /**
   * Return a snapshot of the document state, including clock-related bookkeeping.
   * You can store this and load it later on when initializing a TLSocketRoom.
   * You can also pass a snapshot to {@link TLSocketRoom#loadSnapshot} if you need to revert to a previous state.
   * @returns The snapshot
   */
  getCurrentSnapshot() {
    return this.room.getSnapshot();
  }
  /**
   * Load a snapshot of the document state, overwriting the current state.
   * @param snapshot - The snapshot to load
   */
  loadSnapshot(snapshot) {
    if ("store" in snapshot) {
      snapshot = convertStoreSnapshotToRoomSnapshot(snapshot);
    }
    const oldRoom = this.room;
    const oldIds = oldRoom.getSnapshot().documents.map((d) => d.state.id);
    const newIds = new Set(snapshot.documents.map((d) => d.state.id));
    const removedIds = oldIds.filter((id) => !newIds.has(id));
    const tombstones = { ...snapshot.tombstones };
    removedIds.forEach((id) => {
      tombstones[id] = oldRoom.clock + 1;
    });
    newIds.forEach((id) => {
      delete tombstones[id];
    });
    const newRoom = new TLSyncRoom({
      schema: oldRoom.schema,
      snapshot: {
        clock: oldRoom.clock + 1,
        documents: snapshot.documents.map((d) => ({
          lastChangedClock: oldRoom.clock + 1,
          state: d.state
        })),
        schema: snapshot.schema,
        tombstones
      },
      log: this.log
    });
    this.room = newRoom;
    oldRoom.close();
  }
  /**
   * Close the room and disconnect all clients. Call this before discarding the room instance or shutting down the server.
   */
  close() {
    this.room.close();
  }
  /**
   * @returns true if the room is closed
   */
  isClosed() {
    return this.room.isClosed();
  }
};
function convertStoreSnapshotToRoomSnapshot(snapshot) {
  return {
    clock: 0,
    documents: objectMapValues(snapshot.store).map((state) => ({
      state,
      lastChangedClock: 0
    })),
    schema: snapshot.schema,
    tombstones: {}
  };
}

// node_modules/@tldraw/tlschema/dist-esm/index.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/assets/TLBaseAsset.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/misc/id-validator.mjs
init_checked_fetch();
init_modules_watch_stub();
function idValidator2(prefix) {
  return validation_exports.string.refine((id) => {
    if (!id.startsWith(`${prefix}:`)) {
      throw new Error(`${prefix} ID must start with "${prefix}:"`);
    }
    return id;
  });
}

// node_modules/@tldraw/tlschema/dist-esm/assets/TLBaseAsset.mjs
var assetIdValidator2 = idValidator2("asset");
function createAssetValidator2(type, props) {
  return validation_exports.object({
    id: assetIdValidator2,
    typeName: validation_exports.literal("asset"),
    type: validation_exports.literal(type),
    props,
    meta: validation_exports.jsonValue
  });
}

// node_modules/@tldraw/tlschema/dist-esm/bindings/TLArrowBinding.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/misc/geometry-types.mjs
init_checked_fetch();
init_modules_watch_stub();
var vecModelValidator2 = validation_exports.object({
  x: validation_exports.number,
  y: validation_exports.number,
  z: validation_exports.number.optional()
});
var boxModelValidator2 = validation_exports.object({
  x: validation_exports.number,
  y: validation_exports.number,
  w: validation_exports.number,
  h: validation_exports.number
});

// node_modules/@tldraw/tlschema/dist-esm/records/TLBinding.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/bindings/TLBaseBinding.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLBaseShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/misc/TLOpacity.mjs
init_checked_fetch();
init_modules_watch_stub();
var opacityValidator2 = validation_exports.number.check((n2) => {
  if (n2 < 0 || n2 > 1) {
    throw new validation_exports.ValidationError("Opacity must be between 0 and 1");
  }
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLBaseShape.mjs
var parentIdValidator2 = validation_exports.string.refine((id) => {
  if (!id.startsWith("page:") && !id.startsWith("shape:")) {
    throw new Error('Parent ID must start with "page:" or "shape:"');
  }
  return id;
});
var shapeIdValidator2 = idValidator2("shape");
function createShapeValidator2(type, props, meta) {
  return validation_exports.object({
    id: shapeIdValidator2,
    typeName: validation_exports.literal("shape"),
    x: validation_exports.number,
    y: validation_exports.number,
    rotation: validation_exports.number,
    index: validation_exports.indexKey,
    parentId: parentIdValidator2,
    type: validation_exports.literal(type),
    isLocked: validation_exports.boolean,
    opacity: opacityValidator2,
    props: props ? validation_exports.object(props) : validation_exports.jsonValue,
    meta: meta ? validation_exports.object(meta) : validation_exports.jsonValue
  });
}

// node_modules/@tldraw/tlschema/dist-esm/bindings/TLBaseBinding.mjs
var bindingIdValidator2 = idValidator2("binding");
function createBindingValidator2(type, props, meta) {
  return validation_exports.object({
    id: bindingIdValidator2,
    typeName: validation_exports.literal("binding"),
    type: validation_exports.literal(type),
    fromId: shapeIdValidator2,
    toId: shapeIdValidator2,
    props: props ? validation_exports.object(props) : validation_exports.jsonValue,
    meta: meta ? validation_exports.object(meta) : validation_exports.jsonValue
  });
}

// node_modules/@tldraw/tlschema/dist-esm/records/TLBinding.mjs
var rootBindingVersions2 = createMigrationIds("com.tldraw.binding", {});
var rootBindingMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.binding",
  recordType: "binding",
  sequence: []
});
function createBindingId2(id) {
  return `binding:${id ?? nanoid()}`;
}
function createBindingPropsMigrationSequence2(migrations) {
  return migrations;
}
function createBindingRecordType2(bindings) {
  return createRecordType("binding", {
    scope: "document",
    validator: validation_exports.model(
      "binding",
      validation_exports.union(
        "type",
        mapObjectMapValues(
          bindings,
          (type, { props, meta }) => createBindingValidator2(type, props, meta)
        )
      )
    )
  }).withDefaultProperties(() => ({
    meta: {}
  }));
}

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLArrowShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/records/TLShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/styles/StyleProp.mjs
init_checked_fetch();
init_modules_watch_stub();
var StyleProp2 = class {
  /** @internal */
  constructor(id, defaultValue, type) {
    this.id = id;
    this.defaultValue = defaultValue;
    this.type = type;
  }
  /**
   * Define a new {@link StyleProp}.
   *
   * @param uniqueId - Each StyleProp must have a unique ID. We recommend you prefix this with
   * your app/library name.
   * @param options -
   * - `defaultValue`: The default value for this style prop.
   *
   * - `type`: Optionally, describe what type of data you expect for this style prop.
   *
   * @example
   * ```ts
   * import {T} from '@tldraw/validate'
   * import {StyleProp} from '@tldraw/tlschema'
   *
   * const MyLineWidthProp = StyleProp.define('myApp:lineWidth', {
   *   defaultValue: 1,
   *   type: T.number,
   * })
   * ```
   * @public
   */
  static define(uniqueId, options) {
    const { defaultValue, type = validation_exports.any } = options;
    return new StyleProp2(uniqueId, defaultValue, type);
  }
  /**
   * Define a new {@link StyleProp} as a list of possible values.
   *
   * @param uniqueId - Each StyleProp must have a unique ID. We recommend you prefix this with
   * your app/library name.
   * @param options -
   * - `defaultValue`: The default value for this style prop.
   *
   * - `values`: An array of possible values of this style prop.
   *
   * @example
   * ```ts
   * import {StyleProp} from '@tldraw/tlschema'
   *
   * const MySizeProp = StyleProp.defineEnum('myApp:size', {
   *   defaultValue: 'medium',
   *   values: ['small', 'medium', 'large'],
   * })
   * ```
   */
  static defineEnum(uniqueId, options) {
    const { defaultValue, values } = options;
    return new EnumStyleProp2(uniqueId, defaultValue, values);
  }
  setDefaultValue(value) {
    this.defaultValue = value;
  }
  validate(value) {
    return this.type.validate(value);
  }
  validateUsingKnownGoodVersion(prevValue, newValue) {
    if (this.type.validateUsingKnownGoodVersion) {
      return this.type.validateUsingKnownGoodVersion(prevValue, newValue);
    } else {
      return this.validate(newValue);
    }
  }
};
var EnumStyleProp2 = class extends StyleProp2 {
  /** @internal */
  constructor(id, defaultValue, values) {
    super(id, defaultValue, validation_exports.literalEnum(...values));
    this.values = values;
  }
};

// node_modules/@tldraw/tlschema/dist-esm/records/TLShape.mjs
var rootShapeVersions2 = createMigrationIds("com.tldraw.shape", {
  AddIsLocked: 1,
  HoistOpacity: 2,
  AddMeta: 3,
  AddWhite: 4
});
var rootShapeMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.shape",
  recordType: "shape",
  sequence: [
    {
      id: rootShapeVersions2.AddIsLocked,
      up: (record) => {
        record.isLocked = false;
      },
      down: (record) => {
        delete record.isLocked;
      }
    },
    {
      id: rootShapeVersions2.HoistOpacity,
      up: (record) => {
        record.opacity = Number(record.props.opacity ?? "1");
        delete record.props.opacity;
      },
      down: (record) => {
        const opacity = record.opacity;
        delete record.opacity;
        record.props.opacity = opacity < 0.175 ? "0.1" : opacity < 0.375 ? "0.25" : opacity < 0.625 ? "0.5" : opacity < 0.875 ? "0.75" : "1";
      }
    },
    {
      id: rootShapeVersions2.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    },
    {
      id: rootShapeVersions2.AddWhite,
      up: (_record) => {
      },
      down: (record) => {
        if (record.props.color === "white") {
          record.props.color = "black";
        }
      }
    }
  ]
});
function getShapePropKeysByStyle2(props) {
  const propKeysByStyle = /* @__PURE__ */ new Map();
  for (const [key, prop] of Object.entries(props)) {
    if (prop instanceof StyleProp2) {
      if (propKeysByStyle.has(prop)) {
        throw new Error(
          `Duplicate style prop ${prop.id}. Each style prop can only be used once within a shape.`
        );
      }
      propKeysByStyle.set(prop, key);
    }
  }
  return propKeysByStyle;
}
function createShapePropsMigrationSequence2(migrations) {
  return migrations;
}
function createShapePropsMigrationIds2(shapeType, ids) {
  return mapObjectMapValues(ids, (_k, v) => `com.tldraw.shape.${shapeType}/${v}`);
}
function createShapeRecordType2(shapes) {
  return createRecordType("shape", {
    scope: "document",
    validator: validation_exports.model(
      "shape",
      validation_exports.union(
        "type",
        mapObjectMapValues(
          shapes,
          (type, { props, meta }) => createShapeValidator2(type, props, meta)
        )
      )
    )
  }).withDefaultProperties(() => ({
    x: 0,
    y: 0,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {}
  }));
}

// node_modules/@tldraw/tlschema/dist-esm/recordsWithProps.mjs
init_checked_fetch();
init_modules_watch_stub();
function processPropsMigrations2(typeName, records) {
  const result = [];
  for (const [subType, { migrations }] of Object.entries(records)) {
    const sequenceId = `com.tldraw.${typeName}.${subType}`;
    if (!migrations) {
      result.push(
        createMigrationSequence({
          sequenceId,
          retroactive: false,
          sequence: []
        })
      );
    } else if ("sequenceId" in migrations) {
      assert(
        sequenceId === migrations.sequenceId,
        `sequenceId mismatch for ${subType} ${RecordType} migrations. Expected '${sequenceId}', got '${migrations.sequenceId}'`
      );
      result.push(migrations);
    } else if ("sequence" in migrations) {
      result.push(
        createMigrationSequence({
          sequenceId,
          retroactive: false,
          sequence: migrations.sequence.map(
            (m) => "id" in m ? createPropsMigration2(typeName, subType, m) : m
          )
        })
      );
    } else {
      result.push(
        createMigrationSequence({
          sequenceId,
          retroactive: false,
          sequence: Object.keys(migrations.migrators).map((k) => Number(k)).sort((a2, b) => a2 - b).map(
            (version) => ({
              id: `${sequenceId}/${version}`,
              scope: "record",
              filter: (r2) => r2.typeName === typeName && r2.type === subType,
              up: (record) => {
                const result2 = migrations.migrators[version].up(record);
                if (result2) {
                  return result2;
                }
              },
              down: (record) => {
                const result2 = migrations.migrators[version].down(record);
                if (result2) {
                  return result2;
                }
              }
            })
          )
        })
      );
    }
  }
  return result;
}
function createPropsMigration2(typeName, subType, m) {
  return {
    id: m.id,
    dependsOn: m.dependsOn,
    scope: "record",
    filter: (r2) => r2.typeName === typeName && r2.type === subType,
    up: (record) => {
      const result = m.up(record.props);
      if (result) {
        record.props = result;
      }
    },
    down: typeof m.down === "function" ? (record) => {
      const result = m.down(record.props);
      if (result) {
        record.props = result;
      }
    } : void 0
  };
}

// node_modules/@tldraw/tlschema/dist-esm/styles/TLColorStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var defaultColorNames2 = [
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white"
];
var DefaultColorStyle2 = StyleProp2.defineEnum("tldraw:color", {
  defaultValue: "black",
  values: defaultColorNames2
});
var DefaultLabelColorStyle2 = StyleProp2.defineEnum("tldraw:labelColor", {
  defaultValue: "black",
  values: defaultColorNames2
});

// node_modules/@tldraw/tlschema/dist-esm/styles/TLDashStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultDashStyle2 = StyleProp2.defineEnum("tldraw:dash", {
  defaultValue: "draw",
  values: ["draw", "solid", "dashed", "dotted"]
});

// node_modules/@tldraw/tlschema/dist-esm/styles/TLFillStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultFillStyle2 = StyleProp2.defineEnum("tldraw:fill", {
  defaultValue: "none",
  values: ["none", "semi", "solid", "pattern", "fill"]
});

// node_modules/@tldraw/tlschema/dist-esm/styles/TLFontStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultFontStyle2 = StyleProp2.defineEnum("tldraw:font", {
  defaultValue: "draw",
  values: ["draw", "sans", "serif", "mono"]
});

// node_modules/@tldraw/tlschema/dist-esm/styles/TLSizeStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultSizeStyle2 = StyleProp2.defineEnum("tldraw:size", {
  defaultValue: "m",
  values: ["s", "m", "l", "xl"]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLArrowShape.mjs
var arrowheadTypes2 = [
  "arrow",
  "triangle",
  "square",
  "dot",
  "pipe",
  "diamond",
  "inverted",
  "bar",
  "none"
];
var ArrowShapeArrowheadStartStyle2 = StyleProp2.defineEnum("tldraw:arrowheadStart", {
  defaultValue: "none",
  values: arrowheadTypes2
});
var ArrowShapeArrowheadEndStyle2 = StyleProp2.defineEnum("tldraw:arrowheadEnd", {
  defaultValue: "arrow",
  values: arrowheadTypes2
});
var arrowShapeProps2 = {
  labelColor: DefaultLabelColorStyle2,
  color: DefaultColorStyle2,
  fill: DefaultFillStyle2,
  dash: DefaultDashStyle2,
  size: DefaultSizeStyle2,
  arrowheadStart: ArrowShapeArrowheadStartStyle2,
  arrowheadEnd: ArrowShapeArrowheadEndStyle2,
  font: DefaultFontStyle2,
  start: vecModelValidator2,
  end: vecModelValidator2,
  bend: validation_exports.number,
  text: validation_exports.string,
  labelPosition: validation_exports.number,
  scale: validation_exports.nonZeroNumber
};
var arrowShapeVersions2 = createShapePropsMigrationIds2("arrow", {
  AddLabelColor: 1,
  AddIsPrecise: 2,
  AddLabelPosition: 3,
  ExtractBindings: 4,
  AddScale: 5
});
function propsMigration2(migration) {
  return createPropsMigration2("shape", "arrow", migration);
}
var arrowShapeMigrations2 = createMigrationSequence({
  sequenceId: "com.tldraw.shape.arrow",
  retroactive: false,
  sequence: [
    propsMigration2({
      id: arrowShapeVersions2.AddLabelColor,
      up: (props) => {
        props.labelColor = "black";
      },
      down: "retired"
    }),
    propsMigration2({
      id: arrowShapeVersions2.AddIsPrecise,
      up: ({ start, end }) => {
        if (start.type === "binding") {
          start.isPrecise = !(start.normalizedAnchor.x === 0.5 && start.normalizedAnchor.y === 0.5);
        }
        if (end.type === "binding") {
          end.isPrecise = !(end.normalizedAnchor.x === 0.5 && end.normalizedAnchor.y === 0.5);
        }
      },
      down: ({ start, end }) => {
        if (start.type === "binding") {
          if (!start.isPrecise) {
            start.normalizedAnchor = { x: 0.5, y: 0.5 };
          }
          delete start.isPrecise;
        }
        if (end.type === "binding") {
          if (!end.isPrecise) {
            end.normalizedAnchor = { x: 0.5, y: 0.5 };
          }
          delete end.isPrecise;
        }
      }
    }),
    propsMigration2({
      id: arrowShapeVersions2.AddLabelPosition,
      up: (props) => {
        props.labelPosition = 0.5;
      },
      down: (props) => {
        delete props.labelPosition;
      }
    }),
    {
      id: arrowShapeVersions2.ExtractBindings,
      scope: "store",
      up: (oldStore) => {
        const arrows = Object.values(oldStore).filter(
          (r2) => r2.typeName === "shape" && r2.type === "arrow"
        );
        for (const arrow of arrows) {
          const { start, end } = arrow.props;
          if (start.type === "binding") {
            const id = createBindingId2();
            const binding = {
              typeName: "binding",
              id,
              type: "arrow",
              fromId: arrow.id,
              toId: start.boundShapeId,
              meta: {},
              props: {
                terminal: "start",
                normalizedAnchor: start.normalizedAnchor,
                isExact: start.isExact,
                isPrecise: start.isPrecise
              }
            };
            oldStore[id] = binding;
            arrow.props.start = { x: 0, y: 0 };
          } else {
            delete arrow.props.start.type;
          }
          if (end.type === "binding") {
            const id = createBindingId2();
            const binding = {
              typeName: "binding",
              id,
              type: "arrow",
              fromId: arrow.id,
              toId: end.boundShapeId,
              meta: {},
              props: {
                terminal: "end",
                normalizedAnchor: end.normalizedAnchor,
                isExact: end.isExact,
                isPrecise: end.isPrecise
              }
            };
            oldStore[id] = binding;
            arrow.props.end = { x: 0, y: 0 };
          } else {
            delete arrow.props.end.type;
          }
        }
      }
    },
    propsMigration2({
      id: arrowShapeVersions2.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    })
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/bindings/TLArrowBinding.mjs
var arrowBindingProps2 = {
  terminal: validation_exports.literalEnum("start", "end"),
  normalizedAnchor: vecModelValidator2,
  isExact: validation_exports.boolean,
  isPrecise: validation_exports.boolean
};
var arrowBindingMigrations2 = createBindingPropsMigrationSequence2({
  sequence: [{ dependsOn: [arrowShapeVersions2.ExtractBindings] }]
});

// node_modules/@tldraw/tlschema/dist-esm/createPresenceStateDerivation.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/records/TLCamera.mjs
init_checked_fetch();
init_modules_watch_stub();
var cameraValidator2 = validation_exports.model(
  "camera",
  validation_exports.object({
    typeName: validation_exports.literal("camera"),
    id: idValidator2("camera"),
    x: validation_exports.number,
    y: validation_exports.number,
    z: validation_exports.number,
    meta: validation_exports.jsonValue
  })
);
var cameraVersions2 = createMigrationIds("com.tldraw.camera", {
  AddMeta: 1
});
var cameraMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.camera",
  recordType: "camera",
  sequence: [
    {
      id: cameraVersions2.AddMeta,
      up: (record) => {
        ;
        record.meta = {};
      }
    }
  ]
});
var CameraRecordType2 = createRecordType("camera", {
  validator: cameraValidator2,
  scope: "session"
}).withDefaultProperties(
  () => ({
    x: 0,
    y: 0,
    z: 1,
    meta: {}
  })
);

// node_modules/@tldraw/tlschema/dist-esm/records/TLInstance.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/misc/TLCursor.mjs
init_checked_fetch();
init_modules_watch_stub();
var TL_CURSOR_TYPES2 = /* @__PURE__ */ new Set([
  "none",
  "default",
  "pointer",
  "cross",
  "grab",
  "rotate",
  "grabbing",
  "resize-edge",
  "resize-corner",
  "text",
  "move",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "nesw-rotate",
  "nwse-rotate",
  "swne-rotate",
  "senw-rotate",
  "zoom-in",
  "zoom-out"
]);
var cursorTypeValidator2 = validation_exports.setEnum(TL_CURSOR_TYPES2);
var cursorValidator2 = validation_exports.object({
  type: cursorTypeValidator2,
  rotation: validation_exports.number
});

// node_modules/@tldraw/tlschema/dist-esm/misc/TLScribble.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/misc/TLColor.mjs
init_checked_fetch();
init_modules_watch_stub();
var TL_CANVAS_UI_COLOR_TYPES2 = /* @__PURE__ */ new Set([
  "accent",
  "white",
  "black",
  "selection-stroke",
  "selection-fill",
  "laser",
  "muted-1"
]);
var canvasUiColorTypeValidator2 = validation_exports.setEnum(TL_CANVAS_UI_COLOR_TYPES2);

// node_modules/@tldraw/tlschema/dist-esm/misc/TLScribble.mjs
var TL_SCRIBBLE_STATES2 = /* @__PURE__ */ new Set(["starting", "paused", "active", "stopping"]);
var scribbleValidator2 = validation_exports.object({
  id: validation_exports.string,
  points: validation_exports.arrayOf(vecModelValidator2),
  size: validation_exports.positiveNumber,
  color: canvasUiColorTypeValidator2,
  opacity: validation_exports.number,
  state: validation_exports.setEnum(TL_SCRIBBLE_STATES2),
  delay: validation_exports.number,
  shrink: validation_exports.number,
  taper: validation_exports.boolean
});

// node_modules/@tldraw/tlschema/dist-esm/records/TLPage.mjs
init_checked_fetch();
init_modules_watch_stub();
var pageIdValidator2 = idValidator2("page");
var pageValidator2 = validation_exports.model(
  "page",
  validation_exports.object({
    typeName: validation_exports.literal("page"),
    id: pageIdValidator2,
    name: validation_exports.string,
    index: validation_exports.indexKey,
    meta: validation_exports.jsonValue
  })
);
var pageVersions2 = createMigrationIds("com.tldraw.page", {
  AddMeta: 1
});
var pageMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.page",
  recordType: "page",
  sequence: [
    {
      id: pageVersions2.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    }
  ]
});
var PageRecordType2 = createRecordType("page", {
  validator: pageValidator2,
  scope: "document"
}).withDefaultProperties(() => ({
  meta: {}
}));

// node_modules/@tldraw/tlschema/dist-esm/records/TLInstance.mjs
var instanceIdValidator2 = idValidator2("instance");
function createInstanceRecordType2(stylesById) {
  const stylesForNextShapeValidators = {};
  for (const [id, style] of stylesById) {
    stylesForNextShapeValidators[id] = validation_exports.optional(style);
  }
  const instanceTypeValidator = validation_exports.model(
    "instance",
    validation_exports.object({
      typeName: validation_exports.literal("instance"),
      id: idValidator2("instance"),
      currentPageId: pageIdValidator2,
      followingUserId: validation_exports.string.nullable(),
      brush: boxModelValidator2.nullable(),
      opacityForNextShape: opacityValidator2,
      stylesForNextShape: validation_exports.object(stylesForNextShapeValidators),
      cursor: cursorValidator2,
      scribbles: validation_exports.arrayOf(scribbleValidator2),
      isFocusMode: validation_exports.boolean,
      isDebugMode: validation_exports.boolean,
      isToolLocked: validation_exports.boolean,
      exportBackground: validation_exports.boolean,
      screenBounds: boxModelValidator2,
      insets: validation_exports.arrayOf(validation_exports.boolean),
      zoomBrush: boxModelValidator2.nullable(),
      isPenMode: validation_exports.boolean,
      isGridMode: validation_exports.boolean,
      chatMessage: validation_exports.string,
      isChatting: validation_exports.boolean,
      highlightedUserIds: validation_exports.arrayOf(validation_exports.string),
      isFocused: validation_exports.boolean,
      devicePixelRatio: validation_exports.number,
      isCoarsePointer: validation_exports.boolean,
      isHoveringCanvas: validation_exports.boolean.nullable(),
      openMenus: validation_exports.arrayOf(validation_exports.string),
      isChangingStyle: validation_exports.boolean,
      isReadonly: validation_exports.boolean,
      meta: validation_exports.jsonValue,
      duplicateProps: validation_exports.object({
        shapeIds: validation_exports.arrayOf(idValidator2("shape")),
        offset: validation_exports.object({
          x: validation_exports.number,
          y: validation_exports.number
        })
      }).nullable()
    })
  );
  return createRecordType("instance", {
    validator: instanceTypeValidator,
    scope: "session",
    ephemeralKeys: {
      currentPageId: false,
      meta: false,
      followingUserId: true,
      opacityForNextShape: true,
      stylesForNextShape: true,
      brush: true,
      cursor: true,
      scribbles: true,
      isFocusMode: true,
      isDebugMode: true,
      isToolLocked: true,
      exportBackground: true,
      screenBounds: true,
      insets: true,
      zoomBrush: true,
      isPenMode: true,
      isGridMode: true,
      chatMessage: true,
      isChatting: true,
      highlightedUserIds: true,
      isFocused: true,
      devicePixelRatio: true,
      isCoarsePointer: true,
      isHoveringCanvas: true,
      openMenus: true,
      isChangingStyle: true,
      isReadonly: true,
      duplicateProps: true
    }
  }).withDefaultProperties(
    () => ({
      followingUserId: null,
      opacityForNextShape: 1,
      stylesForNextShape: {},
      brush: null,
      scribbles: [],
      cursor: {
        type: "default",
        rotation: 0
      },
      isFocusMode: false,
      exportBackground: false,
      isDebugMode: false,
      isToolLocked: false,
      screenBounds: { x: 0, y: 0, w: 1080, h: 720 },
      insets: [false, false, false, false],
      zoomBrush: null,
      isGridMode: false,
      isPenMode: false,
      chatMessage: "",
      isChatting: false,
      highlightedUserIds: [],
      isFocused: false,
      devicePixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio,
      isCoarsePointer: false,
      isHoveringCanvas: null,
      openMenus: [],
      isChangingStyle: false,
      isReadonly: false,
      meta: {},
      duplicateProps: null
    })
  );
}
var instanceVersions2 = createMigrationIds("com.tldraw.instance", {
  AddTransparentExportBgs: 1,
  RemoveDialog: 2,
  AddToolLockMode: 3,
  RemoveExtraPropsForNextShape: 4,
  AddLabelColor: 5,
  AddFollowingUserId: 6,
  RemoveAlignJustify: 7,
  AddZoom: 8,
  AddVerticalAlign: 9,
  AddScribbleDelay: 10,
  RemoveUserId: 11,
  AddIsPenModeAndIsGridMode: 12,
  HoistOpacity: 13,
  AddChat: 14,
  AddHighlightedUserIds: 15,
  ReplacePropsForNextShapeWithStylesForNextShape: 16,
  AddMeta: 17,
  RemoveCursorColor: 18,
  AddLonelyProperties: 19,
  ReadOnlyReadonly: 20,
  AddHoveringCanvas: 21,
  AddScribbles: 22,
  AddInset: 23,
  AddDuplicateProps: 24,
  RemoveCanMoveCamera: 25
});
var instanceMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.instance",
  recordType: "instance",
  sequence: [
    {
      id: instanceVersions2.AddTransparentExportBgs,
      up: (instance) => {
        return { ...instance, exportBackground: true };
      }
    },
    {
      id: instanceVersions2.RemoveDialog,
      up: ({ dialog: _, ...instance }) => {
        return instance;
      }
    },
    {
      id: instanceVersions2.AddToolLockMode,
      up: (instance) => {
        return { ...instance, isToolLocked: false };
      }
    },
    {
      id: instanceVersions2.RemoveExtraPropsForNextShape,
      up: ({ propsForNextShape, ...instance }) => {
        return {
          ...instance,
          propsForNextShape: Object.fromEntries(
            Object.entries(propsForNextShape).filter(
              ([key]) => [
                "color",
                "labelColor",
                "dash",
                "fill",
                "size",
                "font",
                "align",
                "verticalAlign",
                "icon",
                "geo",
                "arrowheadStart",
                "arrowheadEnd",
                "spline"
              ].includes(key)
            )
          )
        };
      }
    },
    {
      id: instanceVersions2.AddLabelColor,
      up: ({ propsForNextShape, ...instance }) => {
        return {
          ...instance,
          propsForNextShape: {
            ...propsForNextShape,
            labelColor: "black"
          }
        };
      }
    },
    {
      id: instanceVersions2.AddFollowingUserId,
      up: (instance) => {
        return { ...instance, followingUserId: null };
      }
    },
    {
      id: instanceVersions2.RemoveAlignJustify,
      up: (instance) => {
        let newAlign = instance.propsForNextShape.align;
        if (newAlign === "justify") {
          newAlign = "start";
        }
        return {
          ...instance,
          propsForNextShape: {
            ...instance.propsForNextShape,
            align: newAlign
          }
        };
      }
    },
    {
      id: instanceVersions2.AddZoom,
      up: (instance) => {
        return { ...instance, zoomBrush: null };
      }
    },
    {
      id: instanceVersions2.AddVerticalAlign,
      up: (instance) => {
        return {
          ...instance,
          propsForNextShape: {
            ...instance.propsForNextShape,
            verticalAlign: "middle"
          }
        };
      }
    },
    {
      id: instanceVersions2.AddScribbleDelay,
      up: (instance) => {
        if (instance.scribble !== null) {
          return { ...instance, scribble: { ...instance.scribble, delay: 0 } };
        }
        return { ...instance };
      }
    },
    {
      id: instanceVersions2.RemoveUserId,
      up: ({ userId: _, ...instance }) => {
        return instance;
      }
    },
    {
      id: instanceVersions2.AddIsPenModeAndIsGridMode,
      up: (instance) => {
        return { ...instance, isPenMode: false, isGridMode: false };
      }
    },
    {
      id: instanceVersions2.HoistOpacity,
      up: ({ propsForNextShape: { opacity, ...propsForNextShape }, ...instance }) => {
        return { ...instance, opacityForNextShape: Number(opacity ?? "1"), propsForNextShape };
      }
    },
    {
      id: instanceVersions2.AddChat,
      up: (instance) => {
        return { ...instance, chatMessage: "", isChatting: false };
      }
    },
    {
      id: instanceVersions2.AddHighlightedUserIds,
      up: (instance) => {
        return { ...instance, highlightedUserIds: [] };
      }
    },
    {
      id: instanceVersions2.ReplacePropsForNextShapeWithStylesForNextShape,
      up: ({ propsForNextShape: _, ...instance }) => {
        return { ...instance, stylesForNextShape: {} };
      }
    },
    {
      id: instanceVersions2.AddMeta,
      up: (record) => {
        return {
          ...record,
          meta: {}
        };
      }
    },
    {
      id: instanceVersions2.RemoveCursorColor,
      up: (record) => {
        const { color: _, ...cursor } = record.cursor;
        return {
          ...record,
          cursor
        };
      }
    },
    {
      id: instanceVersions2.AddLonelyProperties,
      up: (record) => {
        return {
          ...record,
          canMoveCamera: true,
          isFocused: false,
          devicePixelRatio: 1,
          isCoarsePointer: false,
          openMenus: [],
          isChangingStyle: false,
          isReadOnly: false
        };
      }
    },
    {
      id: instanceVersions2.ReadOnlyReadonly,
      up: ({ isReadOnly: _isReadOnly, ...record }) => {
        return {
          ...record,
          isReadonly: _isReadOnly
        };
      }
    },
    {
      id: instanceVersions2.AddHoveringCanvas,
      up: (record) => {
        return {
          ...record,
          isHoveringCanvas: null
        };
      }
    },
    {
      id: instanceVersions2.AddScribbles,
      up: ({ scribble: _, ...record }) => {
        return {
          ...record,
          scribbles: []
        };
      }
    },
    {
      id: instanceVersions2.AddInset,
      up: (record) => {
        return {
          ...record,
          insets: [false, false, false, false]
        };
      },
      down: ({ insets: _, ...record }) => {
        return {
          ...record
        };
      }
    },
    {
      id: instanceVersions2.AddDuplicateProps,
      up: (record) => {
        return {
          ...record,
          duplicateProps: null
        };
      },
      down: ({ duplicateProps: _, ...record }) => {
        return {
          ...record
        };
      }
    },
    {
      id: instanceVersions2.RemoveCanMoveCamera,
      up: ({ canMoveCamera: _, ...record }) => {
        return {
          ...record
        };
      },
      down: (instance) => {
        return { ...instance, canMoveCamera: true };
      }
    }
  ]
});
var TLINSTANCE_ID2 = "instance:instance";

// node_modules/@tldraw/tlschema/dist-esm/records/TLPageState.mjs
init_checked_fetch();
init_modules_watch_stub();
var instancePageStateValidator2 = validation_exports.model(
  "instance_page_state",
  validation_exports.object({
    typeName: validation_exports.literal("instance_page_state"),
    id: idValidator2("instance_page_state"),
    pageId: pageIdValidator2,
    selectedShapeIds: validation_exports.arrayOf(shapeIdValidator2),
    hintingShapeIds: validation_exports.arrayOf(shapeIdValidator2),
    erasingShapeIds: validation_exports.arrayOf(shapeIdValidator2),
    hoveredShapeId: shapeIdValidator2.nullable(),
    editingShapeId: shapeIdValidator2.nullable(),
    croppingShapeId: shapeIdValidator2.nullable(),
    focusedGroupId: shapeIdValidator2.nullable(),
    meta: validation_exports.jsonValue
  })
);
var instancePageStateVersions2 = createMigrationIds("com.tldraw.instance_page_state", {
  AddCroppingId: 1,
  RemoveInstanceIdAndCameraId: 2,
  AddMeta: 3,
  RenameProperties: 4,
  RenamePropertiesAgain: 5
});
var instancePageStateMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.instance_page_state",
  recordType: "instance_page_state",
  sequence: [
    {
      id: instancePageStateVersions2.AddCroppingId,
      up(instance) {
        instance.croppingShapeId = null;
      }
    },
    {
      id: instancePageStateVersions2.RemoveInstanceIdAndCameraId,
      up(instance) {
        delete instance.instanceId;
        delete instance.cameraId;
      }
    },
    {
      id: instancePageStateVersions2.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    },
    {
      id: instancePageStateVersions2.RenameProperties,
      // this migration is cursed: it was written wrong and doesn't do anything.
      // rather than replace it, I've added another migration below that fixes it.
      up: (_record) => {
      },
      down: (_record) => {
      }
    },
    {
      id: instancePageStateVersions2.RenamePropertiesAgain,
      up: (record) => {
        record.selectedShapeIds = record.selectedIds;
        delete record.selectedIds;
        record.hintingShapeIds = record.hintingIds;
        delete record.hintingIds;
        record.erasingShapeIds = record.erasingIds;
        delete record.erasingIds;
        record.hoveredShapeId = record.hoveredId;
        delete record.hoveredId;
        record.editingShapeId = record.editingId;
        delete record.editingId;
        record.croppingShapeId = record.croppingShapeId ?? record.croppingId ?? null;
        delete record.croppingId;
        record.focusedGroupId = record.focusLayerId;
        delete record.focusLayerId;
      },
      down: (record) => {
        record.selectedIds = record.selectedShapeIds;
        delete record.selectedShapeIds;
        record.hintingIds = record.hintingShapeIds;
        delete record.hintingShapeIds;
        record.erasingIds = record.erasingShapeIds;
        delete record.erasingShapeIds;
        record.hoveredId = record.hoveredShapeId;
        delete record.hoveredShapeId;
        record.editingId = record.editingShapeId;
        delete record.editingShapeId;
        record.croppingId = record.croppingShapeId;
        delete record.croppingShapeId;
        record.focusLayerId = record.focusedGroupId;
        delete record.focusedGroupId;
      }
    }
  ]
});
var InstancePageStateRecordType2 = createRecordType(
  "instance_page_state",
  {
    validator: instancePageStateValidator2,
    scope: "session",
    ephemeralKeys: {
      pageId: false,
      selectedShapeIds: false,
      editingShapeId: false,
      croppingShapeId: false,
      meta: false,
      hintingShapeIds: true,
      erasingShapeIds: true,
      hoveredShapeId: true,
      focusedGroupId: true
    }
  }
).withDefaultProperties(
  () => ({
    editingShapeId: null,
    croppingShapeId: null,
    selectedShapeIds: [],
    hoveredShapeId: null,
    erasingShapeIds: [],
    hintingShapeIds: [],
    focusedGroupId: null,
    meta: {}
  })
);

// node_modules/@tldraw/tlschema/dist-esm/records/TLPointer.mjs
init_checked_fetch();
init_modules_watch_stub();
var pointerValidator2 = validation_exports.model(
  "pointer",
  validation_exports.object({
    typeName: validation_exports.literal("pointer"),
    id: idValidator2("pointer"),
    x: validation_exports.number,
    y: validation_exports.number,
    lastActivityTimestamp: validation_exports.number,
    meta: validation_exports.jsonValue
  })
);
var pointerVersions2 = createMigrationIds("com.tldraw.pointer", {
  AddMeta: 1
});
var pointerMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.pointer",
  recordType: "pointer",
  sequence: [
    {
      id: pointerVersions2.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    }
  ]
});
var PointerRecordType2 = createRecordType("pointer", {
  validator: pointerValidator2,
  scope: "session"
}).withDefaultProperties(
  () => ({
    x: 0,
    y: 0,
    lastActivityTimestamp: 0,
    meta: {}
  })
);
var TLPOINTER_ID2 = PointerRecordType2.createId("pointer");

// node_modules/@tldraw/tlschema/dist-esm/records/TLPresence.mjs
init_checked_fetch();
init_modules_watch_stub();
var instancePresenceValidator2 = validation_exports.model(
  "instance_presence",
  validation_exports.object({
    typeName: validation_exports.literal("instance_presence"),
    id: idValidator2("instance_presence"),
    userId: validation_exports.string,
    userName: validation_exports.string,
    lastActivityTimestamp: validation_exports.number,
    followingUserId: validation_exports.string.nullable(),
    cursor: validation_exports.object({
      x: validation_exports.number,
      y: validation_exports.number,
      type: cursorTypeValidator2,
      rotation: validation_exports.number
    }),
    color: validation_exports.string,
    camera: validation_exports.object({
      x: validation_exports.number,
      y: validation_exports.number,
      z: validation_exports.number
    }),
    screenBounds: boxModelValidator2,
    selectedShapeIds: validation_exports.arrayOf(idValidator2("shape")),
    currentPageId: idValidator2("page"),
    brush: boxModelValidator2.nullable(),
    scribbles: validation_exports.arrayOf(scribbleValidator2),
    chatMessage: validation_exports.string,
    meta: validation_exports.jsonValue
  })
);
var instancePresenceVersions2 = createMigrationIds("com.tldraw.instance_presence", {
  AddScribbleDelay: 1,
  RemoveInstanceId: 2,
  AddChatMessage: 3,
  AddMeta: 4,
  RenameSelectedShapeIds: 5
});
var instancePresenceMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.instance_presence",
  recordType: "instance_presence",
  sequence: [
    {
      id: instancePresenceVersions2.AddScribbleDelay,
      up: (instance) => {
        if (instance.scribble !== null) {
          instance.scribble.delay = 0;
        }
      }
    },
    {
      id: instancePresenceVersions2.RemoveInstanceId,
      up: (instance) => {
        delete instance.instanceId;
      }
    },
    {
      id: instancePresenceVersions2.AddChatMessage,
      up: (instance) => {
        instance.chatMessage = "";
      }
    },
    {
      id: instancePresenceVersions2.AddMeta,
      up: (record) => {
        record.meta = {};
      }
    },
    {
      id: instancePresenceVersions2.RenameSelectedShapeIds,
      up: (_record) => {
      }
    }
  ]
});
var InstancePresenceRecordType2 = createRecordType(
  "instance_presence",
  {
    validator: instancePresenceValidator2,
    scope: "presence"
  }
).withDefaultProperties(() => ({
  lastActivityTimestamp: 0,
  followingUserId: null,
  color: "#FF0000",
  camera: {
    x: 0,
    y: 0,
    z: 1
  },
  cursor: {
    x: 0,
    y: 0,
    type: "default",
    rotation: 0
  },
  screenBounds: {
    x: 0,
    y: 0,
    w: 1,
    h: 1
  },
  selectedShapeIds: [],
  brush: null,
  scribbles: [],
  chatMessage: "",
  meta: {}
}));

// node_modules/@tldraw/tlschema/dist-esm/createTLSchema.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/TLStore.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/records/TLDocument.mjs
init_checked_fetch();
init_modules_watch_stub();
var documentValidator2 = validation_exports.model(
  "document",
  validation_exports.object({
    typeName: validation_exports.literal("document"),
    id: validation_exports.literal("document:document"),
    gridSize: validation_exports.number,
    name: validation_exports.string,
    meta: validation_exports.jsonValue
  })
);
var documentVersions2 = createMigrationIds("com.tldraw.document", {
  AddName: 1,
  AddMeta: 2
});
var documentMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.document",
  recordType: "document",
  sequence: [
    {
      id: documentVersions2.AddName,
      up: (document2) => {
        ;
        document2.name = "";
      },
      down: (document2) => {
        delete document2.name;
      }
    },
    {
      id: documentVersions2.AddMeta,
      up: (record) => {
        ;
        record.meta = {};
      }
    }
  ]
});
var DocumentRecordType2 = createRecordType("document", {
  validator: documentValidator2,
  scope: "document"
}).withDefaultProperties(
  () => ({
    gridSize: 10,
    name: "",
    meta: {}
  })
);
var TLDOCUMENT_ID2 = DocumentRecordType2.createId("document");

// node_modules/@tldraw/tlschema/dist-esm/TLStore.mjs
function sortByIndex3(a2, b) {
  if (a2.index < b.index) {
    return -1;
  } else if (a2.index > b.index) {
    return 1;
  }
  return 0;
}
function redactRecordForErrorReporting2(record) {
  if (record.typeName === "asset") {
    if ("src" in record) {
      record.src = "<redacted>";
    }
    if ("src" in record.props) {
      record.props.src = "<redacted>";
    }
  }
}
var onValidationFailure2 = ({ error, phase, record, recordBefore }) => {
  const isExistingValidationIssue = (
    // if we're initializing the store for the first time, we should
    // allow invalid records so people can load old buggy data:
    phase === "initialize"
  );
  annotateError(error, {
    tags: {
      origin: "store.validateRecord",
      storePhase: phase,
      isExistingValidationIssue
    },
    extras: {
      recordBefore: recordBefore ? redactRecordForErrorReporting2(structuredClone(recordBefore)) : void 0,
      recordAfter: redactRecordForErrorReporting2(structuredClone(record))
    }
  });
  throw error;
};
function getDefaultPages2() {
  return [
    PageRecordType2.create({
      id: "page:page",
      name: "Page 1",
      index: "a1",
      meta: {}
    })
  ];
}
function createIntegrityChecker2(store) {
  const $pageIds = store.query.ids("page");
  const ensureStoreIsUsable = () => {
    if (!store.has(TLDOCUMENT_ID2)) {
      store.put([DocumentRecordType2.create({ id: TLDOCUMENT_ID2, name: store.props.defaultName })]);
      return ensureStoreIsUsable();
    }
    if (!store.has(TLPOINTER_ID2)) {
      store.put([PointerRecordType2.create({ id: TLPOINTER_ID2 })]);
      return ensureStoreIsUsable();
    }
    const pageIds = $pageIds.get();
    if (pageIds.size === 0) {
      store.put(getDefaultPages2());
      return ensureStoreIsUsable();
    }
    const getFirstPageId = () => [...pageIds].map((id) => store.get(id)).sort(sortByIndex3)[0].id;
    const instanceState = store.get(TLINSTANCE_ID2);
    if (!instanceState) {
      store.put([
        store.schema.types.instance.create({
          id: TLINSTANCE_ID2,
          currentPageId: getFirstPageId(),
          exportBackground: true
        })
      ]);
      return ensureStoreIsUsable();
    } else if (!pageIds.has(instanceState.currentPageId)) {
      store.put([{ ...instanceState, currentPageId: getFirstPageId() }]);
      return ensureStoreIsUsable();
    }
    const missingPageStateIds = /* @__PURE__ */ new Set();
    const missingCameraIds = /* @__PURE__ */ new Set();
    for (const id of pageIds) {
      const pageStateId = InstancePageStateRecordType2.createId(id);
      if (!store.has(pageStateId)) {
        missingPageStateIds.add(pageStateId);
      }
      const cameraId = CameraRecordType2.createId(id);
      if (!store.has(cameraId)) {
        missingCameraIds.add(cameraId);
      }
    }
    if (missingPageStateIds.size > 0) {
      store.put(
        [...missingPageStateIds].map(
          (id) => InstancePageStateRecordType2.create({
            id,
            pageId: InstancePageStateRecordType2.parseId(id)
          })
        )
      );
    }
    if (missingCameraIds.size > 0) {
      store.put([...missingCameraIds].map((id) => CameraRecordType2.create({ id })));
    }
  };
  return ensureStoreIsUsable;
}

// node_modules/@tldraw/tlschema/dist-esm/assets/TLBookmarkAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var bookmarkAssetValidator2 = createAssetValidator2(
  "bookmark",
  validation_exports.object({
    title: validation_exports.string,
    description: validation_exports.string,
    image: validation_exports.string,
    favicon: validation_exports.string,
    src: validation_exports.srcUrl.nullable()
  })
);
var Versions13 = createMigrationIds("com.tldraw.asset.bookmark", {
  MakeUrlsValid: 1,
  AddFavicon: 2
});
var bookmarkAssetMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset.bookmark",
  recordType: "asset",
  filter: (asset) => asset.type === "bookmark",
  sequence: [
    {
      id: Versions13.MakeUrlsValid,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.src)) {
          asset.props.src = "";
        }
      },
      down: (_asset) => {
      }
    },
    {
      id: Versions13.AddFavicon,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.favicon)) {
          asset.props.favicon = "";
        }
      },
      down: (asset) => {
        delete asset.props.favicon;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/assets/TLImageAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var imageAssetValidator2 = createAssetValidator2(
  "image",
  validation_exports.object({
    w: validation_exports.number,
    h: validation_exports.number,
    name: validation_exports.string,
    isAnimated: validation_exports.boolean,
    mimeType: validation_exports.string.nullable(),
    src: validation_exports.srcUrl.nullable(),
    fileSize: validation_exports.nonZeroNumber.optional()
  })
);
var Versions14 = createMigrationIds("com.tldraw.asset.image", {
  AddIsAnimated: 1,
  RenameWidthHeight: 2,
  MakeUrlsValid: 3,
  AddFileSize: 4,
  MakeFileSizeOptional: 5
});
var imageAssetMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset.image",
  recordType: "asset",
  filter: (asset) => asset.type === "image",
  sequence: [
    {
      id: Versions14.AddIsAnimated,
      up: (asset) => {
        asset.props.isAnimated = false;
      },
      down: (asset) => {
        delete asset.props.isAnimated;
      }
    },
    {
      id: Versions14.RenameWidthHeight,
      up: (asset) => {
        asset.props.w = asset.props.width;
        asset.props.h = asset.props.height;
        delete asset.props.width;
        delete asset.props.height;
      },
      down: (asset) => {
        asset.props.width = asset.props.w;
        asset.props.height = asset.props.h;
        delete asset.props.w;
        delete asset.props.h;
      }
    },
    {
      id: Versions14.MakeUrlsValid,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.src)) {
          asset.props.src = "";
        }
      },
      down: (_asset) => {
      }
    },
    {
      id: Versions14.AddFileSize,
      up: (asset) => {
        asset.props.fileSize = -1;
      },
      down: (asset) => {
        delete asset.props.fileSize;
      }
    },
    {
      id: Versions14.MakeFileSizeOptional,
      up: (asset) => {
        if (asset.props.fileSize === -1) {
          asset.props.fileSize = void 0;
        }
      },
      down: (asset) => {
        if (asset.props.fileSize === void 0) {
          asset.props.fileSize = -1;
        }
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/assets/TLVideoAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var videoAssetValidator2 = createAssetValidator2(
  "video",
  validation_exports.object({
    w: validation_exports.number,
    h: validation_exports.number,
    name: validation_exports.string,
    isAnimated: validation_exports.boolean,
    mimeType: validation_exports.string.nullable(),
    src: validation_exports.srcUrl.nullable(),
    fileSize: validation_exports.number.optional()
  })
);
var Versions15 = createMigrationIds("com.tldraw.asset.video", {
  AddIsAnimated: 1,
  RenameWidthHeight: 2,
  MakeUrlsValid: 3,
  AddFileSize: 4,
  MakeFileSizeOptional: 5
});
var videoAssetMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset.video",
  recordType: "asset",
  filter: (asset) => asset.type === "video",
  sequence: [
    {
      id: Versions15.AddIsAnimated,
      up: (asset) => {
        asset.props.isAnimated = false;
      },
      down: (asset) => {
        delete asset.props.isAnimated;
      }
    },
    {
      id: Versions15.RenameWidthHeight,
      up: (asset) => {
        asset.props.w = asset.props.width;
        asset.props.h = asset.props.height;
        delete asset.props.width;
        delete asset.props.height;
      },
      down: (asset) => {
        asset.props.width = asset.props.w;
        asset.props.height = asset.props.h;
        delete asset.props.w;
        delete asset.props.h;
      }
    },
    {
      id: Versions15.MakeUrlsValid,
      up: (asset) => {
        if (!validation_exports.srcUrl.isValid(asset.props.src)) {
          asset.props.src = "";
        }
      },
      down: (_asset) => {
      }
    },
    {
      id: Versions15.AddFileSize,
      up: (asset) => {
        asset.props.fileSize = -1;
      },
      down: (asset) => {
        delete asset.props.fileSize;
      }
    },
    {
      id: Versions15.MakeFileSizeOptional,
      up: (asset) => {
        if (asset.props.fileSize === -1) {
          asset.props.fileSize = void 0;
        }
      },
      down: (asset) => {
        if (asset.props.fileSize === void 0) {
          asset.props.fileSize = -1;
        }
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/records/TLAsset.mjs
init_checked_fetch();
init_modules_watch_stub();
var assetValidator2 = validation_exports.model(
  "asset",
  validation_exports.union("type", {
    image: imageAssetValidator2,
    video: videoAssetValidator2,
    bookmark: bookmarkAssetValidator2
  })
);
var assetVersions2 = createMigrationIds("com.tldraw.asset", {
  AddMeta: 1
});
var assetMigrations2 = createRecordMigrationSequence({
  sequenceId: "com.tldraw.asset",
  recordType: "asset",
  sequence: [
    {
      id: assetVersions2.AddMeta,
      up: (record) => {
        ;
        record.meta = {};
      }
    }
  ]
});
var AssetRecordType2 = createRecordType("asset", {
  validator: assetValidator2,
  scope: "document"
}).withDefaultProperties(() => ({
  meta: {}
}));

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLBookmarkShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var bookmarkShapeProps2 = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  assetId: assetIdValidator2.nullable(),
  url: validation_exports.linkUrl
};
var Versions16 = createShapePropsMigrationIds2("bookmark", {
  NullAssetId: 1,
  MakeUrlsValid: 2
});
var bookmarkShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions16.NullAssetId,
      up: (props) => {
        if (props.assetId === void 0) {
          props.assetId = null;
        }
      },
      down: "retired"
    },
    {
      id: Versions16.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLDrawShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var DrawShapeSegment2 = validation_exports.object({
  type: validation_exports.literalEnum("free", "straight"),
  points: validation_exports.arrayOf(vecModelValidator2)
});
var drawShapeProps2 = {
  color: DefaultColorStyle2,
  fill: DefaultFillStyle2,
  dash: DefaultDashStyle2,
  size: DefaultSizeStyle2,
  segments: validation_exports.arrayOf(DrawShapeSegment2),
  isComplete: validation_exports.boolean,
  isClosed: validation_exports.boolean,
  isPen: validation_exports.boolean,
  scale: validation_exports.nonZeroNumber
};
var Versions17 = createShapePropsMigrationIds2("draw", {
  AddInPen: 1,
  AddScale: 2
});
var drawShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions17.AddInPen,
      up: (props) => {
        const { points } = props.segments[0];
        if (points.length === 0) {
          props.isPen = false;
          return;
        }
        let isPen = !(points[0].z === 0 || points[0].z === 0.5);
        if (points[1]) {
          isPen = isPen && !(points[1].z === 0 || points[1].z === 0.5);
        }
        props.isPen = isPen;
      },
      down: "retired"
    },
    {
      id: Versions17.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLEmbedShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var TLDRAW_APP_RE2 = /(^\/r\/[^/]+\/?$)/;
var safeParseUrl2 = (url) => {
  try {
    return new URL(url);
  } catch (err) {
    return;
  }
};
var EMBED_DEFINITIONS2 = [
  {
    type: "tldraw",
    title: "tldraw",
    hostnames: ["beta.tldraw.com", "tldraw.com", "localhost:3000"],
    minWidth: 300,
    minHeight: 300,
    width: 720,
    height: 500,
    doesResize: true,
    overridePermissions: {
      "allow-top-navigation": true
    },
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(TLDRAW_APP_RE2)) {
        return url;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(TLDRAW_APP_RE2)) {
        return url;
      }
      return;
    }
  },
  {
    type: "figma",
    title: "Figma",
    hostnames: ["figma.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      if (!!url.match(
        // eslint-disable-next-line no-useless-escape
        /https:\/\/([\w\.-]+\.)?figma.com\/(file|proto)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/
      ) && !url.includes("figma.com/embed")) {
        return `https://www.figma.com/embed?embed_host=share&url=${url}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/?$/)) {
        const outUrl = urlObj.searchParams.get("url");
        if (outUrl) {
          return outUrl;
        }
      }
      return;
    }
  },
  {
    type: "google_maps",
    title: "Google Maps",
    hostnames: ["google.*"],
    width: 720,
    height: 500,
    doesResize: true,
    overridePermissions: {
      "allow-presentation": true
    },
    toEmbedUrl: (url) => {
      if (url.includes("/maps/")) {
        const match = url.match(/@(.*),(.*),(.*)z/);
        let result;
        if (match) {
          const [, lat, lng, z] = match;
          const host = new URL(url).host.replace("www.", "");
          result = `https://${host}/maps/embed/v1/view?key=${process.env.NEXT_PUBLIC_GC_API_KEY}&center=${lat},${lng}&zoom=${z}`;
        } else {
          result = "";
        }
        return result;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (!urlObj)
        return;
      const matches = urlObj.pathname.match(/^\/maps\/embed\/v1\/view\/?$/);
      if (matches && urlObj.searchParams.has("center") && urlObj.searchParams.get("zoom")) {
        const zoom = urlObj.searchParams.get("zoom");
        const [lat, lon] = urlObj.searchParams.get("center").split(",");
        return `https://www.google.com/maps/@${lat},${lon},${zoom}z`;
      }
      return;
    }
  },
  {
    type: "val_town",
    title: "Val Town",
    hostnames: ["val.town"],
    minWidth: 260,
    minHeight: 100,
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      const matches = urlObj && urlObj.pathname.match(/\/v\/(.+)\/?/);
      if (matches) {
        return `https://www.val.town/embed/${matches[1]}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      const matches = urlObj && urlObj.pathname.match(/\/embed\/(.+)\/?/);
      if (matches) {
        return `https://www.val.town/v/${matches[1]}`;
      }
      return;
    }
  },
  {
    type: "codesandbox",
    title: "CodeSandbox",
    hostnames: ["codesandbox.io"],
    minWidth: 300,
    minHeight: 300,
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      const matches = urlObj && urlObj.pathname.match(/\/s\/([^/]+)\/?/);
      if (matches) {
        return `https://codesandbox.io/embed/${matches[1]}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      const matches = urlObj && urlObj.pathname.match(/\/embed\/([^/]+)\/?/);
      if (matches) {
        return `https://codesandbox.io/s/${matches[1]}`;
      }
      return;
    }
  },
  {
    type: "codepen",
    title: "Codepen",
    hostnames: ["codepen.io"],
    minWidth: 300,
    minHeight: 300,
    width: 520,
    height: 400,
    doesResize: true,
    toEmbedUrl: (url) => {
      const CODEPEN_URL_REGEXP = /https:\/\/codepen.io\/([^/]+)\/pen\/([^/]+)/;
      const matches = url.match(CODEPEN_URL_REGEXP);
      if (matches) {
        const [_, user, id] = matches;
        return `https://codepen.io/${user}/embed/${id}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const CODEPEN_EMBED_REGEXP = /https:\/\/codepen.io\/([^/]+)\/embed\/([^/]+)/;
      const matches = url.match(CODEPEN_EMBED_REGEXP);
      if (matches) {
        const [_, user, id] = matches;
        return `https://codepen.io/${user}/pen/${id}`;
      }
      return;
    }
  },
  {
    type: "scratch",
    title: "Scratch",
    hostnames: ["scratch.mit.edu"],
    width: 520,
    height: 400,
    doesResize: false,
    toEmbedUrl: (url) => {
      const SCRATCH_URL_REGEXP = /https?:\/\/scratch.mit.edu\/projects\/([^/]+)/;
      const matches = url.match(SCRATCH_URL_REGEXP);
      if (matches) {
        const [_, id] = matches;
        return `https://scratch.mit.edu/projects/embed/${id}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const SCRATCH_EMBED_REGEXP = /https:\/\/scratch.mit.edu\/projects\/embed\/([^/]+)/;
      const matches = url.match(SCRATCH_EMBED_REGEXP);
      if (matches) {
        const [_, id] = matches;
        return `https://scratch.mit.edu/projects/${id}`;
      }
      return;
    }
  },
  {
    type: "youtube",
    title: "YouTube",
    hostnames: ["*.youtube.com", "youtube.com", "youtu.be"],
    width: 800,
    height: 450,
    doesResize: true,
    overridePermissions: {
      "allow-presentation": true,
      "allow-popups-to-escape-sandbox": true
    },
    isAspectRatioLocked: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (!urlObj)
        return;
      const hostname = urlObj.hostname.replace(/^www./, "");
      if (hostname === "youtu.be") {
        const videoId = urlObj.pathname.split("/").filter(Boolean)[0];
        return `https://www.youtube.com/embed/${videoId}`;
      } else if ((hostname === "youtube.com" || hostname === "m.youtube.com") && urlObj.pathname.match(/^\/watch/)) {
        const videoId = urlObj.searchParams.get("v");
        return `https://www.youtube.com/embed/${videoId}`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (!urlObj)
        return;
      const hostname = urlObj.hostname.replace(/^www./, "");
      if (hostname === "youtube.com") {
        const matches = urlObj.pathname.match(/^\/embed\/([^/]+)\/?/);
        if (matches) {
          return `https://www.youtube.com/watch?v=${matches[1]}`;
        }
      }
      return;
    }
  },
  {
    type: "google_calendar",
    title: "Google Calendar",
    hostnames: ["calendar.google.*"],
    width: 720,
    height: 500,
    minWidth: 460,
    minHeight: 360,
    doesResize: true,
    instructionLink: "https://support.google.com/calendar/answer/41207?hl=en",
    overridePermissions: {
      "allow-popups-to-escape-sandbox": true
    },
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      const cidQs = urlObj?.searchParams.get("cid");
      if (urlObj?.pathname.match(/\/calendar\/u\/0/) && cidQs) {
        urlObj.pathname = "/calendar/embed";
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        urlObj.searchParams.set("src", cidQs);
        return urlObj.href;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      const srcQs = urlObj?.searchParams.get("src");
      if (urlObj?.pathname.match(/\/calendar\/embed/) && srcQs) {
        urlObj.pathname = "/calendar/u/0";
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        urlObj.searchParams.set("cid", srcQs);
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "google_slides",
    title: "Google Slides",
    hostnames: ["docs.google.*"],
    width: 720,
    height: 500,
    minWidth: 460,
    minHeight: 360,
    doesResize: true,
    overridePermissions: {
      "allow-popups-to-escape-sandbox": true
    },
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj?.pathname.match(/^\/presentation/) && urlObj?.pathname.match(/\/pub\/?$/)) {
        urlObj.pathname = urlObj.pathname.replace(/\/pub$/, "/embed");
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        return urlObj.href;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj?.pathname.match(/^\/presentation/) && urlObj?.pathname.match(/\/embed\/?$/)) {
        urlObj.pathname = urlObj.pathname.replace(/\/embed$/, "/pub");
        const keys = Array.from(urlObj.searchParams.keys());
        for (const key of keys) {
          urlObj.searchParams.delete(key);
        }
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "github_gist",
    title: "GitHub Gist",
    hostnames: ["gist.github.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/\/([^/]+)\/([^/]+)/)) {
        if (!url.split("/").pop())
          return;
        return url;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/\/([^/]+)\/([^/]+)/)) {
        if (!url.split("/").pop())
          return;
        return url;
      }
      return;
    }
  },
  {
    type: "replit",
    title: "Replit",
    hostnames: ["replit.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/\/@([^/]+)\/([^/]+)/)) {
        return `${url}?embed=true`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/\/@([^/]+)\/([^/]+)/) && urlObj.searchParams.has("embed")) {
        urlObj.searchParams.delete("embed");
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "felt",
    title: "Felt",
    hostnames: ["felt.com"],
    width: 720,
    height: 500,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/map\//)) {
        return urlObj.origin + "/embed" + urlObj.pathname;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/map\//)) {
        urlObj.pathname = urlObj.pathname.replace(/^\/embed/, "");
        return urlObj.href;
      }
      return;
    }
  },
  {
    type: "spotify",
    title: "Spotify",
    hostnames: ["open.spotify.com"],
    width: 720,
    height: 500,
    minHeight: 500,
    overrideOutlineRadius: 12,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/(artist|album)\//)) {
        return urlObj.origin + "/embed" + urlObj.pathname;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/(artist|album)\//)) {
        return urlObj.origin + urlObj.pathname.replace(/^\/embed/, "");
      }
      return;
    }
  },
  {
    type: "vimeo",
    title: "Vimeo",
    hostnames: ["vimeo.com", "player.vimeo.com"],
    width: 640,
    height: 360,
    doesResize: true,
    isAspectRatioLocked: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.hostname === "vimeo.com") {
        if (urlObj.pathname.match(/^\/[0-9]+/)) {
          return "https://player.vimeo.com/video/" + urlObj.pathname.split("/")[1] + "?title=0&byline=0";
        }
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.hostname === "player.vimeo.com") {
        const matches = urlObj.pathname.match(/^\/video\/([^/]+)\/?$/);
        if (matches) {
          return "https://vimeo.com/" + matches[1];
        }
      }
      return;
    }
  },
  {
    type: "excalidraw",
    title: "Excalidraw",
    hostnames: ["excalidraw.com"],
    width: 720,
    height: 500,
    doesResize: true,
    isAspectRatioLocked: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.hash.match(/#room=/)) {
        return url;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.hash.match(/#room=/)) {
        return url;
      }
      return;
    }
  },
  {
    type: "observable",
    title: "Observable",
    hostnames: ["observablehq.com"],
    width: 720,
    height: 500,
    doesResize: true,
    isAspectRatioLocked: false,
    backgroundColor: "#fff",
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/@([^/]+)\/([^/]+)\/?$/)) {
        return `${urlObj.origin}/embed${urlObj.pathname}?cell=*`;
      }
      if (urlObj && urlObj.pathname.match(/^\/d\/([^/]+)\/?$/)) {
        const pathName = urlObj.pathname.replace(/^\/d/, "");
        return `${urlObj.origin}/embed${pathName}?cell=*`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.pathname.match(/^\/embed\/@([^/]+)\/([^/]+)\/?$/)) {
        return `${urlObj.origin}${urlObj.pathname.replace("/embed", "")}#cell-*`;
      }
      if (urlObj && urlObj.pathname.match(/^\/embed\/([^/]+)\/?$/)) {
        return `${urlObj.origin}${urlObj.pathname.replace("/embed", "/d")}#cell-*`;
      }
      return;
    }
  },
  {
    type: "desmos",
    title: "Desmos",
    hostnames: ["desmos.com"],
    width: 700,
    height: 450,
    doesResize: true,
    toEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.hostname === "www.desmos.com" && urlObj.pathname.match(/^\/calculator\/([^/]+)\/?$/) && urlObj.search === "" && urlObj.hash === "") {
        return `${url}?embed`;
      }
      return;
    },
    fromEmbedUrl: (url) => {
      const urlObj = safeParseUrl2(url);
      if (urlObj && urlObj.hostname === "www.desmos.com" && urlObj.pathname.match(/^\/calculator\/([^/]+)\/?$/) && urlObj.search === "?embed" && urlObj.hash === "") {
        return url.replace("?embed", "");
      }
      return;
    }
  }
];
var embedShapeProps2 = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  url: validation_exports.string
};
var Versions18 = createShapePropsMigrationIds2("embed", {
  GenOriginalUrlInEmbed: 1,
  RemoveDoesResize: 2,
  RemoveTmpOldUrl: 3,
  RemovePermissionOverrides: 4
});
var embedShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions18.GenOriginalUrlInEmbed,
      // add tmpOldUrl property
      up: (props) => {
        try {
          const url = props.url;
          const host = new URL(url).host.replace("www.", "");
          let originalUrl;
          for (const localEmbedDef of EMBED_DEFINITIONS2) {
            if (localEmbedDef.hostnames.includes(host)) {
              try {
                originalUrl = localEmbedDef.fromEmbedUrl(url);
              } catch (err) {
                console.warn(err);
              }
            }
          }
          props.tmpOldUrl = props.url;
          props.url = originalUrl ?? "";
        } catch (e) {
          props.url = "";
          props.tmpOldUrl = props.url;
        }
      },
      down: "retired"
    },
    {
      id: Versions18.RemoveDoesResize,
      up: (props) => {
        delete props.doesResize;
      },
      down: "retired"
    },
    {
      id: Versions18.RemoveTmpOldUrl,
      up: (props) => {
        delete props.tmpOldUrl;
      },
      down: "retired"
    },
    {
      id: Versions18.RemovePermissionOverrides,
      up: (props) => {
        delete props.overridePermissions;
      },
      down: "retired"
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLFrameShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var frameShapeProps2 = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  name: validation_exports.string
};
var frameShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: []
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLGeoShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/styles/TLHorizontalAlignStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultHorizontalAlignStyle2 = StyleProp2.defineEnum("tldraw:horizontalAlign", {
  defaultValue: "middle",
  values: ["start", "middle", "end", "start-legacy", "end-legacy", "middle-legacy"]
});

// node_modules/@tldraw/tlschema/dist-esm/styles/TLVerticalAlignStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultVerticalAlignStyle2 = StyleProp2.defineEnum("tldraw:verticalAlign", {
  defaultValue: "middle",
  values: ["start", "middle", "end"]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLGeoShape.mjs
var GeoShapeGeoStyle2 = StyleProp2.defineEnum("tldraw:geo", {
  defaultValue: "rectangle",
  values: [
    "cloud",
    "rectangle",
    "ellipse",
    "triangle",
    "diamond",
    "pentagon",
    "hexagon",
    "octagon",
    "star",
    "rhombus",
    "rhombus-2",
    "oval",
    "trapezoid",
    "arrow-right",
    "arrow-left",
    "arrow-up",
    "arrow-down",
    "x-box",
    "check-box",
    "heart"
  ]
});
var geoShapeProps2 = {
  geo: GeoShapeGeoStyle2,
  labelColor: DefaultLabelColorStyle2,
  color: DefaultColorStyle2,
  fill: DefaultFillStyle2,
  dash: DefaultDashStyle2,
  size: DefaultSizeStyle2,
  font: DefaultFontStyle2,
  align: DefaultHorizontalAlignStyle2,
  verticalAlign: DefaultVerticalAlignStyle2,
  url: validation_exports.linkUrl,
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  growY: validation_exports.positiveNumber,
  text: validation_exports.string,
  scale: validation_exports.nonZeroNumber
};
var geoShapeVersions2 = createShapePropsMigrationIds2("geo", {
  AddUrlProp: 1,
  AddLabelColor: 2,
  RemoveJustify: 3,
  AddCheckBox: 4,
  AddVerticalAlign: 5,
  MigrateLegacyAlign: 6,
  AddCloud: 7,
  MakeUrlsValid: 8,
  AddScale: 9
});
var geoShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: geoShapeVersions2.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.AddLabelColor,
      up: (props) => {
        props.labelColor = "black";
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.RemoveJustify,
      up: (props) => {
        if (props.align === "justify") {
          props.align = "start";
        }
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.AddCheckBox,
      up: (_props) => {
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.AddVerticalAlign,
      up: (props) => {
        props.verticalAlign = "middle";
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.MigrateLegacyAlign,
      up: (props) => {
        let newAlign;
        switch (props.align) {
          case "start":
            newAlign = "start-legacy";
            break;
          case "end":
            newAlign = "end-legacy";
            break;
          default:
            newAlign = "middle-legacy";
            break;
        }
        props.align = newAlign;
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.AddCloud,
      up: (_props) => {
      },
      down: "retired"
    },
    {
      id: geoShapeVersions2.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    },
    {
      id: geoShapeVersions2.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLGroupShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var groupShapeProps2 = {};
var groupShapeMigrations2 = createShapePropsMigrationSequence2({ sequence: [] });

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLHighlightShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var highlightShapeProps2 = {
  color: DefaultColorStyle2,
  size: DefaultSizeStyle2,
  segments: validation_exports.arrayOf(DrawShapeSegment2),
  isComplete: validation_exports.boolean,
  isPen: validation_exports.boolean,
  scale: validation_exports.nonZeroNumber
};
var Versions19 = createShapePropsMigrationIds2("highlight", {
  AddScale: 1
});
var highlightShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions19.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLImageShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var ImageShapeCrop2 = validation_exports.object({
  topLeft: vecModelValidator2,
  bottomRight: vecModelValidator2
});
var imageShapeProps2 = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  playing: validation_exports.boolean,
  url: validation_exports.linkUrl,
  assetId: assetIdValidator2.nullable(),
  crop: ImageShapeCrop2.nullable(),
  flipX: validation_exports.boolean,
  flipY: validation_exports.boolean
};
var Versions20 = createShapePropsMigrationIds2("image", {
  AddUrlProp: 1,
  AddCropProp: 2,
  MakeUrlsValid: 3,
  AddFlipProps: 4
});
var imageShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions20.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: Versions20.AddCropProp,
      up: (props) => {
        props.crop = null;
      },
      down: (props) => {
        delete props.crop;
      }
    },
    {
      id: Versions20.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    },
    {
      id: Versions20.AddFlipProps,
      up: (props) => {
        props.flipX = false;
        props.flipY = false;
      },
      down: (props) => {
        delete props.flipX;
        delete props.flipY;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLLineShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var LineShapeSplineStyle2 = StyleProp2.defineEnum("tldraw:spline", {
  defaultValue: "line",
  values: ["cubic", "line"]
});
var lineShapePointValidator2 = validation_exports.object({
  id: validation_exports.string,
  index: validation_exports.indexKey,
  x: validation_exports.number,
  y: validation_exports.number
});
var lineShapeProps2 = {
  color: DefaultColorStyle2,
  dash: DefaultDashStyle2,
  size: DefaultSizeStyle2,
  spline: LineShapeSplineStyle2,
  points: validation_exports.dict(validation_exports.string, lineShapePointValidator2),
  scale: validation_exports.nonZeroNumber
};
var lineShapeVersions2 = createShapePropsMigrationIds2("line", {
  AddSnapHandles: 1,
  RemoveExtraHandleProps: 2,
  HandlesToPoints: 3,
  PointIndexIds: 4,
  AddScale: 5
});
var lineShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: lineShapeVersions2.AddSnapHandles,
      up: (props) => {
        for (const handle of Object.values(props.handles)) {
          ;
          handle.canSnap = true;
        }
      },
      down: "retired"
    },
    {
      id: lineShapeVersions2.RemoveExtraHandleProps,
      up: (props) => {
        props.handles = objectMapFromEntries(
          Object.values(props.handles).map((handle) => [
            handle.index,
            {
              x: handle.x,
              y: handle.y
            }
          ])
        );
      },
      down: (props) => {
        const handles = Object.entries(props.handles).map(([index, handle]) => ({ index, ...handle })).sort(sortByIndex);
        props.handles = Object.fromEntries(
          handles.map((handle, i) => {
            const id = i === 0 ? "start" : i === handles.length - 1 ? "end" : `handle:${handle.index}`;
            return [
              id,
              {
                id,
                type: "vertex",
                canBind: false,
                canSnap: true,
                index: handle.index,
                x: handle.x,
                y: handle.y
              }
            ];
          })
        );
      }
    },
    {
      id: lineShapeVersions2.HandlesToPoints,
      up: (props) => {
        const sortedHandles = Object.entries(props.handles).map(([index, { x, y: y2 }]) => ({ x, y: y2, index })).sort(sortByIndex);
        props.points = sortedHandles.map(({ x, y: y2 }) => ({ x, y: y2 }));
        delete props.handles;
      },
      down: (props) => {
        const indices = getIndices(props.points.length);
        props.handles = Object.fromEntries(
          props.points.map((handle, i) => {
            const index = indices[i];
            return [
              index,
              {
                x: handle.x,
                y: handle.y
              }
            ];
          })
        );
        delete props.points;
      }
    },
    {
      id: lineShapeVersions2.PointIndexIds,
      up: (props) => {
        const indices = getIndices(props.points.length);
        props.points = Object.fromEntries(
          props.points.map((point, i) => {
            const id = indices[i];
            return [
              id,
              {
                id,
                index: id,
                x: point.x,
                y: point.y
              }
            ];
          })
        );
      },
      down: (props) => {
        const sortedHandles = Object.values(props.points).sort(sortByIndex);
        props.points = sortedHandles.map(({ x, y: y2 }) => ({ x, y: y2 }));
      }
    },
    {
      id: lineShapeVersions2.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLNoteShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var noteShapeProps2 = {
  color: DefaultColorStyle2,
  size: DefaultSizeStyle2,
  font: DefaultFontStyle2,
  fontSizeAdjustment: validation_exports.positiveNumber,
  align: DefaultHorizontalAlignStyle2,
  verticalAlign: DefaultVerticalAlignStyle2,
  growY: validation_exports.positiveNumber,
  url: validation_exports.linkUrl,
  text: validation_exports.string,
  scale: validation_exports.nonZeroNumber
};
var Versions21 = createShapePropsMigrationIds2("note", {
  AddUrlProp: 1,
  RemoveJustify: 2,
  MigrateLegacyAlign: 3,
  AddVerticalAlign: 4,
  MakeUrlsValid: 5,
  AddFontSizeAdjustment: 6,
  AddScale: 7
});
var noteShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions21.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: Versions21.RemoveJustify,
      up: (props) => {
        if (props.align === "justify") {
          props.align = "start";
        }
      },
      down: "retired"
    },
    {
      id: Versions21.MigrateLegacyAlign,
      up: (props) => {
        switch (props.align) {
          case "start":
            props.align = "start-legacy";
            return;
          case "end":
            props.align = "end-legacy";
            return;
          default:
            props.align = "middle-legacy";
            return;
        }
      },
      down: "retired"
    },
    {
      id: Versions21.AddVerticalAlign,
      up: (props) => {
        props.verticalAlign = "middle";
      },
      down: "retired"
    },
    {
      id: Versions21.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    },
    {
      id: Versions21.AddFontSizeAdjustment,
      up: (props) => {
        props.fontSizeAdjustment = 0;
      },
      down: (props) => {
        delete props.fontSizeAdjustment;
      }
    },
    {
      id: Versions21.AddScale,
      up: (props) => {
        props.scale = 1;
      },
      down: (props) => {
        delete props.scale;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLTextShape.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/styles/TLTextAlignStyle.mjs
init_checked_fetch();
init_modules_watch_stub();
var DefaultTextAlignStyle2 = StyleProp2.defineEnum("tldraw:textAlign", {
  defaultValue: "start",
  values: ["start", "middle", "end"]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLTextShape.mjs
var textShapeProps2 = {
  color: DefaultColorStyle2,
  size: DefaultSizeStyle2,
  font: DefaultFontStyle2,
  textAlign: DefaultTextAlignStyle2,
  w: validation_exports.nonZeroNumber,
  text: validation_exports.string,
  scale: validation_exports.nonZeroNumber,
  autoSize: validation_exports.boolean
};
var Versions22 = createShapePropsMigrationIds2("text", {
  RemoveJustify: 1,
  AddTextAlign: 2
});
var textShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions22.RemoveJustify,
      up: (props) => {
        if (props.align === "justify") {
          props.align = "start";
        }
      },
      down: "retired"
    },
    {
      id: Versions22.AddTextAlign,
      up: (props) => {
        props.textAlign = props.align;
        delete props.align;
      },
      down: (props) => {
        props.align = props.textAlign;
        delete props.textAlign;
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/shapes/TLVideoShape.mjs
init_checked_fetch();
init_modules_watch_stub();
var videoShapeProps2 = {
  w: validation_exports.nonZeroNumber,
  h: validation_exports.nonZeroNumber,
  time: validation_exports.number,
  playing: validation_exports.boolean,
  url: validation_exports.linkUrl,
  assetId: assetIdValidator2.nullable()
};
var Versions23 = createShapePropsMigrationIds2("video", {
  AddUrlProp: 1,
  MakeUrlsValid: 2
});
var videoShapeMigrations2 = createShapePropsMigrationSequence2({
  sequence: [
    {
      id: Versions23.AddUrlProp,
      up: (props) => {
        props.url = "";
      },
      down: "retired"
    },
    {
      id: Versions23.MakeUrlsValid,
      up: (props) => {
        if (!validation_exports.linkUrl.isValid(props.url)) {
          props.url = "";
        }
      },
      down: (_props) => {
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/store-migrations.mjs
init_checked_fetch();
init_modules_watch_stub();
var Versions24 = createMigrationIds("com.tldraw.store", {
  RemoveCodeAndIconShapeTypes: 1,
  AddInstancePresenceType: 2,
  RemoveTLUserAndPresenceAndAddPointer: 3,
  RemoveUserDocument: 4
});
var storeMigrations2 = createMigrationSequence({
  sequenceId: "com.tldraw.store",
  retroactive: false,
  sequence: [
    {
      id: Versions24.RemoveCodeAndIconShapeTypes,
      scope: "store",
      up: (store) => {
        for (const [id, record] of objectMapEntries(store)) {
          if (record.typeName === "shape" && (record.type === "icon" || record.type === "code")) {
            delete store[id];
          }
        }
      }
    },
    {
      id: Versions24.AddInstancePresenceType,
      scope: "store",
      up(_store) {
      }
    },
    {
      // remove user and presence records and add pointer records
      id: Versions24.RemoveTLUserAndPresenceAndAddPointer,
      scope: "store",
      up: (store) => {
        for (const [id, record] of objectMapEntries(store)) {
          if (record.typeName.match(/^(user|user_presence)$/)) {
            delete store[id];
          }
        }
      }
    },
    {
      // remove user document records
      id: Versions24.RemoveUserDocument,
      scope: "store",
      up: (store) => {
        for (const [id, record] of objectMapEntries(store)) {
          if (record.typeName.match("user_document")) {
            delete store[id];
          }
        }
      }
    }
  ]
});

// node_modules/@tldraw/tlschema/dist-esm/createTLSchema.mjs
var defaultShapeSchemas2 = {
  arrow: { migrations: arrowShapeMigrations2, props: arrowShapeProps2 },
  bookmark: { migrations: bookmarkShapeMigrations2, props: bookmarkShapeProps2 },
  draw: { migrations: drawShapeMigrations2, props: drawShapeProps2 },
  embed: { migrations: embedShapeMigrations2, props: embedShapeProps2 },
  frame: { migrations: frameShapeMigrations2, props: frameShapeProps2 },
  geo: { migrations: geoShapeMigrations2, props: geoShapeProps2 },
  group: { migrations: groupShapeMigrations2, props: groupShapeProps2 },
  highlight: { migrations: highlightShapeMigrations2, props: highlightShapeProps2 },
  image: { migrations: imageShapeMigrations2, props: imageShapeProps2 },
  line: { migrations: lineShapeMigrations2, props: lineShapeProps2 },
  note: { migrations: noteShapeMigrations2, props: noteShapeProps2 },
  text: { migrations: textShapeMigrations2, props: textShapeProps2 },
  video: { migrations: videoShapeMigrations2, props: videoShapeProps2 }
};
var defaultBindingSchemas2 = {
  arrow: { migrations: arrowBindingMigrations2, props: arrowBindingProps2 }
};
function createTLSchema2({
  shapes = defaultShapeSchemas2,
  bindings = defaultBindingSchemas2,
  migrations
} = {}) {
  const stylesById = /* @__PURE__ */ new Map();
  for (const shape of objectMapValues(shapes)) {
    for (const style of getShapePropKeysByStyle2(shape.props ?? {}).keys()) {
      if (stylesById.has(style.id) && stylesById.get(style.id) !== style) {
        throw new Error(`Multiple StyleProp instances with the same id: ${style.id}`);
      }
      stylesById.set(style.id, style);
    }
  }
  const ShapeRecordType = createShapeRecordType2(shapes);
  const BindingRecordType = createBindingRecordType2(bindings);
  const InstanceRecordType = createInstanceRecordType2(stylesById);
  return StoreSchema.create(
    {
      asset: AssetRecordType2,
      binding: BindingRecordType,
      camera: CameraRecordType2,
      document: DocumentRecordType2,
      instance: InstanceRecordType,
      instance_page_state: InstancePageStateRecordType2,
      page: PageRecordType2,
      instance_presence: InstancePresenceRecordType2,
      pointer: PointerRecordType2,
      shape: ShapeRecordType
    },
    {
      migrations: [
        storeMigrations2,
        assetMigrations2,
        cameraMigrations2,
        documentMigrations2,
        instanceMigrations2,
        instancePageStateMigrations2,
        pageMigrations2,
        instancePresenceMigrations2,
        pointerMigrations2,
        rootShapeMigrations2,
        bookmarkAssetMigrations2,
        imageAssetMigrations2,
        videoAssetMigrations2,
        ...processPropsMigrations2("shape", shapes),
        ...processPropsMigrations2("binding", bindings),
        ...migrations ?? []
      ],
      onValidationFailure: onValidationFailure2,
      createIntegrityChecker: createIntegrityChecker2
    }
  );
}

// node_modules/@tldraw/tlschema/dist-esm/misc/TLHandle.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/translations/translations.mjs
init_checked_fetch();
init_modules_watch_stub();

// node_modules/@tldraw/tlschema/dist-esm/translations/languages.mjs
init_checked_fetch();
init_modules_watch_stub();

// worker/TldrawDurableObject.ts
var import_lodash7 = __toESM(require_lodash(), 1);
var schema = createTLSchema2({
  shapes: { ...defaultShapeSchemas2 }
  // bindings: { ...defaultBindingSchemas },
});
var TldrawDurableObject = class {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.r2 = env.TLDRAW_BUCKET;
    ctx.blockConcurrencyWhile(async () => {
      this.roomId = await this.ctx.storage.get("roomId") ?? null;
    });
  }
  r2;
  // the room ID will be missing whilst the room is being initialized
  roomId = null;
  // when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
  // load it once.
  roomPromise = null;
  router = n({
    catch: (e) => {
      console.log(e);
      return s(e);
    }
  }).get("/connect/:roomId", async (request) => {
    if (!this.roomId) {
      await this.ctx.blockConcurrencyWhile(async () => {
        await this.ctx.storage.put("roomId", request.params.roomId);
        this.roomId = request.params.roomId;
      });
    }
    return this.handleConnect(request);
  });
  // `fetch` is the entry point for all requests to the Durable Object
  fetch(request) {
    return this.router.fetch(request);
  }
  // what happens when someone tries to connect to this room?
  async handleConnect(request) {
    const sessionId = request.query.sessionId;
    if (!sessionId)
      return s(400, "Missing sessionId");
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    serverWebSocket.accept();
    const room = await this.getRoom();
    room.handleSocketConnect({ sessionId, socket: serverWebSocket });
    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }
  getRoom() {
    const roomId = this.roomId;
    if (!roomId)
      throw new Error("Missing roomId");
    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        const roomFromBucket = await this.r2.get(`rooms/${roomId}`);
        const initialSnapshot = roomFromBucket ? await roomFromBucket.json() : void 0;
        return new TLSocketRoom({
          schema,
          initialSnapshot,
          onDataChange: () => {
            this.schedulePersistToR2();
          }
        });
      })();
    }
    return this.roomPromise;
  }
  // we throttle persistance so it only happens every 10 seconds
  schedulePersistToR2 = (0, import_lodash7.default)(async () => {
    if (!this.roomPromise || !this.roomId)
      return;
    const room = await this.getRoom();
    const snapshot = JSON.stringify(room.getCurrentSnapshot());
    await this.r2.put(`rooms/${this.roomId}`, snapshot);
  }, 1e4);
};

// worker/worker.ts
var { preflight, corsify } = y({ origin: "*" });
var router = n({
  before: [preflight],
  finally: [corsify],
  catch: (e) => {
    console.error(e);
    return s(e);
  }
}).get("/connect/:roomId", (request, env) => {
  const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.roomId);
  const room = env.TLDRAW_DURABLE_OBJECT.get(id);
  return room.fetch(request.url, { headers: request.headers, body: request.body });
}).post("/uploads/:uploadId", handleAssetUpload).get("/uploads/:uploadId", handleAssetDownload).get("/unfurl", handleUnfurlRequest);
var worker_default = router;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_checked_fetch();
init_modules_watch_stub();
var drainBody = async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
};
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_checked_fetch();
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
var jsonError = async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
};
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-fO5AAb/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
init_checked_fetch();
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}

// .wrangler/tmp/bundle-fO5AAb/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  };
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      };
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  TldrawDurableObject,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
/*! Bundled license information:

@tldraw/utils/dist-esm/lib/media/apng.mjs:
  (*!
   * MIT License: https://github.com/vHeemstra/is-apng/blob/main/license
   * Copyright (c) Philip van Heemstra
   *)

@tldraw/utils/dist-esm/lib/media/gif.mjs:
  (*!
   * MIT License
   * Modified code originally from <https://github.com/qzb/is-animated>
   * Copyright (c) 2016 Józef Sokołowski <j.k.sokolowski@gmail.com>
   *)

@tldraw/utils/dist-esm/lib/media/png.mjs:
  (*!
   * MIT License: https://github.com/alexgorbatchev/crc/blob/master/LICENSE
   * Copyright: 2014 Alex Gorbatchev
   * Code: crc32, https://github.com/alexgorbatchev/crc/blob/master/src/calculators/crc32.ts
   *)

@tldraw/utils/dist-esm/lib/media/webp.mjs:
  (*!
   * MIT License: https://github.com/sindresorhus/is-webp/blob/main/license
   * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
   *)
*/
//# sourceMappingURL=worker.js.map
