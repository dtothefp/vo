/**
 * Module Dependencies
 */

var Promise = require('es6-promise').Promise;
var assert = require('assert');
var Vo = require('..');

/**
 * Tests
 */

describe('sync functions: vo(fn)', function() {
  it('should work with synchronous functions', function(done) {
    function sync(a, b) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      return a + b;
    }

    Vo(sync)('a', 'b', function(err, v) {
      if (err) return done(err);
      assert.equal(v, 'ab');
      done();
    })
  })

  it('should catch thrown errors', function(done) {
    function sync(a, b) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      throw new Error('some error');
      return a + b;
    }

    Vo(sync)('a', 'b', function(err, v) {
      assert.equal('some error', err.message);
      assert.equal(undefined, v);
      done();
    })
  })
});

describe('async functions: vo(fn)', function() {
  it('should work with asynchronous functions', function(done) {
    function async(a, b, fn) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      fn(null, a + b);
    }

    Vo(async)('a', 'b', function(err, v) {
      if (err) return done(err);
      assert.equal(v, 'ab');
      done();
    });
  });

  it('should handle errors', function(done) {
    function async(a, b, fn) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      return fn(new Error('some error'));
    }

    Vo(async)('a', 'b', function(err, v) {
      assert.equal('some error', err.message);
      assert.equal(undefined, v);
      done();
    })
  })
});

describe('generators: vo(*fn)', function() {
  it('should work with generators', function(done) {
    function *gen(a, b) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      return yield timeout(50);
    }

    Vo(gen)('a', 'b', function(err, v) {
      if (err) return done(err);
      assert.equal(v, 50);
      done();
    });
  })

  it('should catch thrown errors', function() {
    function *gen(a, b) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      throw new Error('some error');
      return a + b;
    }

    Vo(gen)('a', 'b', function(err, v) {
      assert.equal('some error', err.message);
      assert.equal(undefined, v);
      done();
    });
  })
});

describe('promises: vo(promise)', function() {
  it('should work with promises', function(done) {
    function promise(a, b) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      return promise_timeout(50);
    }

    Vo(promise)('a', 'b', function(err, v) {
      if (err) return done(err);
      assert.equal(v, 50);
      done();
    })
  })

  it('should handle errors', function(done) {
    function promise(a, b) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      return promise_timeout(0);
    }

    Vo(promise)('a', 'b', function(err, v) {
      assert.equal('no ms present', err.message);
      assert.equal(undefined, v);
      done();
    })
  });
});

describe('thunks: vo(fn)(args, ...)(fn)', function() {
  it('should support thunks', function(done) {
    function async(a, b, fn) {
      assert.equal(a, 'a');
      assert.equal(b, 'b');
      return fn(null, a + b);
    }

    Vo(async)('a', 'b')(function(err, v) {
      if (err) return done(err);
      assert.equal(v, 'ab');
      done();
    })
  })
})

describe('series: vo(fn, ...)', function() {
  it('should run in series', function(done) {
    var o = [];

    function a(a, b) {
      o.push('a');
      assert.equal('a', a);
      assert.equal('b', b);
      return 'a';
    }

    function b(a, fn) {
      o.push('b');
      assert.equal('a', a);
      fn(null, 'b1', 'b2');
    }

    function c(a, b) {
      assert.equal('b1', a);
      assert.equal('b2', b);
      o.push('c');
      return promise_timeout(50, 'c');
    }

    function *d(c) {
      o.push('d');
      assert.equal('c', c);
      return yield timeout(50, 'd');
    }


    Vo(a, b, c, d)('a', 'b', function(err, v) {
      if (err) return done(err);
      assert.deepEqual(['a', 'b', 'c', 'd'], o);
      assert.deepEqual('d', v);
      done();
    })
  })

  it('should handle errors', function(done) {
    var o = [];

    function a(a, b) {
      o.push('a');
      assert.equal('a', a);
      assert.equal('b', b);
      return 'a';
    }

    function b(a, fn) {
      o.push('b');
      assert.equal('a', a);
      fn(null, 'b1', 'b2');
    }

    function c(a, b) {
      o.push('c');
      assert.equal(a, 'b1');
      assert.equal(b, 'b2');
      return promise_timeout(null, 'c');
    }

    function *d(a, b) {
      o.push('d');
      assert.equal('a', a);
      assert.equal('b', b);
      return yield timeout(50, 'd');
    }


    Vo(a, b, c, d)('a', 'b', function(err, v) {
      assert.equal('no ms present', err.message);
      assert.equal(undefined, v);
      assert.deepEqual(['a', 'b', 'c'], o);
      done();
    })
  })
});

describe('arrays: vo([...])', function() {
  function to(ms, arr) {
    return function(fn) {
      timeout(ms)(function(err, v) {
        if (!ms) return fn(new Error('ms must be specified'));
        arr.push(v);
        fn(err, v);
      })
    }
  }

  it('should run an array of functions in parallel', function(done) {
    var o = [];

    Vo([to(50, o), to(150, o), to(100, o)])(function(err, v) {
      if (err) return done(err);
      assert.deepEqual([50, 150, 100], v);
      assert.deepEqual([50, 100, 150], o);
      done();
    })

  })

  it('should handle errors', function(done) {
    var o = [];

    Vo([to(50, o), to(0, o), to(100, o)])(function(err, v) {
      assert.equal('ms must be specified', err.message);
      assert.equal(undefined, v);
      done();
    });
  });
});

describe('objects: vo({...})', function() {
  function to(ms, arr) {
    return function(fn) {
      timeout(ms)(function(err, v) {
        if (!ms) return fn(new Error('ms must be specified'));
        arr.push(v);
        fn(err, v);
      })
    }
  }

  it('should run an object of functions in parallel', function(done) {
    var o = [];

    Vo({ a: to(50, o), b: to(150, o), c: to(100, o) })(function(err, v) {
      if (err) return done(err);
      assert.deepEqual(v, {
        a: 50,
        b: 150,
        c: 100
      });

      assert.deepEqual([50, 100, 150], o);
      done();
    })
  })

  it('should catch any errors', function(done) {
    var o = [];

    Vo({ a: to(50, o), b: to(150, o), c: to(0, o) })(function(err, v) {
      assert.equal('ms must be specified', err.message);
      assert.equal(undefined, v);
      done();
    })
  })
});

describe('composition: vo(vo(...), [vo(...), vo(...)])', function() {

  it('should support series composition', function(done) {
    var o = [];

    function a(a, b) {
      o.push('a');
      assert.equal('a', a);
      assert.equal('b', b);
      return 'a';
    }

    function b(a, fn) {
      o.push('b');
      assert.equal('a', a);
      fn(null, 'b1', 'b2');
    }

    function c(b) {
      o.push('c');
      assert.deepEqual(['b1', 'b2'], b);
      return promise_timeout(50, 'c');
    }

    function *d(c) {
      o.push('d');
      assert.equal('c', c);
      return yield timeout(50, 'd');
    }

    Vo(Vo(a, b), c, d)('a', 'b', function(err, v) {
      if (err) return done(err);
      assert.equal('d', v);
      assert.deepEqual(['a', 'b', 'c', 'd'], o);
      done();
    })
  });

  it('should support async composition', function(done) {
    function to(ms, arr) {
      return function(fn) {
        timeout(ms)(function(err, v) {
          if (!ms) return fn(new Error('ms must be specified'));
          arr.push(v);
          fn(err, v);
        })
      }
    }

    var o = [];
    var a = Vo([to(50, o), to(150, o)]);
    var b = Vo([to(100, o), to(200, o)]);

    Vo([a, b])(function(err, v) {
      if (err) return done(err);
      assert.deepEqual([[50, 150], [100, 200]], v);
      assert.deepEqual([50, 100, 150, 200], o);
      done();
    });
  })

  it('should support async composition with objects', function(done) {
    function to(ms, arr) {
      return function(fn) {
        timeout(ms)(function(err, v) {
          if (!ms) return fn(new Error('ms must be specified'));
          arr.push(v);
          fn(err, v);
        })
      }
    }

    var o = [];
    var a = Vo({ a1: to(50, o), a2: to(150, o) });
    var b = Vo({ b1: to(100, o), b2: to(200, o) });

    Vo({ c1: a, c2: b })(function(err, v) {
      if (err) return done(err);

      assert.deepEqual(v, {
        c1: {
          a1: 50,
          a2: 150
        },
        c2: {
          b1: 100,
          b2: 200
        }
      });
      assert.deepEqual([50, 100, 150, 200], o);

      done();
    });
  });

  it('should propagate errors', function(done) {
    function to(ms, arr) {
      return function(fn) {
        timeout(ms)(function(err, v) {
          if (!ms) return fn(new Error('ms must be specified'));
          arr.push(v);
          fn(err, v);
        })
      }
    }

    var o = [];
    var a = Vo({ a1: to(50, o), a2: to(0, o) });
    var b = Vo({ b1: to(100, o), b2: to(200, o) });

    Vo({ c1: a, c2: b })(function(err, v) {
      assert.equal('ms must be specified', err.message);
      assert.equal(undefined, v);
      done();
    });
  });
})

describe('vo.catch(fn)', function() {
  it('should catch errors and continue', function(done) {
    var called = false;
    var e = null;

    function a(one) {
      assert.equal('one', one);
      throw new Error('wtf!');
    }

    function b(v) {
      assert.equal('no problem', v);
      called = true;
      return 'hi';
    }

    function onerror(err, fn) {
      assert.deepEqual(['one', 'two'], err.upstream);
      e = err.message;
      return fn(null, 'no problem');
    }

    var vo = Vo(a, b).catch(onerror);
    vo('one', 'two', function(err, v) {
      assert.equal(true, called);
      assert.equal('wtf!', e);
      assert.equal('hi', v);
      done();
    })
  })

  it('should catch errors and be done', function(done) {
    var called = false;
    var e = null;

    function a() {
      throw new Error('wtf!');
    }

    function b(v) {
      called = true;
      return 'hi';
    }

    function onerror(err) {
      e = err.message;
      throw new Error('sky be fallin');
    }

    var vo = Vo(a, b).catch(onerror);
    vo(function(err, v) {
      assert.equal('sky be fallin', err.message)
      assert.equal(false, called);
      assert.equal('wtf!', e);
      done();
    })
  })

  it('should support catching in arrays', function(done) {
    var called = false;
    var e = null;

    function a(one, two) {
      assert.equal('one', one);
      assert.equal('two', two);
      throw new Error('wtf!');
    }

    function b(one, two) {
      assert.equal('one', one);
      assert.equal('two', two);
      called = true;
      return 'hi';
    }

    function onerror(err) {
      assert.deepEqual(['one', 'two'], err.upstream);
      e = err.message;
      return 'jk';
    }

    var vo = Vo([a, b]).catch(onerror);
    vo('one', 'two', function(err, v) {
      assert.equal(true, called);
      assert.equal('wtf!', e);
      assert.deepEqual(['jk', 'hi'], v);
      done();
    });
  })

  it('should support catching in arrays and finishing', function(done) {
    var called = false;
    var e = null;

    function a() {
      throw new Error('wtf!');
    }

    function b() {
      return 'hi';
    }

    function onerror(err) {
      e = err.message;
      throw new Error('sky be fallin');
    }

    var vo = Vo([a, b]).catch(onerror);
    vo(function(err, v) {
      assert.equal('sky be fallin', err.message);
      assert.equal('wtf!', e);
      done();
    });
  })

  it('should support catching in objects', function(done) {
    var called = false;
    var e = null;

    function a() {
      throw new Error('wtf!');
    }

    function b() {
      called = true;
      return 'hi';
    }

    function onerror(err) {
      e = err.message;
      return 'jk';
    }

    var vo = Vo({ a: a, b: b }).catch(onerror);
    vo(function(err, v) {
      assert.equal(true, called);
      assert.equal('wtf!', e);
      assert.deepEqual({ a: 'jk', b: 'hi' }, v);
      done();
    });
  })

  it('should support catching in objects and finishing', function(done) {
    var called = false;
    var e = null;

    function a() {
      throw new Error('wtf!');
    }

    function b() {
      return 'hi';
    }

    function onerror(err) {
      e = err.message;
      throw new Error('sky be fallin');
    }

    var vo = Vo({ a: a, b: b }).catch(onerror);
    vo(function(err, v) {
      assert.equal('sky be fallin', err.message);
      assert.equal('wtf!', e);
      done();
    });
  })

  it('should support catching with composition', function(done) {
    var called = false;

    var a = Vo(function() {
      throw new Error('oh noz')
    }).catch(function (err) {
      return 'a';
    })

    var b = Vo(function(a) {
      called = true;
      assert.equal('a', a);
      throw new Error('zomg');
    }).catch(function(err) {
      assert.equal('a', err.upstream[0]);
      return 'b';
    })

    var vo = Vo(a, b).catch(function(err) {
      done(new Error('should not have been called'));
    });

    vo(function(err, v) {
      if (err) return done(err);
      assert.equal(true, called);
      assert.equal('b', v);
      done();
    });
  })

  it('should support cascading error handling', function(done) {
    var called = 0;

    var a = Vo(function() {
      throw new Error('oh noz')
    }).catch(function (err) {
      return 'a';
    })

    var b = Vo(function(a) {
      called++;
      assert.equal('a', a);
      throw new Error('zomg');
    }).catch(function(err) {
      throw new Error('sky be fallin');
    })

    var vo = Vo(a, b).catch(function(err) {
      called++;
      assert.equal('sky be fallin', err.message);
      return 'its okay';
    });

    vo(function(err, v) {
      if (err) return done(err);
      assert.equal(2, called);
      assert.equal('its okay', v);
      done();
    });
  })
})

/**
 * Timeout thunk
 *
 * @param {Number} ms
 * @return {Function}
 */

function timeout(ms, arg) {
  return function(fn) {
    setTimeout(function() {
      fn(null, arg || ms);
    }, ms);
  }
}

/**
 * Promise timeout
 *
 * @param {Number} ms
 * @param {Promise}
 */

function promise_timeout(ms, arg) {
  return new Promise(function(resolve, reject) {
    // error
    if (!ms) {
      setTimeout(function() {
        reject(new Error('no ms present'))
      }, 0)
    }

    setTimeout(function() {
      resolve(arg || ms);
    }, ms);
  });
}
