(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Vo = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/**
 * Module Dependencies
 */

var foreach = require('foreach');
var sliced = require('sliced');
var wrap = require('wrap-fn');
var isArray = Array.isArray;
var noop = function () {};
var keys = Object.keys;

/**
 * Module Exports
 */

module.exports = Vo;

/**
 * Initialize a `Vo` instance
 *
 * @param {Array|Object|Function, ...}
 * @return {Function}
 */

function Vo() {
  var pipeline = sliced(arguments);

  var options = {
    pipeline: true,
    catch: false
  };

  function vo() {
    var args = sliced(arguments);
    var last = args[args.length - 1];

    if (typeof last === 'function') {
      var done = args.pop();
      start(args, done);
    } else {
      return curry;
    }

    function curry(done) {
      start(args, done);
    }

    function start(args, done) {
      series(pipeline, args, options, function(err, v) {
        if (err) return done(err);
        return done(null, v);
      });
    }
  }

  /**
   * Catch errors
   *
   * @param {Function} fn
   * @return {Vo}
   */

  vo.catch = function(fn) {
    options.catch = 'boolean' == typeof fn ? noop : fn;
    return vo;
  }

  /**
   * Pipeline/Middleware support
   *
   * @param {Boolean} pipeline
   * @return {Vo}
   */

  vo.pipeline = function(pipeline) {
    options.pipeline = !!pipeline;
    return vo;
  };

  // TODO: would love to replace this
  // with "vo instanceof Vo"
  vo.vo = true;

  return vo;
}

/**
 * Run the array in series
 *
 * @param {Array} pipeline
 * @param {Array} args
 * @param {Function} done
 */

function series(pipeline, args, options, done) {
  var pending = pipeline.length;
  var fns = pipeline.map(seed(options));
  var first = fns.shift();
  var ret = [];

  first(args, response);

  function response(err) {
    if (err && options.catch && !err._skip) return caught.apply(null, arguments);
    else if (err) return done(err);
    next(sliced(arguments, 1));
  }

  function caught(err) {
    err.upstream = sliced(arguments, 1);
    wrap(options.catch, function(err) {
      if (err) return done(err);
      next(sliced(arguments, 1));
    })(err);
  }

  function next(v) {
    var fn = fns.shift();
    if (!fn) return done(null, v.length === 1 ? v[0] : v);
    fn(v, response);
  }
}

/**
 * Seed the initial values
 *
 * @param {Mixed} v
 * @return {Function}
 */

function seed(options) {
  return function _seed(v) {
    var t = type(v);

    switch(t) {
      case 'function': return resolve_function(v);
      case 'object': return resolve(v, options);
      case 'array': return resolve(v, options);
      case 'vo': return resolve_vo(v);
      default: return function(args, done) { return done() };
    }
  }
}

/**
 * Resolve an inner `Vo` instance
 *
 * @param {Vo} vo
 * @return {Function}
 */

function resolve_vo(vo) {
  return function _resolve_vo(args, done) {
    return vo.apply(null, args.concat(function(err) {
      if (err) done.apply(null, [err].concat(args));
      else done.apply(null, arguments);
    }));
  }
}

/**
 * Resolve a function (sync or async),
 * generator, or promise
 *
 * @param {Function|Generator|Promise} fn
 * @return {Function}
 */

function resolve_function(fn) {
  return function _resolve_function(args, done) {
    wrap(fn, function(err) {
      if (err) done.apply(null, [err].concat(args));
      else done.apply(null, arguments);
    }).apply(null, args);
  }
}

/**
 * Resolve an object/array recursively (sync)
 *
 * @param {Object|Array} obj
 * @return {Function}
 */

function resolve(obj, options) {
  return function _resolve(args, done) {
    var parallel = {};
    var pending = 0;
    var out = {};

    // map out the parallel functions first
    foreach(obj, function(v, k) {
      var t = type(v);

      switch(t) {
        case 'function':
          parallel[k] = resolve_function(v);
          pending++;
          break;
        case 'array':
          parallel[k] = resolve(v);
          pending++;
          break;
        case 'object':
          parallel[k] = resolve(v);
          pending++;
          break;
        case 'vo':
          parallel[k] = resolve_vo(v);
          pending++;
          break;
        default:
          out[k] = v;
      }
    });

    // make the requests
    foreach(parallel, function(v, k) {
      if (!v) return;
      v(args, response);

      function response(err) {
        if (err && options.catch) return caught.apply(null, arguments);
        else if (err) return done(err);
        next(sliced(arguments, 1));
      }

      function caught(err) {
        err.upstream = sliced(arguments, 1);
        wrap(options.catch, function(err) {
          if (err) {
            // TODO: fix up, right now prevents double onerror callbacks
            err._skip = true;
            return done(err);
          }

          next(sliced(arguments, 1));
        })(err);
      }

      function next(args) {
        out[k] = args.length === 1 ? args[0] : args;
        if (!--pending) return done(null, out);
      }
    });
  }
}

/**
 * Get the type
 *
 * @param {Mixed} v
 * @return {String}
 */

function type(v) {
  return isArray(v)
    ? 'array'
    : v && v.vo
      ? 'vo'
      : typeof v;
}

},{"foreach":2,"sliced":3,"wrap-fn":5}],2:[function(require,module,exports){

var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;

module.exports = function forEach (obj, fn, ctx) {
    if (toString.call(fn) !== '[object Function]') {
        throw new TypeError('iterator must be a function');
    }
    var l = obj.length;
    if (l === +l) {
        for (var i = 0; i < l; i++) {
            fn.call(ctx, obj[i], i, obj);
        }
    } else {
        for (var k in obj) {
            if (hasOwn.call(obj, k)) {
                fn.call(ctx, obj[k], k, obj);
            }
        }
    }
};


},{}],3:[function(require,module,exports){
module.exports = exports = require('./lib/sliced');

},{"./lib/sliced":4}],4:[function(require,module,exports){

/**
 * An Array.prototype.slice.call(arguments) alternative
 *
 * @param {Object} args something with a length
 * @param {Number} slice
 * @param {Number} sliceEnd
 * @api public
 */

module.exports = function (args, slice, sliceEnd) {
  var ret = [];
  var len = args.length;

  if (0 === len) return ret;

  var start = slice < 0
    ? Math.max(0, slice + len)
    : slice || 0;

  if (sliceEnd !== undefined) {
    len = sliceEnd < 0
      ? sliceEnd + len
      : sliceEnd
  }

  while (len-- > start) {
    ret[len - start] = args[len];
  }

  return ret;
}


},{}],5:[function(require,module,exports){
/**
 * Module Dependencies
 */

var noop = function(){};
var co = require('co');

/**
 * Export `wrap-fn`
 */

module.exports = wrap;

/**
 * Wrap a function to support
 * sync, async, and gen functions.
 *
 * @param {Function} fn
 * @param {Function} done
 * @return {Function}
 * @api public
 */

function wrap(fn, done) {
  done = once(done || noop);

  return function() {
    // prevents arguments leakage
    // see https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
    var i = arguments.length;
    var args = new Array(i);
    while (i--) args[i] = arguments[i];

    var ctx = this;

    // done
    if (!fn) {
      return done.apply(ctx, [null].concat(args));
    }

    // async
    if (fn.length > args.length) {
      // NOTE: this only handles uncaught synchronous errors
      try {
        return fn.apply(ctx, args.concat(done));
      } catch (e) {
        return done(e);
      }
    }

    // generator
    if (generator(fn)) {
      return co(fn).apply(ctx, args.concat(done));
    }

    // sync
    return sync(fn, done).apply(ctx, args);
  }
}

/**
 * Wrap a synchronous function execution.
 *
 * @param {Function} fn
 * @param {Function} done
 * @return {Function}
 * @api private
 */

function sync(fn, done) {
  return function () {
    var ret;

    try {
      ret = fn.apply(this, arguments);
    } catch (err) {
      return done(err);
    }

    if (promise(ret)) {
      ret.then(function (value) { done(null, value); }, done);
    } else {
      ret instanceof Error ? done(ret) : done(null, ret);
    }
  }
}

/**
 * Is `value` a generator?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function generator(value) {
  return value
    && value.constructor
    && 'GeneratorFunction' == value.constructor.name;
}


/**
 * Is `value` a promise?
 *
 * @param {Mixed} value
 * @return {Boolean}
 * @api private
 */

function promise(value) {
  return value && 'function' == typeof value.then;
}

/**
 * Once
 */

function once(fn) {
  return function() {
    var ret = fn.apply(this, arguments);
    fn = noop;
    return ret;
  };
}

},{"co":6}],6:[function(require,module,exports){

/**
 * slice() reference.
 */

var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

module.exports = co;

/**
 * Wrap the given generator `fn` and
 * return a thunk.
 *
 * @param {Function} fn
 * @return {Function}
 * @api public
 */

function co(fn) {
  var isGenFun = isGeneratorFunction(fn);

  return function (done) {
    var ctx = this;

    // in toThunk() below we invoke co()
    // with a generator, so optimize for
    // this case
    var gen = fn;

    // we only need to parse the arguments
    // if gen is a generator function.
    if (isGenFun) {
      var args = slice.call(arguments), len = args.length;
      var hasCallback = len && 'function' == typeof args[len - 1];
      done = hasCallback ? args.pop() : error;
      gen = fn.apply(this, args);
    } else {
      done = done || error;
    }

    next();

    // #92
    // wrap the callback in a setImmediate
    // so that any of its errors aren't caught by `co`
    function exit(err, res) {
      setImmediate(function(){
        done.call(ctx, err, res);
      });
    }

    function next(err, res) {
      var ret;

      // multiple args
      if (arguments.length > 2) res = slice.call(arguments, 1);

      // error
      if (err) {
        try {
          ret = gen.throw(err);
        } catch (e) {
          return exit(e);
        }
      }

      // ok
      if (!err) {
        try {
          ret = gen.next(res);
        } catch (e) {
          return exit(e);
        }
      }

      // done
      if (ret.done) return exit(null, ret.value);

      // normalize
      ret.value = toThunk(ret.value, ctx);

      // run
      if ('function' == typeof ret.value) {
        var called = false;
        try {
          ret.value.call(ctx, function(){
            if (called) return;
            called = true;
            next.apply(ctx, arguments);
          });
        } catch (e) {
          setImmediate(function(){
            if (called) return;
            called = true;
            next(e);
          });
        }
        return;
      }

      // invalid
      next(new TypeError('You may only yield a function, promise, generator, array, or object, '
        + 'but the following was passed: "' + String(ret.value) + '"'));
    }
  }
}

/**
 * Convert `obj` into a normalized thunk.
 *
 * @param {Mixed} obj
 * @param {Mixed} ctx
 * @return {Function}
 * @api private
 */

function toThunk(obj, ctx) {

  if (isGeneratorFunction(obj)) {
    return co(obj.call(ctx));
  }

  if (isGenerator(obj)) {
    return co(obj);
  }

  if (isPromise(obj)) {
    return promiseToThunk(obj);
  }

  if ('function' == typeof obj) {
    return obj;
  }

  if (isObject(obj) || Array.isArray(obj)) {
    return objectToThunk.call(ctx, obj);
  }

  return obj;
}

/**
 * Convert an object of yieldables to a thunk.
 *
 * @param {Object} obj
 * @return {Function}
 * @api private
 */

function objectToThunk(obj){
  var ctx = this;
  var isArray = Array.isArray(obj);

  return function(done){
    var keys = Object.keys(obj);
    var pending = keys.length;
    var results = isArray
      ? new Array(pending) // predefine the array length
      : new obj.constructor();
    var finished;

    if (!pending) {
      setImmediate(function(){
        done(null, results)
      });
      return;
    }

    // prepopulate object keys to preserve key ordering
    if (!isArray) {
      for (var i = 0; i < pending; i++) {
        results[keys[i]] = undefined;
      }
    }

    for (var i = 0; i < keys.length; i++) {
      run(obj[keys[i]], keys[i]);
    }

    function run(fn, key) {
      if (finished) return;
      try {
        fn = toThunk(fn, ctx);

        if ('function' != typeof fn) {
          results[key] = fn;
          return --pending || done(null, results);
        }

        fn.call(ctx, function(err, res){
          if (finished) return;

          if (err) {
            finished = true;
            return done(err);
          }

          results[key] = res;
          --pending || done(null, results);
        });
      } catch (err) {
        finished = true;
        done(err);
      }
    }
  }
}

/**
 * Convert `promise` to a thunk.
 *
 * @param {Object} promise
 * @return {Function}
 * @api private
 */

function promiseToThunk(promise) {
  return function(fn){
    promise.then(function(res) {
      fn(null, res);
    }, fn);
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isPromise(obj) {
  return obj && 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGenerator(obj) {
  return obj && 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

function isGeneratorFunction(obj) {
  return obj && obj.constructor && 'GeneratorFunction' == obj.constructor.name;
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

function isObject(val) {
  return val && Object == val.constructor;
}

/**
 * Throw `err` in a new stack.
 *
 * This is used when co() is invoked
 * without supplying a callback, which
 * should only be for demonstrational
 * purposes.
 *
 * @param {Error} err
 * @api private
 */

function error(err) {
  if (!err) return;
  setImmediate(function(){
    throw err;
  });
}

},{}]},{},[1])(1)
});